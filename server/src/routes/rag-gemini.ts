import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../auth.js";
import pool from "../db.js";
import { GoogleGenAI } from "@google/genai";
import { AccidentSubmissionRecord, analyzeWithLocalRag } from "../rag-local.js";
import crypto from "crypto";

const router = Router();
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const geminiThinkingBudget = Number(process.env.GEMINI_THINKING_BUDGET ?? 0);
const geminiMaxOutputTokens = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 1200);
const geminiRetryAttempts = 2;
const geminiTimeoutMs = Number(process.env.GEMINI_TIMEOUT_MS ?? 12000);
const geminiCacheTtlMs = Number(process.env.GEMINI_CACHE_TTL_MS ?? 10 * 60 * 1000);
const geminiResponseCache = new Map<
  string,
  { response: string; responseTime: number; model: string; tokens: number; expiresAt: number }
>();

// Initialize Gemini AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

function formatStructuredField(value: unknown): string {
  if (value == null) {
    return "N/A";
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "N/A";
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return "N/A";
    }

    try {
      return formatStructuredField(JSON.parse(trimmed));
    } catch {
      return trimmed;
    }
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => {
        if (entryValue == null) return false;
        if (typeof entryValue === "boolean") return entryValue;
        if (typeof entryValue === "number") return entryValue > 0;
        if (typeof entryValue === "string") return entryValue.trim().length > 0;
        if (Array.isArray(entryValue)) return entryValue.length > 0;
        if (typeof entryValue === "object") return Object.keys(entryValue as Record<string, unknown>).length > 0;
        return false;
      })
      .map(([key, entryValue]) => {
        if (entryValue === true) {
          return key;
        }

        if (Array.isArray(entryValue)) {
          return `${key}: ${entryValue.join(", ")}`;
        }

        if (typeof entryValue === "object" && entryValue !== null) {
          return `${key}: ${formatStructuredField(entryValue)}`;
        }

        return `${key}: ${String(entryValue)}`;
      });

    return entries.length > 0 ? entries.join("; ") : "N/A";
  }

  return String(value);
}

async function isAdminUser(userId: string) {
  const roleResult = await pool.query(
    "SELECT 1 FROM user_roles WHERE user_id = $1 AND role IN ('admin', 'dgp', 'adgp', 'prism') LIMIT 1",
    [userId]
  );
  return roleResult.rows.length > 0;
}

