import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDashboard, createScan, runScan } from "@/lib/scanner.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ScanLine } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/scans/")({
  component: ScansPage,
});

function ScansPage() {
  const dash = useServerFn(getDashboard);
  const create = useServerFn(createScan);
  const run = useServerFn(runScan);
  const nav = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => dash() });

  const [target, setTarget] = useState("");
  const [depth, setDepth] = useState<"single" | "shallow" | "deep">("single");
  const [framework, setFramework] = useState("General");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { scanId } = await create({ data: { target, depth, framework } });
      run({ data: { scanId } }).finally(() => qc.invalidateQueries({ queryKey: ["dashboard"] }));
      nav({ to: "/scans/$id", params: { id: scanId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  const scans = q.data?.scans || [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Scans</h1>
      <p className="text-sm text-muted-foreground">Create a scan against any public URL. We fetch the page and evaluate compliance detection rules.</p>

      <Card className="mt-6 border-border">
        <CardHeader><CardTitle className="text-base">New scan</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_180px_180px_auto]">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Target URL</label>
              <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="https://acme.com" required />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Crawl depth</label>
              <select
                value={depth}
                onChange={(e) => setDepth(e.target.value as typeof depth)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="single">Single page</option>
                <option value="shallow">Shallow (3 pages)</option>
                <option value="deep">Deep (8 pages)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Framework focus</label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option>General</option>
                <option>GDPR</option>
                <option>CCPA</option>
                <option>WCAG 2.2</option>
                <option>SOC 2</option>
                <option>PCI-DSS</option>
              </select>
            </div>
            <Button type="submit" disabled={busy} className="mt-5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              Start scan
            </Button>
          </form>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card className="mt-6 border-border">
        <CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {scans.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No scans yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Target</th>
                  <th className="px-4 py-2 text-left font-medium">Framework</th>
                  <th className="px-4 py-2 text-left font-medium">Score</th>
                  <th className="px-4 py-2 text-left font-medium">When</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scans.map((s) => (
                  <tr key={s.id} className="hover:bg-accent/30">
                    <td className="max-w-[400px] truncate px-4 py-3 font-medium">{s.target}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.framework}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{Number(s.score)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(s.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to="/scans/$id" params={{ id: s.id }} className="text-xs text-foreground underline">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
