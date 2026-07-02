import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDashboard, createScan, runScan } from "@/lib/scanner.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, AlertTriangle, ScanLine, ShieldCheck, TrendingUp, Loader2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

function DashboardPage() {
  const dash = useServerFn(getDashboard);
  const create = useServerFn(createScan);
  const run = useServerFn(runScan);
  const nav = useNavigate();
  const [target, setTarget] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => dash() });

  async function startScan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!target.trim()) return setError("Enter a target URL");
    setStarting(true);
    try {
      const { scanId } = await create({ data: { target, depth: "single", framework: "General" } });
      // fire-and-forget run; navigate to detail which polls
      run({ data: { scanId } }).catch(() => void 0);
      nav({ to: "/scans/$id", params: { id: scanId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start scan");
      setStarting(false);
    }
  }

  const scans = q.data?.scans || [];
  const findings = q.data?.findings || [];
  const events = q.data?.events || [];

  const openFindings = findings.filter((f) => f.status === "open");
  const bySeverity = openFindings.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});
  const avgScore = scans.length
    ? Math.round(scans.reduce((s, x) => s + Number(x.score || 0), 0) / scans.length)
    : 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compliance overview</h1>
          <p className="text-sm text-muted-foreground">Continuous risk signal across your public surfaces.</p>
        </div>
      </header>

      <Card className="mt-6 border-border">
        <CardContent className="p-5">
          <form onSubmit={startScan} className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Scan a URL</label>
              <Input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="https://your-domain.com"
                disabled={starting}
              />
            </div>
            <Button type="submit" disabled={starting} className="mt-5">
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              Run scan
            </Button>
          </form>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ShieldCheck} label="Avg. risk score" value={q.isLoading ? null : `${avgScore}`} suffix="/100" />
        <StatCard icon={ScanLine} label="Scans" value={q.isLoading ? null : scans.length.toString()} />
        <StatCard icon={AlertTriangle} label="Open findings" value={q.isLoading ? null : openFindings.length.toString()} />
        <StatCard icon={TrendingUp} label="Critical" value={q.isLoading ? null : (bySeverity.critical || 0).toString()} tone="danger" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent scans</CardTitle>
            <Link to="/scans" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
          </CardHeader>
          <CardContent className="p-0">
            {q.isLoading ? (
              <div className="space-y-2 p-5">
                <Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" />
              </div>
            ) : scans.length === 0 ? (
              <EmptyState label="No scans yet. Run your first scan above." />
            ) : (
              <ul className="divide-y divide-border">
                {scans.slice(0, 6).map((s) => (
                  <li key={s.id}>
                    <Link to="/scans/$id" params={{ id: s.id }} className="flex items-center justify-between px-5 py-3 hover:bg-accent/40">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{s.target}</div>
                        <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                      </div>
                      <ScoreBadge score={Number(s.score)} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">Severity breakdown</CardTitle></CardHeader>
          <CardContent>
            {openFindings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open findings.</p>
            ) : (
              <ul className="space-y-2">
                {(["critical", "high", "medium", "low"] as const).map((s) => (
                  <li key={s} className="flex items-center justify-between">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_COLORS[s]}`}>{s}</span>
                    <span className="text-sm font-medium">{bySeverity[s] || 0}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">Top open findings</CardTitle></CardHeader>
          <CardContent className="p-0">
            {openFindings.length === 0 ? (
              <EmptyState label="Nothing critical right now." />
            ) : (
              <ul className="divide-y divide-border">
                {openFindings
                  .slice()
                  .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
                  .slice(0, 6)
                  .map((f) => (
                    <li key={f.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{f.title}</div>
                          <div className="truncate text-xs text-muted-foreground">{f.page_url}</div>
                        </div>
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_COLORS[f.severity]}`}>
                          {f.severity}
                        </span>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Audit log</CardTitle></CardHeader>
          <CardContent className="p-0">
            {events.length === 0 ? (
              <EmptyState label="No workspace activity yet." />
            ) : (
              <ul className="divide-y divide-border">
                {events.slice(0, 8).map((e) => (
                  <li key={e.id} className="px-5 py-3">
                    <div className="text-sm font-medium">{e.action}</div>
                    <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function severityRank(s: string) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[s] || 0;
}

function StatCard({ icon: Icon, label, value, suffix, tone }: { icon: typeof ShieldCheck; label: string; value: string | null; suffix?: string; tone?: "danger" }) {
  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-4 w-4" /> {label}
        </div>
        <div className={`mt-2 text-3xl font-semibold tracking-tight ${tone === "danger" ? "text-red-400" : ""}`}>
          {value ?? <Skeleton className="h-9 w-16" />}
          {suffix && value && <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : "text-red-400";
  return <span className={`text-sm font-semibold tabular-nums ${color}`}>{score}</span>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="px-5 py-8 text-center text-sm text-muted-foreground">{label}</div>;
}