async function fetchAccessibleSubmissions(userId: string, submissionIds: string[]) {
  const admin = await isAdminUser(userId);
  if (submissionIds.length === 0) return [];

  const result = admin
    ? await pool.query<AccidentSubmissionRecord>(
        `SELECT id, district, place_of_accident, mandal, police_station, fir_number,
                road_type, accident_date, accident_time, lat_long, persons_died, persons_injured,
                vehicles, drivers, driver_related_causes, vehicle_condition_causes,
                road_engineering_nature, road_engineering_junctions, road_engineering_signages,
                road_engineering_median, road_engineering_culverts
         FROM accident_submissions
         WHERE id = ANY($1::uuid[])`,
        [submissionIds]
      )
    : await pool.query<AccidentSubmissionRecord>(
        `SELECT id, district, place_of_accident, mandal, police_station, fir_number,
                road_type, accident_date, accident_time, lat_long, persons_died, persons_injured,
                vehicles, drivers, driver_related_causes, vehicle_condition_causes,
                road_engineering_nature, road_engineering_junctions, road_engineering_signages,
                road_engineering_median, road_engineering_culverts
         FROM accident_submissions
         WHERE id = ANY($1::uuid[]) AND user_id = $2`,
        [submissionIds, userId]
      );

  return result.rows;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function getPromptCacheKey(prompt: string) {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}

function getCachedGeminiResponse(prompt: string) {
  const key = getPromptCacheKey(prompt);
  const entry = geminiResponseCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    geminiResponseCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedGeminiResponse(
  prompt: string,
  result: { response: string; responseTime: number; model: string; tokens: number }
) {
  const key = getPromptCacheKey(prompt);
  if (geminiResponseCache.size > 200) {
    const firstKey = geminiResponseCache.keys().next().value;
    if (firstKey) {
      geminiResponseCache.delete(firstKey);
    }
  }
  geminiResponseCache.set(key, {
    ...result,
    expiresAt: Date.now() + geminiCacheTtlMs,
  });
}

// Gemini API call for accident analysis
async function callGemini(prompt: string) {
  const cached = getCachedGeminiResponse(prompt);
  if (cached) {
    return {
      response: cached.response,
      responseTime: 0.01,
      model: `${cached.model} (cached)`,
      tokens: cached.tokens,
    };
  }

  for (let attempt = 1; attempt <= geminiRetryAttempts; attempt += 1) {
    try {
      console.log(`Calling Gemini model ${geminiModel} with prompt:`, prompt.substring(0, 100) + "...");

      const startTime = Date.now();
      const result = await withTimeout(
        ai.models.generateContent({
          model: geminiModel,
          contents: prompt,
          config: {
            thinkingConfig: {
              thinkingBudget: geminiThinkingBudget,
            },
            maxOutputTokens: geminiMaxOutputTokens,
            temperature: 0.2,
          },
        }),
        geminiTimeoutMs,
        "Gemini request"
      );
      const endTime = Date.now();
      const responseTime = ((endTime - startTime) / 1000).toFixed(2);

      const response = result.text ?? "";
      console.log("Gemini response received in", responseTime, "seconds, length:", response.length);

      if (!response || response.trim().length === 0) {
        throw new Error("Gemini returned empty response.");
      }

      const geminiResult = {
        response: response,
        responseTime: parseFloat(responseTime),
        model: geminiModel,
        tokens: response.length // Approximate token count
      };
      setCachedGeminiResponse(prompt, geminiResult);
      return geminiResult;
    } catch (error: any) {
      console.error(`Gemini API error on attempt ${attempt}:`, error);
      const rawMessage = String(error?.message || "");
      const normalizedMessage = rawMessage.toLowerCase();

      const isTransientNetworkFailure =
        normalizedMessage.includes("fetch failed") ||
        error?.cause?.code === "ETIMEDOUT" ||
        error?.cause?.code === "ECONNRESET";
      const isModelTemporarilyUnavailable =
        normalizedMessage.includes("503") ||
        normalizedMessage.includes("unavailable") ||
        normalizedMessage.includes("high demand") ||
        normalizedMessage.includes("overloaded");

      if ((isTransientNetworkFailure || isModelTemporarilyUnavailable) && attempt < geminiRetryAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
        continue;
      }

      if (rawMessage.includes('API_KEY')) {
        throw new Error("Invalid Gemini API key. Please check your GEMINI_API_KEY environment variable.");
      } else if (normalizedMessage.includes("leaked")) {
        throw new Error("The configured Gemini API key has been reported as leaked. Please replace GEMINI_API_KEY with a new key.");
      } else if (normalizedMessage.includes("404") || normalizedMessage.includes("not found for api version")) {
        throw new Error(`Gemini model '${geminiModel}' is unavailable. Update GEMINI_MODEL to a supported model such as 'gemini-2.5-flash'.`);
      } else if (normalizedMessage.includes('quota')) {
        throw new Error("Gemini API quota exceeded. Please check your billing.");
      } else if (isModelTemporarilyUnavailable) {
        throw new Error("Gemini is temporarily unavailable due to high demand. Using fallback analysis.");
      } else if (isTransientNetworkFailure) {
        throw new Error("Gemini API request timed out. Please try again.");
      } else {
        throw new Error(`Gemini API failed: ${rawMessage}`);
      }
    }
  }

  throw new Error("Gemini API failed after multiple attempts.");
}

function formatConversationHistory(history: Array<{ role?: string; content?: string }> | undefined) {
  if (!Array.isArray(history) || history.length === 0) {
    return "No prior conversation.";
  }

  return history
    .slice(-6)
    .map((item) => `${item.role === "user" ? "User" : "Assistant"}: ${String(item.content || "").trim()}`)
    .filter((line) => line.length > 0)
    .join("\n");
}

function buildSinglePrompt(
  submission: AccidentSubmissionRecord,
  question: string | undefined,
  history: Array<{ role?: string; content?: string }> | undefined
) {
  return `You are a senior Andhra Pradesh road-accident analyst.

Answer the latest user request using only the accident record below and the short conversation history.
Prefer crisp practical reasoning over long explanation.
If the user asks for a narrow follow-up, answer only that follow-up.
If data is missing, say so briefly instead of guessing.

Output rules:
- Keep the answer under 180 words.
- Use at most 4 short sections.
- Focus on causes, risk signals, immediate actions, and prevention only when relevant to the user's question.
- Avoid repeating raw accident facts unless needed.

ACCIDENT RECORD
FIR: ${submission.fir_number}
District: ${submission.district}
Location: ${submission.place_of_accident}, ${submission.mandal}
Police Station: ${submission.police_station}
Road Type: ${submission.road_type}
Date/Time: ${submission.accident_date} ${submission.accident_time || ""}
Casualties: ${submission.persons_died} died, ${submission.persons_injured} injured
Vehicles: ${formatStructuredField(submission.vehicles)}
Drivers: ${formatStructuredField(submission.drivers)}
Driver Factors: ${formatStructuredField(submission.driver_related_causes)}
Vehicle Factors: ${formatStructuredField(submission.vehicle_condition_causes)}
Road Nature: ${formatStructuredField(submission.road_engineering_nature)}
Junction Factors: ${formatStructuredField(submission.road_engineering_junctions)}
Signage Factors: ${formatStructuredField(submission.road_engineering_signages)}
Median Factors: ${formatStructuredField(submission.road_engineering_median)}
Culvert Factors: ${formatStructuredField(submission.road_engineering_culverts)}

RECENT CONVERSATION
${formatConversationHistory(history)}

LATEST USER REQUEST
${question || "Analyze this accident briefly and provide the main causes, key risks, and best preventive actions."}`;
}

function buildBatchPrompt(
  submissions: AccidentSubmissionRecord[],
  question: string | undefined,
  history: Array<{ role?: string; content?: string }> | undefined
) {
  const batchContext = submissions
    .map(
      (sub, index) => `Accident ${index + 1}
FIR: ${sub.fir_number}
District: ${sub.district}
Location: ${sub.place_of_accident}, ${sub.mandal}
Police Station: ${sub.police_station}
Road Type: ${sub.road_type}
Date/Time: ${sub.accident_date} ${sub.accident_time || ""}
Casualties: ${sub.persons_died} died, ${sub.persons_injured} injured
Driver Factors: ${formatStructuredField(sub.driver_related_causes)}
Vehicle Factors: ${formatStructuredField(sub.vehicle_condition_causes)}
Road Factors: ${formatStructuredField(sub.road_engineering_nature)}
Junction Factors: ${formatStructuredField(sub.road_engineering_junctions)}
Signage Factors: ${formatStructuredField(sub.road_engineering_signages)}`
    )
    .join("\n\n");

  return `You are a senior Andhra Pradesh road-accident analyst.

Analyze this group of accidents for operational decision-making.
Prefer pattern detection, prioritization, and actions.
If the latest user request is narrow, answer only that theme.

Output rules:
- Keep the answer under 220 words.
- Use at most 5 short bullets or short sections.
- Highlight repeated causes, shared infrastructure risks, and the top prevention priorities.
- Do not restate every accident individually.

ACCIDENT SET
${batchContext}

RECENT CONVERSATION
${formatConversationHistory(history)}

LATEST USER REQUEST
${question || "Analyze these accidents and identify the main patterns, recurring causes, and best preventive actions."}`;
}

function isGeminiUnavailable(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error || "")).toLowerCase();
  return (
    message.includes("timed out") ||
    message.includes("fetch failed") ||
    message.includes("api key") ||
    message.includes("leaked") ||
    message.includes("quota") ||
    message.includes("unavailable") ||
    message.includes("503") ||
    message.includes("high demand") ||
    message.includes("overloaded")
  );
}

