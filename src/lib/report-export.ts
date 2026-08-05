// Client-side export helpers for the security issues report.
// Produces CSV and PDF artifacts containing internal_id, severity, evidence,
// and resolution details for every finding in scope.

export type ExportFinding = {
  id: string;
  scan_id: string;
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
  created_at: string;
  updated_at: string;
};

export type ExportScan = {
  id: string;
  target: string;
  framework: string;
  score: number;
  created_at: string;
};

const CATEGORY_CODE: Record<string, string> = {
  accessibility: "ACC",
  privacy: "PRV",
  cookies: "CNS",
  security: "SEC",
  legal: "LGL",
  forms: "FRM",
  trust: "TRS",
};

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Stable, human-readable identifier used in exported reports and audit trails. */
export function internalId(f: { id: string; category: string }): string {
  const code = CATEGORY_CODE[f.category] || f.category.slice(0, 3).toUpperCase();
  return `CSR-${code}-${f.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function evidenceText(f: ExportFinding): string {
  return [
    f.description,
    `Page: ${f.page_url}`,
    `Detection confidence: ${Math.round(Number(f.confidence) * 100)}%`,
    `First detected: ${new Date(f.created_at).toLocaleString()}`,
  ].join(" | ");
}

export function resolutionText(f: ExportFinding): string {
  const owner = f.assigned_to?.trim() ? f.assigned_to.trim() : "Unassigned";
  const notes = f.notes?.trim() ? f.notes.trim() : "No remediation notes recorded";
  return [
    `Status: ${f.status}`,
    `Owner: ${owner}`,
    `Remediation: ${f.suggested_fix}`,
    `Notes: ${notes}`,
    `Last updated: ${new Date(f.updated_at).toLocaleString()}`,
  ].join(" | ");
}

export function sortForReport(findings: ExportFinding[]): ExportFinding[] {
  return [...findings].sort(
    (a, b) =>
      (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) ||
      a.category.localeCompare(b.category) ||
      a.title.localeCompare(b.title),
  );
}

const HEADERS = [
  "internal_id",
  "severity",
  "category",
  "title",
  "page_url",
  "status",
  "assigned_to",
  "confidence",
  "evidence",
  "why_it_matters",
  "resolution",
  "first_detected",
  "last_updated",
] as const;

export function buildCsv(findings: ExportFinding[], scanLabel: string): string {
  const rows = sortForReport(findings).map((f) => [
    internalId(f),
    f.severity,
    f.category,
    f.title,
    f.page_url,
    f.status,
    f.assigned_to || "Unassigned",
    `${Math.round(Number(f.confidence) * 100)}%`,
    evidenceText(f),
    f.why_matters,
    resolutionText(f),
    new Date(f.created_at).toISOString(),
    new Date(f.updated_at).toISOString(),
  ]);
  const meta = [
    [`# Security issues report`],
    [`# Scope: ${scanLabel}`],
    [`# Generated: ${new Date().toISOString()}`],
    [`# Findings: ${rows.length}`],
    [],
  ];
  const esc = (c: string) => `"${String(c).replace(/"/g, '""')}"`;
  return [...meta.map((r) => r.map(esc).join(",")), [...HEADERS].map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(findings: ExportFinding[], scanLabel: string, filename: string) {
  download(new Blob([buildCsv(findings, scanLabel)], { type: "text/csv;charset=utf-8" }), filename);
}

const SEVERITY_FILL: Record<string, [number, number, number]> = {
  critical: [185, 28, 28],
  high: [194, 65, 12],
  medium: [161, 98, 7],
  low: [29, 78, 216],
};

export async function downloadPdf(
  findings: ExportFinding[],
  scan: { target: string; framework: string; score: number } | null,
  scanLabel: string,
  filename: string,
) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableMod.default;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const sorted = sortForReport(findings);
  const counts = {
    critical: sorted.filter((f) => f.severity === "critical").length,
    high: sorted.filter((f) => f.severity === "high").length,
    medium: sorted.filter((f) => f.severity === "medium").length,
    low: sorted.filter((f) => f.severity === "low").length,
  };
  const open = sorted.filter((f) => f.status === "open").length;
  const resolved = sorted.filter((f) => f.status === "resolved").length;

  doc.setFontSize(18);
  doc.text("Security issues report", 40, 46);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Scope: ${scanLabel}`, 40, 66);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 80);
  if (scan) {
    doc.text(`Framework: ${scan.framework}   ·   Risk score: ${Number(scan.score)}/100`, 40, 94);
  }
  doc.text(
    `Findings: ${sorted.length}   ·   Critical ${counts.critical}   ·   High ${counts.high}   ·   Medium ${counts.medium}   ·   Low ${counts.low}   ·   Open ${open}   ·   Resolved ${resolved}`,
    40,
    scan ? 108 : 94,
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: scan ? 124 : 110,
    head: [["Internal ID", "Severity", "Issue", "Evidence", "Resolution"]],
    body: sorted.map((f) => [
      internalId(f),
      f.severity.toUpperCase(),
      `${f.title}\nCategory: ${f.category}`,
      evidenceText(f).replace(/ \| /g, "\n"),
      resolutionText(f).replace(/ \| /g, "\n"),
    ]),
    styles: { fontSize: 7.5, cellPadding: 4, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: [17, 17, 17], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 86, fontStyle: "bold" },
      1: { cellWidth: 48, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 148 },
      3: { cellWidth: 240 },
      4: { cellWidth: 240 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const sev = String(data.cell.raw).toLowerCase();
        const fill = SEVERITY_FILL[sev];
        if (fill) {
          data.cell.styles.textColor = fill;
        }
      }
    },
    didDrawPage: () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(140);
      doc.text(
        "Automated compliance risk analysis. Indicative only — not a determination of legal compliance.",
        40,
        doc.internal.pageSize.getHeight() - 20,
      );
      doc.text(`Page ${page}`, doc.internal.pageSize.getWidth() - 60, doc.internal.pageSize.getHeight() - 20);
      doc.setTextColor(0);
    },
  });

  if (sorted.length === 0) {
    doc.setFontSize(11);
    doc.text("No findings recorded for this scope.", 40, 150);
  }

  download(doc.output("blob"), filename);
}
