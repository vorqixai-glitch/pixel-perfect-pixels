import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ComplianceScanr — Absolute Integrity" },
      { name: "description", content: "Auto-scan your entire infrastructure for SOC 2, HIPAA, GDPR and PCI-DSS drift in real-time. No blind spots." },
      { property: "og:title", content: "ComplianceScanr — Absolute Integrity" },
      { property: "og:description", content: "Continuous compliance scanning for modern infrastructure." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="bg-background text-foreground min-h-screen selection:bg-primary selection:text-primary-foreground">
      <Nav />
      <Hero />
      <Marquee />
      <Frameworks />
      <HowItWorks />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-display text-2xl tracking-tighter uppercase">
          Scanr<span className="text-primary">.</span>
        </Link>
        <div className="hidden md:flex gap-8 font-mono text-xs uppercase tracking-widest">
          <a href="#engine" className="hover:text-primary transition-colors">Engine</a>
          <a href="#frameworks" className="hover:text-primary transition-colors">Frameworks</a>
          <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
          <Link to="/contact" className="hover:text-primary transition-colors">Contact</Link>
        </div>
        <Link to="/dashboard" className="bg-primary text-primary-foreground px-5 py-2 text-xs font-mono uppercase tracking-tighter hover:brightness-110 transition-all">
          Deploy Scan
        </Link>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="pt-20 pb-12 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-end justify-between mb-12 gap-8">
          <h1 className="font-display text-[clamp(4rem,12vw,12rem)] leading-[0.85] uppercase tracking-tighter animate-reveal">
            Absolute<br />
            <span className="text-primary">Integrity.</span>
          </h1>
          <p className="max-w-sm font-mono text-sm leading-relaxed mb-6 animate-reveal [animation-delay:200ms] text-muted-foreground">
            <span className="text-primary">(01)</span> AUTO-SCAN YOUR ENTIRE INFRASTRUCTURE FOR SOC 2, HIPAA, GDPR &amp; PCI-DSS DRIFT IN REAL-TIME. NO BLIND SPOTS.
          </p>
        </div>

        <DashboardMock />
      </div>
    </section>
  );
}

