import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Live Scan — ComplianceScanr" },
      { name: "description", content: "Run a free compliance scan against your domain. Continuous SOC 2, HIPAA, GDPR & PCI-DSS verification." },
      { property: "og:title", content: "Live Scan — ComplianceScanr" },
      { property: "og:description", content: "Run a free compliance scan against your domain." },
    ],
  }),
  component: ScanPage,
});

type Severity = "PASS" | "FAIL" | "WARN" | "SCAN" | "INIT" | "DONE";
type Finding = {
  id: string;
  ts: string;
  framework: "SOC 2" | "HIPAA" | "GDPR" | "PCI" | "ISO 27001";
  control: string;
  severity: Severity;
  message: string;
};

const CHECKS: Omit<Finding, "id" | "ts">[] = [
  { framework: "SOC 2", control: "CC6.1", severity: "SCAN", message: "Enumerating identity & access controls" },
  { framework: "SOC 2", control: "CC6.1", severity: "PASS", message: "MFA enforced on all admin accounts" },
  { framework: "PCI", control: "1.2.1", severity: "SCAN", message: "Inspecting perimeter security groups" },
  { framework: "PCI", control: "1.2.1", severity: "FAIL", message: "SG-0822 inbound 0.0.0.0/0 open on :22" },
  { framework: "HIPAA", control: "164.312(a)(2)(iv)", severity: "SCAN", message: "Verifying encryption at rest for PHI" },
  { framework: "HIPAA", control: "164.312(a)(2)(iv)", severity: "PASS", message: "AES-256 confirmed on 184 buckets" },
  { framework: "GDPR", control: "Art. 32", severity: "SCAN", message: "Mapping cross-border data residency" },
  { framework: "GDPR", control: "Art. 32", severity: "WARN", message: "1 dataset replicated to us-east-1 without DPA" },
  { framework: "SOC 2", control: "CC7.2", severity: "SCAN", message: "Reviewing system monitoring telemetry" },
  { framework: "SOC 2", control: "CC7.2", severity: "PASS", message: "CloudTrail + GuardDuty active across 12 accounts" },
  { framework: "ISO 27001", control: "A.12.4", severity: "SCAN", message: "Checking audit log retention" },
  { framework: "ISO 27001", control: "A.12.4", severity: "PASS", message: "Logs retained 400d in immutable storage" },
  { framework: "PCI", control: "8.3", severity: "SCAN", message: "Validating cardholder access MFA" },
  { framework: "PCI", control: "8.3", severity: "FAIL", message: "2 service accounts bypass MFA policy" },
];

function nowStamp(offsetMs: number) {
  const d = new Date(Date.now() + offsetMs);
  return d.toTimeString().slice(0, 8);
}

