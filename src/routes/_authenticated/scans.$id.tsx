import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDashboard, runScan, logReportExport } from "@/lib/scanner.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ExternalLink, ArrowRight, FileSpreadsheet, FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { FindingsTable } from "@/components/findings-table";
import { downloadCsv, downloadPdf, type ExportFinding } from "@/lib/report-export";


export const Route = createFileRoute("/_authenticated/scans/$id")({
  validateSearch: (search: Record<string, unknown>) => ({
    finding: typeof search.finding === "string" ? search.finding : undefined,
    page: typeof search.page === "string" ? search.page : undefined,
  }),
  component: ScanDetail,
});

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;
const SEVERITY_TEXT: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-blue-400",
};

function ScanDetail() {
  const { id } = Route.useParams();
  const { finding: focusId, page: pageFilter } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const dash = useServerFn(getDashboard);
  const run = useServerFn(runScan);
  const logExport = useServerFn(logReportExport);
  const qc = useQueryClient();


  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dash(),
    refetchInterval: (query) => {
      const scan = query.state.data?.scans.find((s) => s.id === id);
      const findings = (query.state.data?.findings || []).filter((f) => f.scan_id === id);
      if (scan && findings.length === 0 && Number(scan.score) === 0) {
        const ageMs = Date.now() - new Date(scan.created_at).getTime();
        if (ageMs < 120_000) return 2500;
      }
      return false;
    },
  });

  const [rerunning, setRerunning] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const scan = q.data?.scans.find((s) => s.id === id);
  const findings = useMemo(() => (q.data?.findings || []).filter((f) => f.scan_id === id), [q.data, id]);
  const events = useMemo(
    () => (q.data?.events || []).filter((e) => e.scan_id === id),
    [q.data, id],
  );

  const byPage = useMemo(() => {
    const map = new Map<string, { url: string; total: number; critical: number; high: number }>();
    for (const f of findings) {
      const row = map.get(f.page_url) || { url: f.page_url, total: 0, critical: 0, high: 0 };
      row.total += 1;
      if (f.severity === "critical") row.critical += 1;
      if (f.severity === "high") row.high += 1;
      map.set(f.page_url, row);
    }
    return Array.from(map.values()).sort((a, b) => b.critical - a.critical || b.high - a.high || b.total - a.total);
  }, [findings]);

  const topFindings = useMemo(
    () =>
      [...findings]
        .filter((f) => f.status === "open")
        .sort(
          (a, b) =>
            SEVERITY_ORDER.indexOf(a.severity as never) - SEVERITY_ORDER.indexOf(b.severity as never) ||
            Number(b.confidence) - Number(a.confidence),
        )
        .slice(0, 5),
    [findings],
  );

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of findings) map[f.category] = (map[f.category] || 0) + 1;
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [findings]);

  async function rerun() {
    setRerunning(true);
    try {
      await run({ data: { scanId: id } });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } finally {
      setRerunning(false);
    }
  }

  async function exportReport(format: "csv" | "pdf") {
    setExporting(format);
    try {
      const rows = findings as unknown as ExportFinding[];
      const scope = scan?.target || id;
      const base = `security-issues-${scope.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").slice(0, 50)}-${Date.now()}`;
      if (format === "csv") {
        downloadCsv(rows, scope, `${base}.csv`);
      } else {
        await downloadPdf(
          rows,
          scan ? { target: scan.target, framework: scan.framework, score: Number(scan.score) } : null,
          scope,
          `${base}.pdf`,
        );
      }
      try {
        await logExport({ data: { scanId: id, format, scope, findings: rows.length } });
      } catch {
        /* export already delivered; audit logging is best-effort */
      }
    } finally {
      setExporting(null);
    }
  }


  if (q.isLoading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  if (!scan) return <div className="p-10 text-sm text-muted-foreground">Scan not found. <Link to="/scans" className="underline">Back</Link></div>;

  const answers = (scan.answers || {}) as { depth?: string };
  const depth = answers.depth || "single";
  const completed = events.find((e) => e.action === "scan.completed");
  const completedMeta = (completed?.meta || {}) as { pages?: number; findings?: number; score?: number };
  const ageMs = Date.now() - new Date(scan.created_at).getTime();
  const scanning = !completed && findings.length === 0 && Number(scan.score) === 0 && ageMs < 120_000;
  const stalled = !completed && findings.length === 0 && Number(scan.score) === 0 && ageMs >= 120_000;
  const statusLabel = scanning ? "Running" : stalled ? "Needs attention" : "Complete";
  const statusTone = scanning
    ? "bg-primary/15 text-primary border-primary/40"
    : stalled
      ? "bg-orange-500/15 text-orange-400 border-orange-500/40"
      : "bg-emerald-500/15 text-emerald-400 border-emerald-500/40";

  const pagesCrawled = completedMeta.pages ?? byPage.length ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
      <div className="mb-4">
        <Link to="/scans" className="text-xs text-muted-foreground hover:text-foreground">← All scans</Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${statusTone}`}>
              {scanning && <Loader2 className="h-3 w-3 animate-spin" />}
              {statusLabel}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{id.slice(0, 8)}</span>
          </div>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight">{scan.target}</h1>
          <p className="text-sm text-muted-foreground">{scan.framework} · {new Date(scan.created_at).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <a
            href={scan.target}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm hover:bg-accent/40"
          >
            <ExternalLink className="h-4 w-4" /> Visit site
          </a>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={findings.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button size="sm" onClick={rerun} disabled={rerunning || scanning}>
            {rerunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Re-run
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatBox label="Risk score" value={`${Number(scan.score)}`} suffix="/100" />
        <StatBox label="Findings" value={findings.length.toString()} />
        <StatBox label="Critical" value={findings.filter((f) => f.severity === "critical").length.toString()} tone="danger" />
        <StatBox label="Resolved" value={findings.filter((f) => f.status === "resolved").length.toString()} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">Crawl parameters</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Param label="Target" value={scan.target} mono />
            <Param label="Crawl depth" value={depth === "single" ? "Single page" : depth === "shallow" ? "Shallow (up to 3 pages)" : "Deep (up to 8 pages)"} />
            <Param label="Framework focus" value={scan.framework} />
            <Param label="Pages crawled" value={String(pagesCrawled)} />
            <Param label="Engine" value="HTML + response header analysis" />
            <Param label="Last updated" value={new Date(scan.updated_at).toLocaleString()} />
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">Category breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No findings recorded yet.</p>
            ) : (
              byCategory.map(([cat, n]) => (
                <div key={cat} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs capitalize text-muted-foreground">{cat}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${(n / findings.length) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-xs tabular-nums">{n}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">Scan activity</CardTitle></CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded.</p>
            ) : (
              <ol className="space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{e.action}</div>
                      <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {scanning ? (
        <Card className="mt-4 border-border">
          <CardContent className="flex items-center gap-3 p-6 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Scanning in progress — fetching page HTML and evaluating detection rules…
          </CardContent>
        </Card>
      ) : (
        <>
          {stalled && (
            <Card className="mt-4 border-orange-500/40">
              <CardContent className="p-6 text-sm">
                This scan produced no findings and never reported completion. Re-run the scan to retry the crawl.
              </CardContent>
            </Card>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="border-border">
              <CardHeader><CardTitle className="text-base">Pages most at risk</CardTitle></CardHeader>
              <CardContent className="p-0">
                {byPage.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">No affected pages.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {byPage.map((p) => (
                      <li key={p.url}>
                        <Link
                          to="/scans/$id"
                          params={{ id }}
                          search={{ page: p.url, finding: undefined }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm">{p.url}</span>
                          {p.critical > 0 && <span className="shrink-0 text-xs text-red-400">{p.critical} critical</span>}
                          {p.high > 0 && <span className="shrink-0 text-xs text-orange-400">{p.high} high</span>}
                          <span className="shrink-0 text-xs text-muted-foreground">{p.total} total</span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader><CardTitle className="text-base">Top open issues</CardTitle></CardHeader>
              <CardContent className="p-0">
                {topFindings.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">No open issues remain on this scan.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {topFindings.map((f) => (
                      <li key={f.id}>
                        <Link
                          to="/scans/$id"
                          params={{ id }}
                          search={{ finding: f.id, page: undefined }}
                          hash={`finding-${f.id}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30"
                        >
                          <span className={`w-16 shrink-0 text-xs font-medium capitalize ${SEVERITY_TEXT[f.severity]}`}>{f.severity}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{f.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{f.page_url}</span>
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4 border-border">
            <CardHeader><CardTitle className="text-base">Findings</CardTitle></CardHeader>
            <CardContent className="p-0">
              <FindingsTable
                findings={findings}
                focusId={focusId}
                pageFilter={pageFilter}
                onClearPageFilter={() => navigate({ search: { finding: undefined, page: undefined } })}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Param({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={`min-w-0 truncate text-right text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function StatBox({ label, value, suffix, tone }: { label: string; value: string; suffix?: string; tone?: "danger" }) {
  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "danger" ? "text-red-400" : ""}`}>
          {value}{suffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
