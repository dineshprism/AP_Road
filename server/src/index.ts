import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import submissionRoutes from "./routes/submissions.js";
import adminRoutes from "./routes/admin.js";
import analyticsRoutes from "./routes/analytics.js";
import enhancedAnalyticsRoutes from "./routes/enhanced-analytics.js";
import ragGeminiRoutes from "./routes/rag-gemini.js";
import { runMigrations } from "./migrate.js";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
const configuredOrigins = (process.env.CORS_ORIGIN || "http://localhost:8080")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowAnyOrigin = configuredOrigins.includes("*");

app.use(cors({
  origin(origin, callback) {
    if (allowAnyOrigin || !origin || configuredOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: !allowAnyOrigin,
}));
app.use(express.json({ limit: "2mb" }));
app.use("/api/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check (must be before other /api routes)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/analytics", enhancedAnalyticsRoutes);
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
