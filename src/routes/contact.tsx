import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SimpleNav } from "./scan";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — ComplianceScanr" },
      { name: "description", content: "Talk to our compliance engineering team." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const prev = JSON.parse(localStorage.getItem("scanr-contacts") || "[]");
    localStorage.setItem("scanr-contacts", JSON.stringify([...prev, { ...form, at: new Date().toISOString() }]));
    setSent(true);
  };

  return (
    <div className="bg-background text-foreground min-h-screen">
      <SimpleNav />
      <section className="pt-12 pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          <span className="font-mono text-xs uppercase tracking-widest text-primary">// 04 Contact</span>
          <h1 className="font-display text-[clamp(3rem,9vw,7rem)] uppercase leading-[0.9] tracking-tighter mt-2">
            Talk to <span className="text-primary">engineering.</span>
          </h1>

          {sent ? (
            <div className="mt-12 ring-1 ring-primary rounded-xl p-12 bg-card text-center space-y-4">
              <div className="font-mono text-xs uppercase tracking-widest text-primary">// Transmission received</div>
              <h2 className="font-display text-4xl uppercase">We&apos;ll respond within 4 hours.</h2>
              <p className="text-muted-foreground text-sm">Your message is queued. A compliance engineer will reach out at {form.email || "your email"}.</p>
              <Link to="/scan" className="inline-block mt-4 bg-primary text-primary-foreground px-6 py-3 font-mono text-xs uppercase tracking-widest hover:brightness-110">
                Run a scan in the meantime →
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-12 ring-1 ring-border rounded-xl bg-card p-8 space-y-5">
              <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <Field label="Work email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
              <Field label="Company" value={form.company} onChange={(v) => setForm({ ...form, company: v })} required />
              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">What do you need to comply with?</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full bg-background border border-border rounded px-4 py-3 font-mono text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <button type="submit" className="w-full bg-primary text-primary-foreground font-display text-xl py-4 uppercase tracking-widest hover:brightness-110 transition-all">
                Transmit →
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background border border-border rounded px-4 py-3 font-mono text-sm focus:outline-none focus:border-primary"
      />
    </div>
  );
}