function ScanPage() {
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [feed, setFeed] = useState<Finding[]>([]);
  const [progress, setProgress] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  const start = useCallback(() => {
    const t = target.trim() || "prod-cluster-01";
    setFeed([
      { id: crypto.randomUUID(), ts: nowStamp(0), framework: "SOC 2", control: "—", severity: "INIT", message: `Initializing handshake with ${t}` },
    ]);
    setProgress(0);
    setStatus("running");
  }, [target]);

  useEffect(() => {
    if (status !== "running") return;
    let i = 0;
    const id = setInterval(() => {
      if (i >= CHECKS.length) {
        setFeed((f) => [
          ...f,
          { id: crypto.randomUUID(), ts: nowStamp(0), framework: "SOC 2", control: "—", severity: "DONE", message: "Scan complete · report generated" },
        ]);
        setProgress(100);
        setStatus("done");
        clearInterval(id);
        return;
      }
      const c = CHECKS[i];
      setFeed((f) => [...f, { ...c, id: crypto.randomUUID(), ts: nowStamp(0) }]);
      setProgress(Math.round(((i + 1) / CHECKS.length) * 100));
      i++;
    }, 420);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [feed]);

  const summary = useMemo(() => {
    const pass = feed.filter((f) => f.severity === "PASS").length;
    const fail = feed.filter((f) => f.severity === "FAIL").length;
    const warn = feed.filter((f) => f.severity === "WARN").length;
    const total = pass + fail + warn;
    const score = total === 0 ? 0 : Math.max(0, Math.round(((pass * 1 + warn * 0.5) / total) * 100 * 10) / 10);
    return { pass, fail, warn, total, score };
  }, [feed]);

  const exportReport = () => {
    const blob = new Blob(
      [JSON.stringify({ target: target || "prod-cluster-01", generatedAt: new Date().toISOString(), summary, findings: feed }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scanr-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFeed([]);
    setProgress(0);
    setStatus("idle");
  };

  const sevColor: Record<Severity, string> = {
    PASS: "text-primary",
    FAIL: "text-destructive",
    WARN: "text-yellow-400",
    SCAN: "text-foreground",
    INIT: "text-primary",
    DONE: "text-primary",
  };

  return (
    <div className="bg-background text-foreground min-h-screen">
      <SimpleNav />
      <section className="pt-12 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <span className="font-mono text-xs uppercase tracking-widest text-primary">// Live engine</span>
            <h1 className="font-display text-[clamp(3rem,8vw,7rem)] uppercase leading-[0.9] tracking-tighter mt-2">
              Run a <span className="text-primary">scan.</span>
            </h1>
          </div>

          <div className="ring-1 ring-border rounded-xl overflow-hidden bg-card">
            <div className="h-10 border-b border-border px-4 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="size-2.5 rounded-full bg-foreground/15" />
                <div className="size-2.5 rounded-full bg-foreground/15" />
                <div className={`size-2.5 rounded-full ${status === "running" ? "bg-primary animate-pulse" : status === "done" ? "bg-primary" : "bg-foreground/15"}`} />
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                scanr ~ {target || "prod-cluster-01"} ~ {status}
              </div>
            </div>

            <div className="p-6 border-b border-border flex flex-col md:flex-row gap-3">
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="domain.com  ·  aws-account-id  ·  github-org"
                disabled={status === "running"}
                className="flex-1 bg-background border border-border rounded px-4 py-3 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary disabled:opacity-50"
              />
              {status !== "running" && status !== "done" && (
                <button onClick={start} className="bg-primary text-primary-foreground px-6 py-3 font-mono text-xs uppercase tracking-widest hover:brightness-110 transition-all">
                  Deploy Scan →
                </button>
              )}
              {status === "running" && (
                <button disabled className="bg-foreground/15 text-foreground px-6 py-3 font-mono text-xs uppercase tracking-widest">
                  Scanning {progress}%
                </button>
              )}
              {status === "done" && (
                <>
                  <button onClick={exportReport} className="bg-primary text-primary-foreground px-6 py-3 font-mono text-xs uppercase tracking-widest hover:brightness-110 transition-all">
                    Export JSON
                  </button>
                  <button onClick={reset} className="border border-border px-6 py-3 font-mono text-xs uppercase tracking-widest hover:bg-card transition-all">
                    Reset
                  </button>
                </>
              )}
            </div>

            <div className="grid md:grid-cols-[1fr_1.4fr] gap-px bg-border">
              <div className="bg-card p-10 space-y-8 min-h-[480px]">
                <div className="space-y-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Compliance Score</div>
                  <div className="flex items-end gap-6">
                    <div className="size-36 rounded-full border-[10px] border-primary flex items-center justify-center font-display text-5xl">
                      {summary.score || "—"}
                    </div>
                    <div className="space-y-2 pb-2 w-full">
                      <div className="h-2 bg-foreground/10 rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="font-mono text-[10px] uppercase text-muted-foreground">{progress}% complete</div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Pass" value={summary.pass} accent="text-primary" />
                  <Stat label="Warn" value={summary.warn} accent="text-yellow-400" />
                  <Stat label="Fail" value={summary.fail} accent="text-destructive" />
                </div>
                <div className="border-t border-border pt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground space-y-1">
                  <div>// Hint: try a real domain — the engine simulates a connector handshake.</div>
                </div>
              </div>

              <div className="bg-card p-10">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
                  Scan Log
                </div>
                <div ref={logRef} className="space-y-2 font-mono text-xs max-h-[420px] overflow-y-auto pr-2">
                  {feed.length === 0 && <div className="text-muted-foreground">Awaiting scan deployment…</div>}
                  {feed.map((l) => (
                    <div key={l.id} className="flex gap-3 border-b border-border/50 pb-1.5">
                      <span className="text-muted-foreground shrink-0">[{l.ts}]</span>
                      <span className={`${sevColor[l.severity]} font-medium shrink-0 w-12`}>{l.severity}</span>
                      <span className="text-foreground/80">
                        <span className="text-primary">{l.framework}</span>
                        {l.control !== "—" && <span className="text-muted-foreground"> · {l.control}</span>} · {l.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="p-3 border border-border rounded">
      <div className="font-mono text-[9px] uppercase text-muted-foreground">{label}</div>
      <div className={`font-display text-3xl mt-1 ${accent}`}>{value}</div>
    </div>
  );
}

export function SimpleNav() {
  return (
    <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-display text-2xl tracking-tighter uppercase">
          Scanr<span className="text-primary">.</span>
        </Link>
        <div className="hidden md:flex gap-8 font-mono text-xs uppercase tracking-widest">
          <Link to="/scan" className="hover:text-primary transition-colors" activeProps={{ className: "text-primary" }}>Scan</Link>
          <Link to="/frameworks/$slug" params={{ slug: "soc2" }} className="hover:text-primary transition-colors">Frameworks</Link>
          <Link to="/contact" className="hover:text-primary transition-colors">Contact</Link>
        </div>
        <Link to="/scan" className="bg-primary text-primary-foreground px-5 py-2 text-xs font-mono uppercase tracking-tighter hover:brightness-110 transition-all">
          Deploy Scan
        </Link>
      </div>
    </nav>
  );
}
