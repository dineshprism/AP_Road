import fs from "node:fs";

export type PdfThreatKind =
  | "javascript"
  | "open_action"
  | "additional_actions"
  | "launch"
  | "embedded_file"
  | "rich_media"
  | "external_action";

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
  {
    kind: "external_action",
    patterns: [/\/URI\b/i, /\/GoToR\b/i, /\/SubmitForm\b/i],
  },
];

/** Inspect PDF for active/dangerous content (pre-sanitization). */
export function inspectPdfSecurity(filePath: string): PdfInspectionResult {
  const content = fs.readFileSync(filePath).toString("latin1");
  const threats = new Set<PdfThreatKind>();

  for (const { kind, patterns } of PDF_THREAT_PATTERNS) {
    if (patterns.some((re) => re.test(content))) {
      threats.add(kind);
    }
  }

  return {
    safe: threats.size === 0,
    threats: [...threats],
  };
}

/** Post-sanitization: active PDF features should be absent. */
export function assertSanitizedPdfIsSafe(filePath: string): void {
  const result = inspectPdfSecurity(filePath);
  const activeThreats = result.threats.filter(
    (t) => t !== "external_action" // benign links may remain in some PDFs
  );
  if (activeThreats.length > 0) {
    throw new Error(`Sanitized PDF still contains active content: ${activeThreats.join(",")}`);
  }
}
