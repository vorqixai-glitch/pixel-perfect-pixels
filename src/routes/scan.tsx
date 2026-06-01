import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { runScan, type Finding, type Severity } from "@/lib/scan.functions";

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

const TARGET_RE = /^([a-z0-9-]+\.)+[a-z]{2,}$|^[0-9]{12}$|^[a-zA-Z0-9_.-]{2,}$/i;
const SCAN_TIMEOUT_MS = 15000;

function validateTarget(raw: string): string | null {
  const t = raw.trim();
  if (!t) return "Enter a domain, AWS account ID, or GitHub org to scan.";
  if (t.length < 3) return "Target is too short — must be at least 3 characters.";
  if (t.length > 253) return "Target is too long.";
  if (/\s/.test(t)) return "Target cannot contain spaces.";
  if (!TARGET_RE.test(t)) return "Invalid format. Try a domain like acme.com, a 12-digit AWS account, or a GitHub org.";
  return null;
}

type ScanErrorType = "timeout" | "network" | "service" | "validation" | "unknown";

interface ScanError {
  type: ScanErrorType;
  message: string;
  retryable: boolean;
}

function classifyError(err: unknown): ScanError {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("timed out") || msg.includes("TIMEOUT") || msg.includes("AbortError") || msg.includes("timeout")) {
    return { type: "timeout", message: "The scan engine timed out — the service may be overloaded or unreachable.", retryable: true };
  }
  if (msg.includes("temporarily unavailable") || msg.includes("#SRV-503") || msg.includes("unavailable")) {
    return { type: "service", message: msg, retryable: true };
  }
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed to fetch") || msg.includes("Connection reset") || msg.includes("TLS handshake")) {
    return { type: "network", message: "Network error — unable to reach the scan engine. Check your connection and try again.", retryable: true };
  }
  if (msg.includes("connector handshake refused") || msg.includes("localhost") || msg.includes("0.0.0.0")) {
    return { type: "validation", message: msg, retryable: false };
  }
  return { type: "unknown", message: msg || "An unexpected error occurred during the scan.", retryable: true };
}

