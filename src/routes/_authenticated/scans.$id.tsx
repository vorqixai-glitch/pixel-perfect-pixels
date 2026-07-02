import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDashboard, runScan } from "@/lib/scanner.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FindingsTable } from "@/components/findings-table";

export const Route = createFileRoute("/_authenticated/scans/$id")({
  component: ScanDetail,
});

function ScanDetail() {
  const { id } = Route.useParams();
  const dash = useServerFn(getDashboard);
  const run = useServerFn(runScan);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => dash(),
    refetchInterval: (query) => {
      const scan = query.state.data?.scans.find((s) => s.id === id);
      const findings = (query.state.data?.findings || []).filter((f) => f.scan_id === id);
      // poll while scan just created and has no findings yet
      if (scan && findings.length === 0 && Number(scan.score) === 0) {
        const ageMs = Date.now() - new Date(scan.created_at).getTime();
        if (ageMs < 120_000) return 2500;
      }
      return false;
    },
  });

  const [rerunning, setRerunning] = useState(false);

  const scan = q.data?.scans.find((s) => s.id === id);
  const findings = useMemo(() => (q.data?.findings || []).filter((f) => f.scan_id === id), [q.data, id]);

  async function rerun() {
    setRerunning(true);
    try {
      await run({ data: { scanId: id } });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } finally {
      setRerunning(false);
    }
  }

  function exportCsv() {
    const rows = [
      ["Title", "Category", "Severity", "Page", "Status", "Confidence", "Why it matters", "Suggested fix"],
      ...findings.map((f) => [
        f.title, f.category, f.severity, f.page_url, f.status, String(f.confidence), f.why_matters, f.suggested_fix,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (q.isLoading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  if (!scan) return <div className="p-10 text-sm text-muted-foreground">Scan not found. <Link to="/scans" className="underline">Back</Link></div>;

  const scanning = findings.length === 0 && Number(scan.score) === 0 && Date.now() - new Date(scan.created_at).getTime() < 120_000;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
      <div className="mb-4">
        <Link to="/scans" className="text-xs text-muted-foreground hover:text-foreground">← All scans</Link>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{scan.target}</h1>
          <p className="text-sm text-muted-foreground">{scan.framework} · {new Date(scan.created_at).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
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

      {scanning ? (
        <Card className="mt-6 border-border">
          <CardContent className="flex items-center gap-3 p-6 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Scanning in progress — fetching page HTML and evaluating detection rules…
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6 border-border">
          <CardHeader><CardTitle className="text-base">Findings</CardTitle></CardHeader>
          <CardContent className="p-0">
            <FindingsTable findings={findings} />
          </CardContent>
        </Card>
      )}
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
