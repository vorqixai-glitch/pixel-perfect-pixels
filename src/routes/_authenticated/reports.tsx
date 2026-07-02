import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/scanner.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const dash = useServerFn(getDashboard);
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => dash() });
  const scans = q.data?.scans || [];
  const findings = q.data?.findings || [];

  function exportScan(scanId: string, target: string) {
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
        `- Confidence: ${Math.round(r.confidence * 100)}%`,
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
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <p className="text-sm text-muted-foreground">Executive-ready summaries with full remediation guidance.</p>

      <Card className="mt-6 border-border">
        <CardHeader><CardTitle className="text-base">Available reports</CardTitle></CardHeader>
        <CardContent className="p-0">
          {scans.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No scans yet. Run a scan first.</div>
          ) : (
            <ul className="divide-y divide-border">
              {scans.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{s.target}</div>
                    <div className="text-xs text-muted-foreground">
                      Score {Number(s.score)}/100 · {findings.filter((f) => f.scan_id === s.id).length} findings · {new Date(s.created_at).toLocaleString()}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => exportScan(s.id, s.target)}>
                    <Download className="h-4 w-4" /> Export
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