function generateSingleFallbackAnalysis(submission: any, question?: string) {
  const driverCauses = formatStructuredField(submission.driver_related_causes);
  const vehicleIssues = formatStructuredField(submission.vehicle_condition_causes);
  const roadIssues = [
    formatStructuredField(submission.road_engineering_nature),
    formatStructuredField(submission.road_engineering_junctions),
    formatStructuredField(submission.road_engineering_signages),
    formatStructuredField(submission.road_engineering_median),
    formatStructuredField(submission.road_engineering_culverts),
  ].filter((item) => item !== "N/A");

  const casualtySummary =
    submission.persons_died > 0
      ? `${submission.persons_died} deaths and ${submission.persons_injured} injuries indicate a high-severity crash.`
      : `${submission.persons_injured} injuries were reported with no deaths in the current record.`;

  return [
    `Fallback analysis: Gemini is temporarily unavailable, so this summary is generated directly from the submission data for FIR ${submission.fir_number}.`,
    `Question focus: ${question || "Initial accident analysis"}.`,
    `Likely primary factors: ${driverCauses !== "N/A" ? driverCauses : "Driver-side factors were not clearly recorded, so investigator verification is required."}`,
    `Vehicle condition indicators: ${vehicleIssues !== "N/A" ? vehicleIssues : "No specific vehicle defects were captured in the submitted record."}`,
    `Road and site context: ${submission.road_type} road at ${submission.place_of_accident}, ${submission.mandal}, ${submission.district}.${roadIssues.length ? ` Reported infrastructure indicators: ${roadIssues.join("; ")}.` : " No explicit infrastructure defect was recorded in the form."}`,
    `Severity reading: ${casualtySummary}`,
    `Immediate investigation priorities: record witness statements, inspect both vehicles, verify CCTV availability, and document junction sight distance, markings, and impact points.`,
    `Immediate prevention focus: targeted speed enforcement, junction warning signage, visibility improvements, and conflict-point review near the bus stop or turning area.`,
  ].join("\n\n");
}