function ScanPage() {
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<"idle" | "validating" | "running" | "done" | "error">("idle");
  const [feed, setFeed] = useState<Finding[]>([]);
  const [progress, setProgress] = useState(0);
  const [scanError, setScanError] = useState<ScanError | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const cleanup = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const runDemoScan = useCallback((t: string) => {
    setDemoMode(true);
    setScanError(null);
    setValidationError(null);
    setFeed([
      { id: crypto.randomUUID(), ts: nowStamp(0), framework: "SOC 2", control: "—", severity: "INIT", message: `Initializing demo scan for ${t}` },
    ]);
    setProgress(0);
    setStatus("running");
  }, []);

  const start = useCallback(async () => {
    const err = validateTarget(target);
    if (err) {
      setValidationError(err);
      setStatus("error");
      setScanError({ type: "validation", message: err, retryable: false });
      return;
    }
    setValidationError(null);
    setScanError(null);
    setDemoMode(false);
    setRetryCount(0);
    const t = target.trim();

    setStatus("validating");
    cleanup();

    const controller = new AbortController();
    abortRef.current = controller;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, SCAN_TIMEOUT_MS);

    try {
      const result = await Promise.race([
        runScan({ data: { target: t } }),
        new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(new Error("TIMEOUT")), SCAN_TIMEOUT_MS);
          controller.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new Error("TIMEOUT"));
          });
        }),
      ]);
      clearTimeout(timeoutId);
      if (controller.signal.aborted) {
        throw new Error("TIMEOUT");
      }

      setFeed([
        { id: crypto.randomUUID(), ts: nowStamp(0), framework: "SOC 2", control: "—", severity: "INIT", message: `Initializing handshake with ${result.target}` },
      ]);
      setProgress(0);
      setStatus("running");
    } catch (err) {
      clearTimeout(timeoutId);
      const classified = classifyError(err);
      setScanError(classified);
      setStatus("error");
    }
  }, [target, cleanup]);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
    start();
  }, [start]);

  useEffect(() => {
    if (status !== "running") return;
    let i = 0;
    const allChecks = feed.length > 0 ? feed.slice(1) : [];
    const id = setInterval(() => {
      if (i >= allChecks.length) {
        setFeed((f) => [
          ...f,
          { id: crypto.randomUUID(), ts: nowStamp(0), framework: "SOC 2", control: "—", severity: "DONE", message: demoMode ? "Demo scan complete · report generated" : "Scan complete · report generated" },
        ]);
        setProgress(100);
        setStatus("done");
        clearInterval(id);
        return;
      }
      const c = allChecks[i];
      setFeed((f) => [...f, { ...c, id: crypto.randomUUID(), ts: nowStamp(0) }]);
      setProgress(Math.round(((i + 1) / allChecks.length) * 100));
      i++;
    }, 420);
    return () => clearInterval(id);
  }, [status, feed, demoMode]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [feed]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

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
    cleanup();
    setFeed([]);
    setProgress(0);
    setStatus("idle");
    setScanError(null);
    setValidationError(null);
    setDemoMode(false);
    setRetryCount(0);
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
                <div className={`size-2.5 rounded-full ${status === "error" ? "bg-destructive" : "bg-foreground/15"}`} />
                <div className={`size-2.5 rounded-full ${status === "validating" ? "bg-yellow-400 animate-pulse" : "bg-foreground/15"}`} />
                <div className={`size-2.5 rounded-full ${status === "running" ? "bg-primary animate-pulse" : status === "done" ? "bg-primary" : "bg-foreground/15"}`} />
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                scanr ~ {target || "prod-cluster-01"} ~ {status}{demoMode ? " · demo" : ""}
              </div>
            </div>

            <div className="p-6 border-b border-border flex flex-col gap-3">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <input
                    value={target}
                    onChange={(e) => {
                      setTarget(e.target.value);
                      if (validationError) setValidationError(null);
                      if (status === "error") { setStatus("idle"); setScanError(null); }
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" && status !== "running" && status !== "validating") start(); }}
                    onBlur={() => { if (validationError && !target.trim()) setValidationError(null); }}
                    placeholder="domain.com  ·  aws-account-id  ·  github-org"
                    disabled={status === "running" || status === "validating"}
                    aria-invalid={!!validationError}
                    aria-describedby={validationError ? "target-error" : scanError ? "scan-error" : undefined}
                    className={`w-full bg-background border rounded px-4 py-3 font-mono text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 ${validationError ? "border-destructive focus:border-destructive" : "border-border focus:border-primary"}`}
                  />
                  {validationError && (
                    <p id="target-error" role="alert" className="mt-2 font-mono text-[11px] text-destructive">
                      ✕ {validationError}
                    </p>
                  )}
                </div>
                {status === "idle" || status === "error" ? (
                  <button onClick={start} className="bg-primary text-primary-foreground px-6 py-3 font-mono text-xs uppercase tracking-widest hover:brightness-110 transition-all">
                    Deploy Scan →
                  </button>
                ) : null}
                {status === "validating" && (
                  <button disabled className="bg-foreground/15 text-foreground px-6 py-3 font-mono text-xs uppercase tracking-widest inline-flex items-center gap-2">
                    <span className="size-2 rounded-full bg-yellow-400 animate-pulse" />
                    Connecting…
                  </button>
                )}
                {status === "running" && (
                  <button disabled className="bg-foreground/15 text-foreground px-6 py-3 font-mono text-xs uppercase tracking-widest inline-flex items-center gap-2">
                    <span className="size-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
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

              {/* Error banner with fallback actions */}
              {status === "error" && scanError && !validationError && (
                <div
                  id="scan-error"
                  role="alert"
                  className={`border rounded px-4 py-3 font-mono text-xs flex flex-col gap-3 ${
                    scanError.type === "timeout" || scanError.type === "network"
                      ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-400"
                      : "border-destructive/60 bg-destructive/10 text-destructive"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="uppercase tracking-widest text-[10px] mb-1">
                        {scanError.type === "timeout" ? "Connection timed out" :
                         scanError.type === "network" ? "Network error" :
                         scanError.type === "service" ? "Service unavailable" :
                         "Scan failed"}
                      </div>
                      <div className="normal-case opacity-90">{scanError.message}</div>
                    </div>
                    {scanError.retryable && (
                      <button onClick={retry} className="shrink-0 border border-current px-3 py-1.5 uppercase tracking-widest text-[10px] hover:bg-current/10 transition-all">
                        Retry{retryCount > 0 ? ` (${retryCount})` : ""}
                      </button>
                    )}
                  </div>
                  {/* Fallback: run demo scan */}
                  <div className="border-t border-current/20 pt-2 flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-widest opacity-70">
                      Fallback:
                    </span>
                    <button
                      onClick={() => runDemoScan(target.trim())}
                      className="text-[10px] uppercase tracking-widest underline underline-offset-2 hover:opacity-80 transition-all"
                    >
                      Run demo scan offline →
                    </button>
                  </div>
                </div>
              )}

              {status === "validating" && (
                <div className="font-mono text-[11px] text-muted-foreground flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  Validating target and establishing connector handshake…
                  <span className="ml-auto text-[10px] opacity-60">Timeout in {Math.round(SCAN_TIMEOUT_MS / 1000)}s</span>
                </div>
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
                  <div>// Test errors: service-down.scanr.test · network-error.scanr.test · timeout.scanr.test</div>
                </div>
              </div>

              <div className="bg-card p-10">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
                  Scan Log {demoMode && <span className="text-yellow-400">· Demo Mode</span>}
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

function nowStamp(offsetMs: number) {
  const d = new Date(Date.now() + offsetMs);
  return d.toTimeString().slice(0, 8);
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
