import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import submissionRoutes from "./routes/submissions.js";
import adminRoutes from "./routes/admin.js";
import feedbackRoutes from "./routes/feedback.js";
import analyticsRoutes from "./routes/analytics.js";
import enhancedAnalyticsRoutes from "./routes/enhanced-analytics.js";
import analyticsProRoutes from "./routes/analytics-pro.js";
import ragGeminiRoutes from "./routes/rag-gemini.js";
import reportRoutes from "./routes/reports.js";
import { runMigrations } from "./migrate.js";
import { authMiddleware, AuthRequest } from "./auth.js";
import { csrfProtection } from "./csrf.js";
import { getUserRoles, MAPS_BROWSER_KEY_ROLES } from "./rbac.js";
import { contentTypeForUploadExt } from "./security-utils.js";
import { memoPdfFrameHeadersMiddleware, securityHeadersMiddleware } from "./security-headers.js";
import { getUserAccess } from "./rbac.js";
import { getSubmissionBySignedCopyPath } from "./db/submissions.repo.js";
import { isExemptFromGlobalApiRateLimit, rateLimitKeyGenerator } from "./rate-limit-utils.js";

import fs from "fs";
const serverEnvPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env");
if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath, override: true });
}

const app = express();
if (process.env.TRUST_PROXY === "true" || process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
const PORT = parseInt(process.env.PORT || "3000", 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const globalRateLimitMax = parseInt(process.env.GLOBAL_RATE_LIMIT_MAX || "1000000", 10);
const ragRateLimitMax = parseInt(process.env.RAG_RATE_LIMIT_MAX || "1000000", 10);

const isProduction = process.env.NODE_ENV === "production";

function getAllowedHosts(): Set<string> {
  const hosts = new Set(
    (process.env.ALLOWED_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
  if (!isProduction) {
    hosts.add("localhost");
    hosts.add("127.0.0.1");
    hosts.add(`localhost:${PORT}`);
    hosts.add(`127.0.0.1:${PORT}`);
  }
  return hosts;
}

const allowedHosts = getAllowedHosts();

// Reject unknown Host headers early (mitigates Host header injection).
app.use((req, res, next) => {
  const hostHeader = req.headers.host;
  if (!hostHeader) {
    res.status(400).json({ error: "Invalid Host header" });
    return;
  }

  const host = hostHeader.toLowerCase();
  const hostnameOnly = host.split(":")[0];

  if (allowedHosts.has(host) || allowedHosts.has(hostnameOnly)) {
    next();
    return;
  }

  // Dev: allow any localhost / 127.0.0.1 port without listing each one.
  if (
    !isProduction &&
    (hostnameOnly === "localhost" || hostnameOnly === "127.0.0.1")
  ) {
    next();
    return;
  }

  res.status(400).json({ error: "Invalid Host header" });
});

// Security middleware
app.use(securityHeadersMiddleware(isProduction));
// Exact public memo PDF iframe exception: executes after Helmet, before express.static.
app.use(memoPdfFrameHeadersMiddleware());

// Explicit legacy X-XSS-Protection value expected by the audit checklist.
app.use((_req, res, next) => {
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Rate-limit API traffic only (not static SPA assets). Health stays unlimited for probes.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: globalRateLimitMax,
  message: { error: "Too many requests. Please wait a few minutes and try again." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyGenerator,
  validate: { xForwardedForHeader: false },
});

app.use("/api", (req, res, next) => {
  if (isExemptFromGlobalApiRateLimit(req)) {
    next();
    return;
  }
  globalLimiter(req, res, next);
});

const configuredOrigins = (process.env.CORS_ORIGIN || "http://localhost:8080")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

// Browsers often omit Origin on same-site document navigations (GET /). Block only
// cross-origin mutations without a valid Origin — not static/health GETs.
app.use((req, res, next) => {
  const safeMethod = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
  cors({
    origin(origin, callback) {
      if (!origin) {
        if (process.env.NODE_ENV !== "production" || safeMethod) {
          callback(null, true);
          return;
        }
        callback(null, false);
        return;
      }
      if (configuredOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      if (isAllowedDevOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  })(req, res, next);
});
app.use(express.json({ limit: "2mb" }));
app.use(csrfProtection);

const ragLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: ragRateLimitMax,
  message: { error: "Too many AI requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Serve uploaded files only to authenticated users as attachments (no inline browser execution).
const uploadsRoot = path.resolve(path.join(__dirname, "../uploads"));
app.use("/api/uploads", authMiddleware, (req: AuthRequest, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const relativePath = decodeURIComponent((req.path || "").replace(/^\/+/, ""));
  if (
    !relativePath ||
    relativePath.includes("\0") ||
    path.isAbsolute(relativePath) ||
    relativePath.split(/[/\\]/).some((segment) => segment === "..")
  ) {
    res.status(400).json({ error: "Invalid path" });
    return;
  }

  const absolutePath = path.resolve(uploadsRoot, relativePath);
  const rootWithSep = uploadsRoot.endsWith(path.sep) ? uploadsRoot : `${uploadsRoot}${path.sep}`;
  if (absolutePath !== uploadsRoot && !absolutePath.startsWith(rootWithSep)) {
    res.status(400).json({ error: "Invalid path" });
    return;
  }

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  getUserAccess(req.user!.userId)
    .then(async (access) => {
      const uploadRecord = await getSubmissionBySignedCopyPath(relativePath);
      if (!uploadRecord) {
        res.status(404).json({ error: "File not found" });
        return;
      }
      if (!access.canViewAnySubmission && uploadRecord.user_id !== req.user!.userId) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const basename = path.basename(absolutePath);
      const safeDownloadName = basename.replace(/[^\w.\-]+/g, "_") || "download";
      const ext = path.extname(basename).toLowerCase();

      res.setHeader("Content-Type", contentTypeForUploadExt(ext));
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", `attachment; filename="${safeDownloadName}"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.sendFile(absolutePath);
    })
    .catch((err) => {
      console.error("Upload download authorization error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    });
});

// Health check (must be before other /api routes)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

function isUsableGoogleMapsKey(key: string): boolean {
  if (!key || key.length < 20) return false;
  const lowered = key.toLowerCase();
  return !(
    lowered.includes("your-") ||
    lowered.includes("placeholder") ||
    lowered.includes("example") ||
    lowered.includes("changeme")
  );
}

app.get("/api/maps/config", authMiddleware, async (req: AuthRequest, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const roles = await getUserRoles(req.user!.userId);
    const mayUseGoogleMaps = roles.some((role) =>
      (MAPS_BROWSER_KEY_ROLES as readonly string[]).includes(role)
    );
    if (!mayUseGoogleMaps) {
      res.json({ provider: "leaflet" });
      return;
    }

    const browserKey = (
      process.env.GOOGLE_MAPS_BROWSER_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      ""
    ).trim();
    if (!isUsableGoogleMapsKey(browserKey)) {
      res.json({ provider: "leaflet" });
      return;
    }
    res.json({ provider: "google", apiKey: browserKey });
  } catch (err) {
    console.error("Maps config error:", err);
    res.json({ provider: "leaflet" });
  }
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/analytics", enhancedAnalyticsRoutes);
app.use("/api/analytics", analyticsProRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/rag", ragLimiter, ragGeminiRoutes);

// Serve static frontend in production
if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

async function startServer() {
  await runMigrations();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server startup failed:", err);
  process.exit(1);
});

export default app;
