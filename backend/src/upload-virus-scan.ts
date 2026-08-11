import fs from "fs";
import net from "net";

const CHUNK_SIZE = 64 * 1024;
const DEFAULT_SCAN_TIMEOUT_MS = 120_000;

export function isClamAvEnabled(): boolean {
  return process.env.CLAMAV_ENABLED === "true";
}

/** Interpret clamd INSTREAM response text (no file I/O). */
export function interpretClamAvResponse(response: string): { clean: boolean; detail: string } {
  const detail = (response || "").trim() || "empty response";
  const clean = detail.endsWith("OK") && !detail.includes("FOUND");
  return { clean, detail };
}

function scanFileWithClamd(
  filePath: string,
  host: string,
  port: number,
  timeoutMs = DEFAULT_SCAN_TIMEOUT_MS
): Promise<{ clean: boolean; detail: string }> {
  return new Promise((resolve, reject) => {
    const responseChunks: Buffer[] = [];
    const socket = net.createConnection({ host, port }, () => {
      socket.write("zINSTREAM\0");

      const fd = fs.openSync(filePath, "r");
      try {
        const buffer = Buffer.alloc(CHUNK_SIZE);
        let bytesRead = 0;
        while ((bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, null)) > 0) {
          const lengthHeader = Buffer.alloc(4);
          lengthHeader.writeUInt32BE(bytesRead, 0);
          socket.write(lengthHeader);
          socket.write(buffer.subarray(0, bytesRead));
        }
      } finally {
        fs.closeSync(fd);
      }

      socket.write(Buffer.alloc(4));
    });

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("ClamAV scan timed out"));
    }, timeoutMs);

    socket.on("data", (chunk) => responseChunks.push(chunk));
    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    socket.on("end", () => {
      clearTimeout(timer);
      resolve(interpretClamAvResponse(Buffer.concat(responseChunks).toString("utf8")));
    });
  });
}

/**
 * Fail-closed malware gate.
 * - CLAMAV_ENABLED=true: scan required; malware/unavailable/timeout/error => reject
 * - production: CLAMAV_ENABLED must be true (never silently bypass)
 */
export async function assertUploadPassesMalwareScan(filePath: string): Promise<void> {
  const enabled = isClamAvEnabled();
  if (!enabled) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Malware scanning is required in production (CLAMAV_ENABLED=true)");
    }
    return;
  }

  const host = process.env.CLAMAV_HOST || "clamav";
  const port = parseInt(process.env.CLAMAV_PORT || "3310", 10);

  let result: { clean: boolean; detail: string };
  try {
    result = await scanFileWithClamd(filePath, host, port);
  } catch (err) {
    const message =
      err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ECONNREFUSED"
        ? "Malware scanner unavailable"
        : err instanceof Error
          ? err.message
          : "Malware scan unavailable";
    throw new Error(message);
  }

  if (!result.clean) {
    throw new Error("Uploaded file failed malware scan");
  }
}
