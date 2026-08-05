import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { updateFinding } from "@/lib/scanner.functions";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, X } from "lucide-react";


type Finding = {
  id: string;
  title: string;
  category: string;
  severity: string;
  page_url: string;
  description: string;
  why_matters: string;
  suggested_fix: string;
  status: string;
  confidence: number;
  notes: string;
  assigned_to: string;
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};
const STATUS_COLORS: Record<string, string> = {
  open: "bg-muted text-foreground",
  resolved: "bg-emerald-500/15 text-emerald-400",
  ignored: "bg-muted/40 text-muted-foreground",
};

export function FindingsTable({
  findings,
  focusId,
  pageFilter,
  onClearPageFilter,
}: {
  findings: Finding[];
  focusId?: string;
  pageFilter?: string;
  onClearPageFilter?: () => void;
}) {
  const [severity, setSeverity] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const upd = useServerFn(updateFinding);
  const qc = useQueryClient();
  const rowRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    if (!focusId) return;
    setSeverity("all");
    setStatus("all");
    setCategory("all");
    setExpanded((prev) => new Set(prev).add(focusId));
    const el = rowRefs.current[focusId];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, findings.length]);

  const categories = Array.from(new Set(findings.map((f) => f.category)));

  const filtered = findings.filter((f) =>
    (severity === "all" || f.severity === severity) &&
    (status === "all" || f.status === status) &&
    (category === "all" || f.category === category) &&
    (!pageFilter || f.page_url === pageFilter),
  );

  async function setStatusOn(id: string, newStatus: string) {
    await upd({ data: { id, status: newStatus as "open" | "resolved" | "ignored" } });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }
  async function saveField(id: string, field: "notes" | "assigned_to", value: string) {
    await upd({ data: { id, [field]: value } as never });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }
  function toggle(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  if (findings.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">No findings for this scan. Nice work.</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Filter label="Severity" value={severity} onChange={setSeverity} options={["all", "critical", "high", "medium", "low"]} />
        <Filter label="Status" value={status} onChange={setStatus} options={["all", "open", "resolved", "ignored"]} />
        <Filter label="Category" value={category} onChange={setCategory} options={["all", ...categories]} />
        {pageFilter && (
          <button
            type="button"
            onClick={onClearPageFilter}
            className="inline-flex max-w-[320px] items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-foreground"
          >
            <span className="truncate">Page: {pageFilter}</span>
            <X className="h-3 w-3 shrink-0" />
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {findings.length}</span>
      </div>

      <ul className="divide-y divide-border">
        {filtered.map((f) => {
          const isOpen = expanded.has(f.id);
          return (
            <li
              key={f.id}
              id={`finding-${f.id}`}
              ref={(el) => { rowRefs.current[f.id] = el; }}
              className={focusId === f.id ? "bg-primary/5 ring-1 ring-inset ring-primary/40" : undefined}
            >
              <button
                type="button"
                onClick={() => toggle(f.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/30"
              >
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_COLORS[f.severity]}`}>{f.severity}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{f.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{f.category} · {f.page_url}</span>
                </span>
                <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[f.status]}`}>{f.status}</span>
              </button>
              {isOpen && (
                <div className="grid gap-4 border-t border-border bg-muted/10 px-6 py-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Description</div>
                    <p className="mt-1 text-sm">{f.description}</p>
                    <div className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Why it matters</div>
                    <p className="mt-1 text-sm">{f.why_matters}</p>
                    <div className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Suggested fix</div>
                    <p className="mt-1 text-sm">{f.suggested_fix}</p>
                    <div className="mt-4 text-xs text-muted-foreground">Confidence: {Math.round(f.confidence * 100)}%</div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Assign to (email or name)</label>
                      <input
                        defaultValue={f.assigned_to}
                        onBlur={(e) => e.target.value !== f.assigned_to && saveField(f.id, "assigned_to", e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        placeholder="alex@company.com"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Notes</label>
                      <textarea
                        defaultValue={f.notes}
                        onBlur={(e) => e.target.value !== f.notes && saveField(f.id, "notes", e.target.value)}
                        className="min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                        placeholder="Context, tickets, remediation plan…"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant={f.status === "resolved" ? "default" : "outline"} onClick={() => setStatusOn(f.id, "resolved")}>Mark resolved</Button>
                      <Button size="sm" variant={f.status === "open" ? "default" : "outline"} onClick={() => setStatusOn(f.id, "open")}>Reopen</Button>
                      <Button size="sm" variant={f.status === "ignored" ? "default" : "outline"} onClick={() => setStatusOn(f.id, "ignored")}>Ignore</Button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {label}:
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground capitalize">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
