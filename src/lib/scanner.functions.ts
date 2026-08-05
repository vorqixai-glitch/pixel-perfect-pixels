import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const targetSchema = z.object({
  target: z.string().trim().min(3).max(500),
  depth: z.enum(["single", "shallow", "deep"]).default("single"),
  framework: z.string().default("General"),
});

function normalizeUrl(input: string): string {
  let t = input.trim();
  if (!/^https?:\/\//i.test(t)) t = "https://" + t;
  try {
    return new URL(t).toString();
  } catch {
    throw new Error("Invalid URL");
  }
}

export const createScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => targetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const url = normalizeUrl(data.target);

    const { data: scan, error } = await supabase
      .from("scans")
      .insert({
        user_id: userId,
        target: url,
        framework: data.framework,
        answers: { depth: data.depth },
        findings: [],
        score: 0,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("audit_events").insert({
      user_id: userId,
      scan_id: scan.id,
      action: "scan.created",
      meta: { target: url, depth: data.depth, framework: data.framework },
    });

    return { scanId: scan.id as string };
  });

export const runScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ scanId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { analyzeHtml, computeScore } = await import("./scanner.server");

    const { data: scan, error: se } = await supabase
      .from("scans")
      .select("*")
      .eq("id", data.scanId)
      .single();
    if (se || !scan) throw new Error("Scan not found");

    const depth = (scan.answers as { depth?: string })?.depth || "single";
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("Scanner engine offline (missing FIRECRAWL_API_KEY).");

    // Determine URLs to scan
    const urls: string[] = [scan.target];
    if (depth === "shallow" || depth === "deep") {
      try {
        const mapRes = await fetch("https://api.firecrawl.dev/v2/map", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url: scan.target, limit: depth === "deep" ? 8 : 3 }),
        });
        const mapJson = (await mapRes.json()) as { links?: Array<string | { url: string }> };
        const links = (mapJson.links || [])
          .map((l) => (typeof l === "string" ? l : l.url))
          .filter(Boolean)
          .slice(0, depth === "deep" ? 8 : 3);
        for (const l of links) if (!urls.includes(l)) urls.push(l);
      } catch {
        /* fall back to single */
      }
    }

    const allFindings: Array<ReturnType<typeof analyzeHtml>[number]> = [];
    for (const pageUrl of urls) {
      try {
        const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            url: pageUrl,
            formats: ["rawHtml", "html"],
            onlyMainContent: false,
            timeout: 30000,
          }),
        });
        if (!res.ok) continue;
        const body = (await res.json()) as {
          data?: { rawHtml?: string; html?: string; metadata?: { statusCode?: number } };
          rawHtml?: string;
          html?: string;
        };
        const html = body.data?.rawHtml || body.data?.html || body.rawHtml || body.html || "";
        if (!html) continue;

        // Try HEAD for security headers
        const headers: Record<string, string> = {};
        try {
          const hr = await fetch(pageUrl, { method: "HEAD", redirect: "follow" });
          hr.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
        } catch {
          /* ignore */
        }
        const found = analyzeHtml(pageUrl, html, headers);
        allFindings.push(...found);
      } catch {
        /* skip page */
      }
    }

    // Persist findings (delete previous run's findings for this scan)
    await supabase.from("findings").delete().eq("scan_id", scan.id);

    if (allFindings.length > 0) {
      const rows = allFindings.map((f) => ({ ...f, user_id: userId, scan_id: scan.id, status: "open" as const }));
      const { error: ie } = await supabase.from("findings").insert(rows);
      if (ie) throw new Error(ie.message);
    }

    const score = computeScore(allFindings);
    await supabase
      .from("scans")
      .update({ score, findings: allFindings as unknown as never })
      .eq("id", scan.id);

    await supabase.from("audit_events").insert({
      user_id: userId,
      scan_id: scan.id,
      action: "scan.completed",
      meta: { pages: urls.length, findings: allFindings.length, score },
    });

    return { scanId: scan.id, score, findings: allFindings.length, pages: urls.length };
  });

export const updateFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["open", "resolved", "ignored"]).optional(),
      notes: z.string().max(2000).optional(),
      assigned_to: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...updates } = data;
    const { error } = await supabase.from("findings").update(updates).eq("id", id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_events").insert({
      user_id: userId,
      action: "finding.updated",
      meta: { finding_id: id, ...updates },
    });
    return { ok: true };
  });

export const logReportExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      scanId: z.string().uuid().nullable().optional(),
      format: z.enum(["csv", "pdf", "markdown"]),
      scope: z.string().max(300),
      findings: z.number().int().nonnegative(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("audit_events").insert({
      user_id: userId,
      scan_id: data.scanId ?? null,
      action: "report.exported",
      meta: { format: data.format, scope: data.scope, findings: data.findings },
    });
    return { ok: true };
  });

export const getDashboard = createServerFn({ method: "POST" })

  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: scans }, { data: findings }, { data: events }] = await Promise.all([
      supabase.from("scans").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("findings").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("audit_events").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    return {
      scans: scans || [],
      findings: findings || [],
      events: events || [],
    };
  });