function generateBatchFallbackAnalysis(submissions: any[], question?: string) {
  const totalDeaths = submissions.reduce((sum, item) => sum + Number(item.persons_died || 0), 0);
  const totalInjuries = submissions.reduce((sum, item) => sum + Number(item.persons_injured || 0), 0);
  const roadTypes = [...new Set(submissions.map((item) => item.road_type).filter(Boolean))];
  const districts = [...new Set(submissions.map((item) => item.district).filter(Boolean))];

  return [
    `Fallback batch analysis: Gemini is temporarily unavailable, so this summary is based directly on ${submissions.length} selected submission records.`,
    `Question focus: ${question || "Batch accident analysis"}.`,
    `Coverage: ${submissions.length} records across ${districts.join(", ") || "the selected district set"} with road categories ${roadTypes.join(", ") || "not specified"}.`,
    `Casualty picture: ${totalDeaths} deaths and ${totalInjuries} injuries across the selected submissions.`,
    `Common review points: compare repeated driver-related causes, junction or signage defects, and recurring police station locations to identify operational patterns.`,
    `Immediate action: prioritize the highest-casualty locations for enforcement review, engineering inspection, and corridor-level monitoring.`,
    `Investigation recommendation: shortlist repeated FIR locations, validate road defects on site, and compare time-of-day recurrence before finalizing interventions.`,
  ].join("\n\n");
}

