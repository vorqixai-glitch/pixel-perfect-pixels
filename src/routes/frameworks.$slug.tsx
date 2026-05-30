import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SimpleNav } from "./scan";

type FrameworkData = {
  slug: string;
  code: string;
  title: string;
  blurb: string;
  controls: { id: string; name: string; status: "PASS" | "WARN" | "FAIL" }[];
};

const FRAMEWORKS: Record<string, FrameworkData> = {
  soc2: {
    slug: "soc2",
    code: "01 / SOC 2",
    title: "Continuous Audit",
    blurb: "Real-time technical evidence collection across AWS, GCP, and Azure environments. Continuous monitoring of CC1-CC9 trust services criteria.",
    controls: [
      { id: "CC6.1", name: "Logical & physical access controls", status: "PASS" },
      { id: "CC6.6", name: "Encryption of data in transit", status: "PASS" },
      { id: "CC7.2", name: "System monitoring & anomaly detection", status: "PASS" },
      { id: "CC8.1", name: "Change management procedures", status: "WARN" },
    ],
  },
  hipaa: {
    slug: "hipaa",
    code: "02 / HIPAA",
    title: "PHI Guard",
    blurb: "Automated encryption checks, access log verification, and BAA tracking for sensitive health data under the Security & Privacy rules.",
    controls: [
      { id: "164.312(a)(1)", name: "Access control to ePHI systems", status: "PASS" },
      { id: "164.312(a)(2)(iv)", name: "Encryption at rest", status: "PASS" },
      { id: "164.312(b)", name: "Audit controls & logging", status: "PASS" },
      { id: "164.312(e)(1)", name: "Transmission security", status: "WARN" },
    ],
  },
  gdpr: {
    slug: "gdpr",
    code: "03 / GDPR",
    title: "Data Sovereignty",
    blurb: "Map data residency, document cross-border transfers, and maintain Art. 30 records of processing activities automatically.",
    controls: [
      { id: "Art. 30", name: "Records of processing activities", status: "PASS" },
      { id: "Art. 32", name: "Security of processing", status: "WARN" },
      { id: "Art. 33", name: "Breach notification within 72h", status: "PASS" },
      { id: "Art. 44", name: "Lawful basis for transfers", status: "FAIL" },
    ],
  },
  pci: {
    slug: "pci",
    code: "04 / PCI-DSS",
    title: "Cardholder Defense",
    blurb: "PCI-DSS v4.0 readiness scanning across network segmentation, key management, vulnerability scanning, and MFA enforcement.",
    controls: [
      { id: "1.2.1", name: "Network segmentation & perimeter rules", status: "FAIL" },
      { id: "3.5", name: "Cryptographic key management", status: "PASS" },
      { id: "8.3", name: "Multi-factor authentication", status: "FAIL" },
      { id: "11.3", name: "Penetration testing schedule", status: "PASS" },
    ],
  },
};

export const Route = createFileRoute("/frameworks/$slug")({
  loader: ({ params }): FrameworkData => {
    const f = FRAMEWORKS[params.slug];
    if (!f) throw notFound();
    return f;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.code ?? "Framework"} — ComplianceScanr` },
      { name: "description", content: loaderData?.blurb ?? "Compliance framework details." },
    ],
  }),
  notFoundComponent: () => (
    <div className="bg-background text-foreground min-h-screen">
      <SimpleNav />
      <div className="max-w-3xl mx-auto px-6 py-32 text-center">
        <h1 className="font-display text-6xl uppercase">Not found</h1>
        <Link to="/" className="font-mono text-xs uppercase tracking-widest text-primary mt-6 inline-block">← Back home</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="bg-background text-foreground min-h-screen">
      <SimpleNav />
      <div className="max-w-3xl mx-auto px-6 py-32">
        <h1 className="font-display text-4xl uppercase">Error</h1>
        <p className="font-mono text-sm mt-4 text-destructive">{error.message}</p>
      </div>
    </div>
  ),
  component: FrameworkPage,
});

function FrameworkPage() {
  const f = Route.useLoaderData();
  const statusColor = { PASS: "text-primary", WARN: "text-yellow-400", FAIL: "text-destructive" };
  const others = Object.values(FRAMEWORKS).filter((x) => x.slug !== f.slug);

  return (
    <div className="bg-background text-foreground min-h-screen">
      <SimpleNav />
      <section className="pt-12 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <Link to="/" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary">
            ← Index
          </Link>
          <span className="font-mono text-xs uppercase tracking-widest text-primary block mt-8 underline decoration-2 underline-offset-4">
            {f.code}
          </span>
          <h1 className="font-display text-[clamp(3rem,9vw,8rem)] uppercase leading-[0.85] tracking-tighter mt-4">
            {f.title}
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground mt-8 leading-relaxed">{f.blurb}</p>

          <div className="mt-16 ring-1 ring-border rounded-xl bg-card overflow-hidden">
            <div className="px-8 py-5 border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Live control coverage
            </div>
            <div className="divide-y divide-border">
              {f.controls.map((c) => (
                <div key={c.id} className="px-8 py-5 flex items-center justify-between gap-6">
                  <div>
                    <div className="font-mono text-xs text-primary">{c.id}</div>
                    <div className="font-display text-2xl uppercase mt-1">{c.name}</div>
                  </div>
                  <span className={`font-mono text-xs uppercase tracking-widest ${statusColor[c.status]}`}>{c.status}</span>
                </div>
              ))}
            </div>
            <div className="p-8 border-t border-border flex flex-col md:flex-row gap-4">
              <Link to="/scan" className="bg-primary text-primary-foreground px-6 py-3 font-mono text-xs uppercase tracking-widest hover:brightness-110">
                Run scan against this framework →
              </Link>
              <Link to="/contact" className="border border-border px-6 py-3 font-mono text-xs uppercase tracking-widest hover:bg-card">
                Talk to compliance team
              </Link>
            </div>
          </div>

          <div className="mt-20">
            <div className="font-mono text-xs uppercase tracking-widest text-primary mb-6">// Other frameworks</div>
            <div className="grid md:grid-cols-3 gap-px bg-border border border-border">
              {others.map((o) => (
                <Link
                  key={o.slug}
                  to="/frameworks/$slug"
                  params={{ slug: o.slug }}
                  className="bg-background p-8 hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <span className="font-mono text-xs underline decoration-2 underline-offset-4">{o.code}</span>
                  <h3 className="font-display text-3xl uppercase mt-4 leading-none">{o.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
