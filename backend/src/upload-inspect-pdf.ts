import fs from "node:fs";

export type PdfThreatKind =
  | "javascript"
  | "open_action"
  | "additional_actions"
  | "launch"
  | "embedded_file"
  | "rich_media";

export interface PdfInspectionResult {
  safe: boolean;
  threats: PdfThreatKind[];
}

const PDF_THREAT_PATTERNS: Array<{ kind: PdfThreatKind; patterns: RegExp[] }> = [
  {
    kind: "javascript",
    patterns: [/\/JavaScript\b/i, /\/JS\b/i, /\/S\s*\/JavaScript/i],
  },
  {
    kind: "open_action",
    patterns: [/\/OpenAction\b/i],
  },
  {
    kind: "additional_actions",
    patterns: [/\/AA\b/i],
  },
  {
    kind: "launch",
    patterns: [/\/Launch\b/i],
  },
  {
    kind: "embedded_file",
    patterns: [/\/EmbeddedFile\b/i, /\/EmbeddedFiles\b/i, /\/FileAttachment\b/i],
  },
  {
    kind: "rich_media",
    patterns: [/\/RichMedia\b/i, /\/Movie\b/i, /\/Sound\b/i],
  },
];

/** Features that require Ghostscript sanitization before storage. */
const PDF_SANITIZE_TRIGGERS = new Set<PdfThreatKind>([
  "javascript",
  "additional_actions",
  "launch",
  "embedded_file",
  "rich_media",
]);

/**
 * Dangerous features that must be absent after Ghostscript.
 * OpenAction markers are excluded — Ghostscript often leaves benign ones (e.g. open-to-page).
 */
const PDF_POST_SANITIZE_BLOCKERS = new Set<PdfThreatKind>([
  "javascript",
  "additional_actions",
  "launch",
  "embedded_file",
]);

/** Inspect PDF for active/dangerous content (pre-sanitization). */
export function inspectPdfSecurity(filePath: string): PdfInspectionResult {
  const content = fs.readFileSync(filePath).toString("latin1");
  const threats = new Set<PdfThreatKind>();

  for (const { kind, patterns } of PDF_THREAT_PATTERNS) {
    if (patterns.some((re) => re.test(content))) {
      threats.add(kind);
    }
  }

  const threatList = [...threats];
  return {
    safe: !threatList.some((kind) => PDF_SANITIZE_TRIGGERS.has(kind)),
    threats: threatList,
  };
}

/** Only executable/active PDF features require Ghostscript (not bare OpenAction). */
export function pdfRequiresSanitization(result: PdfInspectionResult): boolean {
  return result.threats.some((kind) => PDF_SANITIZE_TRIGGERS.has(kind));
}

/** Post-sanitization: block only features that must be fully removed by Ghostscript. */
export function assertSanitizedPdfIsSafe(filePath: string): void {
  const result = inspectPdfSecurity(filePath);
  const remaining = result.threats.filter((kind) => PDF_POST_SANITIZE_BLOCKERS.has(kind));
  if (remaining.length > 0) {
    throw new Error(`Sanitized PDF still contains active content: ${remaining.join(",")}`);
  }
}