// POST /api/rag/analyze-gemini - Analyze with Gemini
router.post("/analyze-gemini", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { submissionId, question, history } = req.body;

    if (!submissionId) {
      res.status(400).json({ error: "Submission ID is required" });
      return;
    }

    const submissions = await fetchAccessibleSubmissions(req.user!.userId, [submissionId]);
    if (submissions.length === 0) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    const submission = submissions[0];
    const prompt = buildSinglePrompt(submission, question, history);

    let geminiResult;
    try {
      geminiResult = await callGemini(prompt);
    } catch (err) {
      if (!isGeminiUnavailable(err)) {
        throw err;
      }

      const localFallback = await analyzeWithLocalRag({
        submissions,
        question:
          question ||
          "Analyze this accident briefly and provide the main causes, key risks, and best preventive actions.",
        history: history as Array<{ role: "user" | "assistant"; content: string }> | undefined,
      });

      res.json({
        response: localFallback.response,
        model: localFallback.model,
        mode: "local-rag-fallback",
        submission: {
          id: submission.id,
          fir_number: submission.fir_number,
          location: `${submission.place_of_accident}, ${submission.mandal}`,
          district: submission.district
        },
        performance: {
          response_time: 0,
          model: localFallback.model,
          tokens: 0,
          api: "Local fallback",
          optimization: "ollama-rag"
        },
        retrieval: localFallback.retrieval,
        contextSubmissions: localFallback.contextSubmissions,
      });
      return;
    }

    res.json({
      response: geminiResult.response,
      model: geminiResult.model,
      mode: "gemini",
      submission: {
        id: submission.id,
        fir_number: submission.fir_number,
        location: `${submission.place_of_accident}, ${submission.mandal}`,
        district: submission.district
      },
      performance: {
        response_time: geminiResult.responseTime,
        model: geminiResult.model,
        tokens: geminiResult.tokens,
        api: "Google Gemini",
        optimization: "cloud-based"
      },
      retrieval: null,
      contextSubmissions: [],
    });

  } catch (err: any) {
    console.error("Gemini analyze error:", err);
    res.status(500).json({ 
      error: err?.message || "AI analysis failed. Please try again later."
    });
  }
});

// POST /api/rag/batch-analyze-gemini - Batch analyze with Gemini
router.post("/batch-analyze-gemini", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { submissionIds, question, history } = req.body;

    if (!submissionIds || !Array.isArray(submissionIds) || submissionIds.length === 0) {
      res.status(400).json({ error: "Submission IDs array is required" });
      return;
    }

    const submissions = await fetchAccessibleSubmissions(req.user!.userId, submissionIds);
    if (submissions.length === 0) {
      res.status(404).json({ error: "No submissions found" });
      return;
    }
    const userQuestion =
      question ||
      "Analyze these accidents and identify the main patterns, recurring causes, and best preventive actions.";
    const batchPrompt = buildBatchPrompt(submissions, userQuestion, history);

    let geminiResult;
    try {
      geminiResult = await callGemini(batchPrompt);
    } catch (err) {
      if (!isGeminiUnavailable(err)) {
        throw err;
      }

      const localFallback = await analyzeWithLocalRag({
        submissions,
        question: userQuestion,
        history: history as Array<{ role: "user" | "assistant"; content: string }> | undefined,
      });

      res.json({
        response: localFallback.response,
        model: localFallback.model,
        mode: "local-rag-fallback",
        submissionsAnalyzed: submissions.length,
        submissions: submissions.map(sub => ({
          id: sub.id,
          fir_number: sub.fir_number,
          location: `${sub.place_of_accident}, ${sub.mandal}`,
          district: sub.district,
          date: sub.accident_date
        })),
        performance: {
          response_time: 0,
          model: localFallback.model,
          tokens: 0,
          api: "Local fallback",
          optimization: "ollama-rag",
          batch_size: submissions.length
        },
        retrieval: localFallback.retrieval,
        contextSubmissions: localFallback.contextSubmissions,
      });
      return;
    }

    res.json({
      response: geminiResult.response,
      model: geminiResult.model,
      mode: "gemini",
      submissionsAnalyzed: submissions.length,
      submissions: submissions.map(sub => ({
        id: sub.id,
        fir_number: sub.fir_number,
        location: `${sub.place_of_accident}, ${sub.mandal}`,
        district: sub.district,
        date: sub.accident_date
      })),
      performance: {
        response_time: geminiResult.responseTime,
        model: geminiResult.model,
        tokens: geminiResult.tokens,
        api: "Google Gemini",
        optimization: "cloud-based",
        batch_size: submissions.length
      },
      retrieval: null,
      contextSubmissions: [],
    });

  } catch (err: any) {
    console.error("Gemini batch analyze error:", err);
    res.status(500).json({ 
      error: err?.message || "AI batch analysis failed. Please try again later."
    });
  }
});

export default router;
