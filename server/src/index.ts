import express from "express";
import cors from "cors";
import helmet from "helmet";
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
import localRagRoutes from "./routes/rag-local.js";
import ragGeminiRoutes from "./routes/rag-gemini.js";
import reportRoutes from "./routes/reports.js";
import { runMigrations } from "./migrate.js";
import { authMiddleware } from "./auth.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const PORT = parseInt(process.env.PORT || "3000", 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://maps.googleapis.com", "https://maps.gstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:", "https://fonts.googleapis.com", "https://maps.googleapis.com", "https://maps.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org", "https://*.googleapis.com", "https://*.gstatic.com", "https://*.google.com", "https://*.ggpht.com"],
      connectSrc: ["'self'", "https://*.googleapis.com", "https://*.google.com", "https://maps.googleapis.com", "https://maps.gstatic.com"],
      fontSrc: ["'self'", "https:", "data:", "https://fonts.gstatic.com", "https://maps.gstatic.com"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
}));

// Global rate limiter: 200 requests per 15 minutes per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

const configuredOrigins = (process.env.CORS_ORIGIN || "http://localhost:8080")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || configuredOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));

// Serve uploaded files only to authenticated users
app.use("/api/uploads", authMiddleware, express.static(path.join(__dirname, "../uploads")));

// Health check (must be before other /api routes)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/maps/config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY || "" });
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
app.use("/api/rag", localRagRoutes);
app.use("/api/rag", ragGeminiRoutes);

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
