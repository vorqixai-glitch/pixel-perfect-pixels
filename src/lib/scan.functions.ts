import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Severity = "PASS" | "FAIL" | "WARN" | "SCAN" | "INIT" | "DONE";
export type Finding = {
  id: string;
  ts: string;
  framework: "SOC 2" | "HIPAA" | "GDPR" | "PCI" | "ISO 27001";
  control: string;
  severity: Severity;
  message: string;
};

function nowStamp(offsetMs: number) {
  const d = new Date(Date.now() + offsetMs);
  return d.toTimeString().slice(0, 8);
}

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

/**
 * Runs a compliance scan handshake on the server.
 * Simulates connector validation, target resolution, and service-health checks.
 * Returns the full set of findings so the client can stream them.
 */
export const runScan = createServerFn({ method: "POST" })
  .inputValidator(z.object({ target: z.string() }))
  .handler(async ({ data }) => {
    const { target } = data;

    // Controlled failure modes for testing error UX
    if (target === "service-down.scanr.test") {
      throw new Error("Scan service temporarily unavailable. Incident ID: #SRV-503");
    }
    if (target === "network-error.scanr.test") {
      throw new Error("Connection reset while establishing TLS handshake with scan engine");
    }

    // Simulate connector handshake latency (DNS + TCP + TLS + health probe)
    await new Promise((r) => setTimeout(r, 700));

    // Simulate target-specific processing delay
    if (/^(localhost|127\.|0\.0\.0\.0)/i.test(target)) {
      throw new Error(`Unable to reach ${target} — connector handshake refused. Check the target is publicly resolvable and try again.`);
    }

    // Build findings with server-side timestamps
    const findings: Finding[] = CHECKS.map((c) => ({
      ...c,
      id: crypto.randomUUID(),
      ts: nowStamp(0),
    }));

    return { target, findings, total: findings.length };
  });
