import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboard, logReportExport } from "@/lib/scanner.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { downloadCsv, downloadPdf, type ExportFinding } from "@/lib/report-export";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const dash = useServerFn(getDashboard);
  const logExport = useServerFn(logReportExport);
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => dash() });
  const scans = q.data?.scans || [];
  const findings = (q.data?.findings || []) as unknown as ExportFinding[];
  const [busy, setBusy] = useState<string | null>(null);

  function slug(target: string) {
    return target.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 50) || "scope";
  }

  async function record(scanId: string | null, format: "csv" | "pdf" | "markdown", scope: string, count: number) {
    try {
      await logExport({ data: { scanId, format, scope, findings: count } });
    } catch {
      /* export already delivered; audit logging is best-effort */
    }
  }

  async function exportCsv(scanId: string | null, scope: string) {
    const key = `${scanId ?? "all"}-csv`;
    setBusy(key);
    try {
      const rows = scanId ? findings.filter((f) => f.scan_id === scanId) : findings;
      downloadCsv(rows, scope, `security-issues-${slug(scope)}-${Date.now()}.csv`);
      await record(scanId, "csv", scope, rows.length);
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf(scanId: string | null, scope: string) {
    const key = `${scanId ?? "all"}-pdf`;
    setBusy(key);
    try {
      const rows = scanId ? findings.filter((f) => f.scan_id === scanId) : findings;
      const scan = scans.find((s) => s.id === scanId);
      await downloadPdf(
        rows,
        scan ? { target: scan.target, framework: scan.framework, score: Number(scan.score) } : null,
        scope,
        `security-issues-${slug(scope)}-${Date.now()}.pdf`,
      );
      await record(scanId, "pdf", scope, rows.length);
    } finally {
      setBusy(null);
    }
  }

  async function exportMarkdown(scanId: string, target: string) {
    const key = `${scanId}-md`;
    setBusy(key);
    try {
      const rows = findings.filter((f) => f.scan_id === scanId);
      const scan = scans.find((s) => s.id === scanId);
      const md = [
        `# Compliance report — ${target}`,
        `Generated: ${new Date().toLocaleString()}`,
        `Framework: ${scan?.framework || "General"}`,
        `Risk score: ${Number(scan?.score || 0)}/100`,
        `Total findings: ${rows.length}`,
        "",
        "## Executive summary",
        rows.length === 0
          ? "No compliance issues were detected in the scanned surfaces."
          : `Detected ${rows.length} finding(s) across ${new Set(rows.map((r) => r.page_url)).size} page(s). Critical: ${rows.filter((r) => r.severity === "critical").length}. High: ${rows.filter((r) => r.severity === "high").length}.`,
        "",
        "## Findings",
        ...rows.map((r) => [
          `### [${r.severity.toUpperCase()}] ${r.title}`,
          `- Category: ${r.category}`,
          `- Page: ${r.page_url}`,
          `- Status: ${r.status}`,
          `- Confidence: ${Math.round(Number(r.confidence) * 100)}%`,
          "",
          `**Description.** ${r.description}`,
          "",
          `**Why it matters.** ${r.why_matters}`,
          "",
          `**Suggested fix.** ${r.suggested_fix}`,
          "",
        ].join("\n")),
      ].join("\n");

      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${scanId}.md`;
      a.click();
      URL.revokeObjectURL(url);
      await record(scanId, "markdown", target, rows.length);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <p className="text-sm text-muted-foreground">
        Executive-ready summaries with full remediation guidance. Exports include the internal issue ID, severity,
        detection evidence, and resolution details for every finding.
      </p>

      <Card className="mt-6 border-border">
        <CardHeader><CardTitle className="text-base">Workspace security issues report</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            {findings.length} finding{findings.length === 1 ? "" : "s"} across {scans.length} scan{scans.length === 1 ? "" : "s"} ·{" "}
            {findings.filter((f) => f.status === "open").length} open ·{" "}
            {findings.filter((f) => f.severity === "critical").length} critical
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={findings.length === 0 || busy === "all-csv"}
              onClick={() => exportCsv(null, "All scans")}
            >
              {busy === "all-csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} CSV
            </Button>
            <Button
              size="sm"
              disabled={findings.length === 0 || busy === "all-pdf"}
              onClick={() => exportPdf(null, "All scans")}
            >
              {busy === "all-pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 border-border">
        <CardHeader><CardTitle className="text-base">Per-scan reports</CardTitle></CardHeader>
        <CardContent className="p-0">
          {scans.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No scans yet. Run a scan first.</div>
          ) : (
            <ul className="divide-y divide-border">
              {scans.map((s) => {
                const count = findings.filter((f) => f.scan_id === s.id).length;
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{s.target}</div>
                      <div className="text-xs text-muted-foreground">
                        Score {Number(s.score)}/100 · {count} findings · {new Date(s.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={busy === `${s.id}-csv`} onClick={() => exportCsv(s.id, s.target)}>
                        {busy === `${s.id}-csv` ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} CSV
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy === `${s.id}-pdf`} onClick={() => exportPdf(s.id, s.target)}>
                        {busy === `${s.id}-pdf` ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busy === `${s.id}-md`} onClick={() => exportMarkdown(s.id, s.target)}>
                        {busy === `${s.id}-md` ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Markdown
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