function DashboardMock() {
  return (
    <Link to="/dashboard" className="block group relative animate-reveal [animation-delay:400ms] ring-1 ring-border rounded-xl overflow-hidden bg-card hover:ring-primary transition-all">
      <div className="h-10 border-b border-border px-4 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="size-2.5 rounded-full bg-foreground/15" />
          <div className="size-2.5 rounded-full bg-foreground/15" />
          <div className="size-2.5 rounded-full bg-primary" />
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          scanr ~ prod-cluster-01 ~ live
        </div>
        <div className="ml-auto font-mono text-[10px] uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Open engine →
        </div>
      </div>
      <div className="grid md:grid-cols-[1fr_1.2fr] gap-px bg-border">
        <div className="bg-card p-10 flex flex-col justify-between min-h-[420px]">
          <div className="space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Compliance Score</div>
            <div className="flex items-end gap-6">
              <div className="size-36 rounded-full border-[10px] border-primary flex items-center justify-center font-display text-5xl">
                98.4
              </div>
              <div className="space-y-2 pb-2">
                <div className="h-2 w-40 bg-primary rounded-full animate-bar" />
                <div className="h-2 w-32 bg-foreground/15 rounded-full animate-bar [animation-delay:150ms]" />
                <div className="h-2 w-24 bg-foreground/15 rounded-full animate-bar [animation-delay:300ms]" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 mt-8">
            {["SOC 2", "HIPAA", "GDPR", "PCI"].map((f, i) => (
              <div key={f} className="p-3 border border-border rounded">
                <div className="font-mono text-[9px] uppercase text-primary">{f}</div>
                <div className="font-display text-xl mt-1">{[99, 97, 100, 96][i]}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card p-10">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
            Scan Log · 09:21:04
          </div>
          <div className="space-y-2 font-mono text-xs">
            {[
              { t: "09:21:04", k: "INIT", c: "text-primary", m: "Initializing infrastructure handshake" },
              { t: "09:21:05", k: "SCAN", c: "text-foreground", m: "Analyzing PCI-DSS Requirement 1.2.1" },
              { t: "09:21:08", k: "FAIL", c: "text-destructive", m: "SG-0822 inbound rule open to 0.0.0.0/0" },
              { t: "09:21:09", k: "SCAN", c: "text-foreground", m: "Mapping SOC 2 CC6.1 access controls" },
              { t: "09:21:10", k: "PASS", c: "text-primary", m: "Encryption at rest verified across 184 buckets" },
              { t: "09:21:11", k: "DONE", c: "text-primary", m: "Scan complete · 1 critical · 3 medium" },
            ].map((l) => (
              <div key={l.t} className="flex gap-3 border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground shrink-0">[{l.t}]</span>
                <span className={`${l.c} font-medium shrink-0 w-12`}>{l.k}</span>
                <span className="text-foreground/80">{l.m}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

function Marquee() {
  const items = ["SOC 2 TYPE II", "HIPAA", "GDPR", "PCI-DSS v4.0", "ISO 27001", "NIST 800-53", "CCPA", "FedRAMP"];
  const row = [...items, ...items];
  return (
    <section className="border-y border-border py-6 overflow-hidden bg-background">
      <div className="flex gap-12 animate-marquee whitespace-nowrap">
        {row.map((s, i) => (
          <span key={i} className="font-display text-3xl uppercase tracking-tight flex items-center gap-12">
            {s}
            <span className="size-2 bg-primary rounded-full" />
          </span>
        ))}
      </div>
    </section>
  );
}

function Frameworks() {
  const fws = [
    { slug: "soc2", n: "01 / SOC 2", t: "Continuous Audit", d: "Real-time technical evidence collection across AWS, GCP, and Azure environments." },
    { slug: "hipaa", n: "02 / HIPAA", t: "PHI Guard", d: "Automated encryption checks and access log verification for sensitive health data." },
    { slug: "gdpr", n: "03 / GDPR", t: "Data Sovereignty", d: "Map data residency and cross-border transfers to ensure strict EU regulatory alignment." },
  ];
  return (
    <section id="frameworks" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border">
          {fws.map((f) => (
            <Link
              key={f.slug}
              to="/frameworks/$slug"
              params={{ slug: f.slug }}
              className="bg-background p-12 group hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
            >
              <span className="font-mono text-xs text-primary group-hover:text-primary-foreground mb-8 block underline decoration-2 underline-offset-4">
                {f.n}
              </span>
              <h3 className="font-display text-4xl uppercase mb-4 leading-none">{f.t}</h3>
              <p className="text-sm opacity-70 leading-relaxed">{f.d}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", t: "Connect", d: "Wire in your AWS, Azure, GCP, GitHub and SaaS tools with read-only access in minutes." },
    { n: "02", t: "Scan", d: "Engine maps your infrastructure against 1,200+ regulatory controls automatically." },
    { n: "03", t: "Fix", d: "Receive step-by-step guides and auto-fix scripts to resolve vulnerabilities immediately." },
  ];
  return (
    <section id="engine" className="py-24 px-6 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16 max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-widest text-primary">// The engine</span>
          <h2 className="font-display text-6xl uppercase leading-none mt-4">Zero to Audit-Ready in 24 hours.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-12">
          {steps.map((s) => (
            <div key={s.n} className="space-y-4 border-t border-border pt-6">
              <div className="font-display text-7xl text-primary leading-none">{s.n}</div>
              <h3 className="font-display text-3xl uppercase">{s.t}</h3>
              <p className="text-muted-foreground leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="py-24 px-6 bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-20">
        <div className="flex-1">
          <h2 className="font-display text-7xl uppercase leading-none mb-8">
            Scale your<br />defense.
          </h2>
          <p className="font-mono text-sm uppercase tracking-widest opacity-70">
            Transparent pricing for technical teams.
          </p>
        </div>
        <div className="flex-1 flex flex-col gap-6">
          <div className="border-b border-primary-foreground/20 pb-6 flex justify-between items-end">
            <div>
              <span className="block font-display text-3xl uppercase">Enterprise</span>
              <span className="text-xs font-mono uppercase opacity-70">For high-volume infrastructure</span>
            </div>
            <span className="font-display text-5xl tracking-tighter">
              $2.4k<span className="text-xl font-mono italic">/mo</span>
            </span>
          </div>
          <div className="border-b border-primary-foreground/20 pb-6 flex justify-between items-end opacity-60">
            <div>
              <span className="block font-display text-3xl uppercase">Startup</span>
              <span className="text-xs font-mono uppercase opacity-70">Up to 50 assets</span>
            </div>
            <span className="font-display text-5xl tracking-tighter">
              $499<span className="text-xl font-mono italic">/mo</span>
            </span>
          </div>
          <Link to="/contact" className="mt-4 w-full bg-background text-foreground font-display text-xl py-4 uppercase tracking-widest hover:bg-foreground hover:text-primary transition-colors text-center">
            Get Protected Now
          </Link>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-32 px-6 border-t border-border">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="font-display text-[clamp(3rem,9vw,8rem)] uppercase leading-[0.9] tracking-tighter">
          Pass your <span className="text-primary">next audit.</span>
        </h2>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mt-8">
          No credit card required · SOC 2 Type II report available
        </p>
        <Link to="/dashboard" className="inline-block mt-10 bg-primary text-primary-foreground font-display text-2xl px-12 py-5 uppercase tracking-widest hover:brightness-110 transition-all">
          Start Free Scan →
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-border">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 font-mono text-[10px] uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <div className="size-2 bg-primary" />
          <span>© 2026 Scanr Compliance Orchestration · Build 82.02.11</span>
        </div>
        <div className="flex gap-8">
          <Link to="/dashboard" className="hover:text-primary transition-colors">Scan</Link>
          <Link to="/contact" className="hover:text-primary transition-colors">Contact</Link>
          <Link to="/frameworks/$slug" params={{ slug: "soc2" }} className="hover:text-primary transition-colors">Frameworks</Link>
        </div>
      </div>
    </footer>
  );
}
