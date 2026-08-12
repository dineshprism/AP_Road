export interface UploadSecurityLogEntry {
  timestamp: string;
  userId?: string;
  submissionId?: string;
  originalFilename: string;
  detectedMimeType: string;
  fileSizeBytes: number;
  scanResultPre?: string;
  scanResultPost?: string;
  sanitizationResult?: string;
  securityStatus: "APPROVED" | "REJECTED";
  reasonCode?: string;
  durationMs: number;
}

export function logUploadSecurityEvent(entry: UploadSecurityLogEntry): void {
  // Structured security audit log — never log file contents or API keys.
  console.info(
    JSON.stringify({
      event: "signed_copy_upload_security",
      ...entry,
    })
  );
}
