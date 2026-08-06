import fs from "fs";
import net from "net";

const CHUNK_SIZE = 64 * 1024;
const DEFAULT_SCAN_TIMEOUT_MS = 120_000;

function isClamAvEnabled(): boolean {
  return process.env.CLAMAV_ENABLED === "true";
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
      const response = Buffer.concat(responseChunks).toString("utf8").trim();
      const clean = response.endsWith("OK") && !response.includes("FOUND");
      resolve({ clean, detail: response || "empty response" });
    });
  });
}

/** Rejects uploads that fail ClamAV when CLAMAV_ENABLED=true (fail closed in production). */
export async function assertUploadPassesMalwareScan(filePath: string): Promise<void> {
  if (!isClamAvEnabled()) {
    return;
  }

  const host = process.env.CLAMAV_HOST || "clamav";
  const port = parseInt(process.env.CLAMAV_PORT || "3310", 10);

  try {
    const result = await scanFileWithClamd(filePath, host, port);
    if (!result.clean) {
      throw new Error("Uploaded file failed malware scan");
    }
  } catch (err) {
    if (process.env.NODE_ENV === "production") {
      const message =
        err instanceof Error && "code" in err && err.code === "ECONNREFUSED"
          ? "Malware scanner is starting up. Please retry the upload in a few minutes."
          : err instanceof Error
            ? err.message
            : "Malware scan unavailable";
      throw new Error(message);
    }
    console.warn("ClamAV scan skipped in non-production:", err);
  }
}
