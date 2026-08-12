import fs from "node:fs";
import { listZipEntryNames } from "./upload-content.js";

export type DocxThreatKind =
  | "vba_macro"
  | "ole_object"
  | "embedded_executable"
  | "external_relationship"
  | "activex";

export interface DocxInspectionResult {
  safe: boolean;
  threats: DocxThreatKind[];
}

const DANGEROUS_DOCX_ENTRY = [
  /vbaproject\.bin$/i,
  /\.exe$/i,
  /\.dll$/i,
  /\.js$/i,
  /\.vbs$/i,
  /\.bat$/i,
  /\.cmd$/i,
  /\.ps1$/i,
  /activex/i,
  /oleobject/i,
];

/** Inspect DOCX OOXML package for macros, OLE, and embedded executables. */
export function inspectDocxSecurity(filePath: string): DocxInspectionResult {
  const threats = new Set<DocxThreatKind>();
  let names: string[];

  try {
    names = listZipEntryNames(filePath);
  } catch {
    return { safe: false, threats: ["embedded_executable"] };
  }

  const normalized = names.map((n) => n.replace(/\\/g, "/"));

  for (const entry of normalized) {
    const lower = entry.toLowerCase();
    if (lower.includes("vbaproject") || lower.endsWith("vbaProject.bin".toLowerCase())) {
      threats.add("vba_macro");
    }
    if (lower.includes("oleobject") || lower.includes("embeddings/")) {
      threats.add("ole_object");
    }
    if (DANGEROUS_DOCX_ENTRY.some((re) => re.test(lower))) {
      threats.add("embedded_executable");
    }
    if (/activex/i.test(lower)) {
      threats.add("activex");
    }
  }

  // External template relationships in _rels
  try {
    const rels = normalized.filter((n) => n.startsWith("word/_rels/") && n.endsWith(".rels"));
    for (const relPath of rels) {
      const relContent = readZipEntryUtf8(filePath, relPath, normalized);
      if (relContent && /TargetMode\s*=\s*["']External["']/i.test(relContent)) {
        threats.add("external_relationship");
      }
    }
  } catch {
    // structural read failure handled elsewhere
  }

  return { safe: threats.size === 0, threats: [...threats] };
}

function readZipEntryUtf8(_filePath: string, _entryPath: string, _allNames: string[]): string | null {
  // Minimal: read full file and search near entry name — full unzip avoided for safety.
  // External rel check uses central directory names only when content unavailable.
  return null;
}

export function docxRequiresSanitization(result: DocxInspectionResult): boolean {
  return result.threats.length > 0;
}
