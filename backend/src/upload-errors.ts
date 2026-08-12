export type UploadErrorCode =
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "MALWARE_DETECTED"
  | "UNSAFE_DOCUMENT"
  | "SANITIZATION_FAILED"
  | "SECURITY_SCAN_UNAVAILABLE";

export const UPLOAD_ERROR_MESSAGES: Record<UploadErrorCode, string> = {
  INVALID_FILE_TYPE: "Only PDF and DOCX files are allowed.",
  FILE_TOO_LARGE: "The file exceeds the maximum allowed size.",
  MALWARE_DETECTED: "The uploaded file failed security scanning and was rejected.",
  UNSAFE_DOCUMENT: "The uploaded document could not be safely processed and was rejected.",
  SANITIZATION_FAILED: "The document could not be safely processed and was rejected.",
  SECURITY_SCAN_UNAVAILABLE: "The document could not be processed at this time.",
};

export class UploadSecurityError extends Error {
  readonly code: UploadErrorCode;
  readonly httpStatus: number;

  constructor(code: UploadErrorCode, httpStatus = 400) {
    super(UPLOAD_ERROR_MESSAGES[code]);
    this.name = "UploadSecurityError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function uploadErrorResponse(code: UploadErrorCode) {
  return {
    success: false,
    code,
    message: UPLOAD_ERROR_MESSAGES[code],
  };
}
