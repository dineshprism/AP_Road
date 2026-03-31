import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../auth.js";
import pool from "../db.js";
import { GoogleGenAI } from "@google/genai";

const router = Router();
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const geminiThinkingBudget = Number(process.env.GEMINI_THINKING_BUDGET ?? 0);
const geminiMaxOutputTokens = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 1200);
const geminiRetryAttempts = 2;

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

// Gemini API call for accident analysis
async function callGemini(prompt: string) {
  for (let attempt = 1; attempt <= geminiRetryAttempts; attempt += 1) {
    try {
      console.log(`Calling Gemini model ${geminiModel} with prompt:`, prompt.substring(0, 100) + "...");

      const startTime = Date.now();
      const result = await ai.models.generateContent({
        model: geminiModel,
        contents: prompt,
        config: {
          thinkingConfig: {
            thinkingBudget: geminiThinkingBudget,
          },
          maxOutputTokens: geminiMaxOutputTokens,
          temperature: 0.4,
        },
      });
      const endTime = Date.now();
      const responseTime = ((endTime - startTime) / 1000).toFixed(2);

      const response = result.text ?? "";
      console.log("Gemini response received in", responseTime, "seconds, length:", response.length);

      if (!response || response.trim().length === 0) {
        throw new Error("Gemini returned empty response.");
      }

      return {
        response: response,
        responseTime: parseFloat(responseTime),
        model: geminiModel,
        tokens: response.length // Approximate token count
      };
    } catch (error: any) {
      console.error(`Gemini API error on attempt ${attempt}:`, error);

      const isTransientNetworkFailure =
        error?.message?.includes("fetch failed") ||
        error?.cause?.code === "ETIMEDOUT" ||
        error?.cause?.code === "ECONNRESET";

      if (isTransientNetworkFailure && attempt < geminiRetryAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
        continue;
      }

      if (error.message?.includes('API_KEY')) {
        throw new Error("Invalid Gemini API key. Please check your GEMINI_API_KEY environment variable.");
      } else if (error.message?.includes("leaked")) {
        throw new Error("The configured Gemini API key has been reported as leaked. Please replace GEMINI_API_KEY with a new key.");
      } else if (error.message?.includes("404") || error.message?.includes("not found for API version")) {
        throw new Error(`Gemini model '${geminiModel}' is unavailable. Update GEMINI_MODEL to a supported model such as 'gemini-2.5-flash'.`);
      } else if (error.message?.includes('quota')) {
        throw new Error("Gemini API quota exceeded. Please check your billing.");
      } else if (isTransientNetworkFailure) {
        throw new Error("Gemini API request timed out. Please try again.");
      } else {
        throw new Error(`Gemini API failed: ${error.message}`);
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

function isGeminiUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return (
    message.includes("timed out") ||
    message.includes("fetch failed") ||
    message.includes("API key") ||
    message.includes("leaked") ||
    message.includes("quota") ||
    message.includes("unavailable")
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

    // Get submission details
    const submissionResult = await pool.query(
      `SELECT id, district, place_of_accident, mandal, police_station, fir_number, 
              road_type, accident_date, accident_time, lat_long, persons_died, 
              persons_injured, vehicles, drivers, driver_related_causes, 
              vehicle_condition_causes, road_engineering_nature, road_engineering_junctions, 
              road_engineering_signages, road_engineering_median, road_engineering_culverts
       FROM accident_submissions WHERE id = $1`,
      [submissionId]
    );

    if (submissionResult.rows.length === 0) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    const submission = submissionResult.rows[0];
    const conversationHistory = formatConversationHistory(history);

    // Create comprehensive context for Gemini
    const context = `
ACCIDENT ANALYSIS REQUEST:
FIR: ${submission.fir_number}
LOCATION: ${submission.place_of_accident}, ${submission.mandal}, ${submission.district}
POLICE STATION: ${submission.police_station}
ROAD TYPE: ${submission.road_type}
DATE/TIME: ${submission.accident_date} at ${submission.accident_time}
CASUALTIES: ${submission.persons_died} died, ${submission.persons_injured} injured
VEHICLES: ${submission.vehicles}
DRIVER CAUSES: ${submission.driver_related_causes}
VEHICLE ISSUES: ${submission.vehicle_condition_causes}
ROAD ISSUES: ${submission.road_engineering_nature}
JUNCTION ISSUES: ${submission.road_engineering_junctions}
SIGNAGE ISSUES: ${submission.road_engineering_signages}
MEDIAN ISSUES: ${submission.road_engineering_median}
CULVERT ISSUES: ${submission.road_engineering_culverts}

RECENT CONVERSATION:
${conversationHistory}

ANALYSIS FOCUS:
1. Root cause identification
2. Contributing factors
3. Preventive measures
4. Infrastructure recommendations
5. Safety improvement suggestions
6. Legal implications
7. Investigation suggestions

You are an expert traffic accident analyst for Andhra Pradesh Police. 
Analyze the provided accident data and provide comprehensive, actionable insights.

Focus on:
- Primary causes and contributing factors
- Preventive measures for similar accidents
- Infrastructure improvements needed
- Safety recommendations for the location
- Investigation suggestions
- Legal and compliance considerations
- Data-driven recommendations

Conversation rules:
- Treat the latest user question as the main task.
- Use the recent conversation to understand follow-up intent.
- Do not restart with a full generic summary unless the user explicitly asks for a full analysis.
- If the user asks a narrow follow-up, answer only that narrow follow-up.
- If the user message is vague acknowledgement text like "ok", "yes", or "hmm", ask one short clarifying question instead of repeating the full analysis.
- Do not repeat accident facts already provided unless needed for the answer.

Respond concisely and practically.
Prefer short sections with bullets only when useful.
Keep the response focused and under 8 bullets total.

Question: ${question || "Please analyze this accident and provide comprehensive insights and recommendations."}
`;

    let geminiResult;
    try {
      geminiResult = await callGemini(context);
    } catch (err) {
      if (!isGeminiUnavailable(err)) {
        throw err;
      }

      res.json({
        response: generateSingleFallbackAnalysis(submission, question),
        model: "local-fallback",
        submission: {
          id: submission.id,
          fir_number: submission.fir_number,
          location: `${submission.place_of_accident}, ${submission.mandal}`,
          district: submission.district
        },
        performance: {
          response_time: 0,
          model: "local-fallback",
          tokens: 0,
          api: "Local fallback",
          optimization: "rule-based"
        }
      });
      return;
    }

    res.json({
      response: geminiResult.response,
      model: geminiResult.model,
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
      }
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

    // Get multiple submissions
    const placeholders = submissionIds.map((_, index) => `$${index + 1}`).join(', ');
    const submissionResult = await pool.query(
      `SELECT id, district, place_of_accident, mandal, police_station, fir_number, 
              road_type, accident_date, accident_time, lat_long, persons_died, 
              persons_injured, vehicles, drivers, driver_related_causes, 
              vehicle_condition_causes, road_engineering_nature, road_engineering_junctions, 
              road_engineering_signages, road_engineering_median, road_engineering_culverts
       FROM accident_submissions WHERE id IN (${placeholders})`,
      submissionIds
    );

    if (submissionResult.rows.length === 0) {
      res.status(404).json({ error: "No submissions found" });
      return;
    }
    const conversationHistory = formatConversationHistory(history);

    // Create batch context for Gemini
    const batchContext = submissionResult.rows.map((sub, index) => 
      `Accident ${index + 1}: FIR ${sub.fir_number} - ${sub.place_of_accident}, ${sub.district}
Date: ${sub.accident_date} at ${sub.accident_time}
Casualties: ${sub.persons_died} died, ${sub.persons_injured} injured
Vehicles: ${sub.vehicles}
Causes: ${formatStructuredField(sub.driver_related_causes)}
Road Issues: ${formatStructuredField(sub.road_engineering_nature)}`
    ).join('\n');

    const systemPrompt = `You are an expert traffic accident analyst for Andhra Pradesh Police. 
Analyze the provided batch of accident reports and provide comprehensive insights for multiple accidents.

Focus on:
1. Common patterns and trends across accidents
2. Risk factors and contributing elements
3. Infrastructure issues affecting multiple locations
4. Preventive strategies for the area
5. Policy recommendations for road safety
6. Statistical analysis of accident types
7. Resource allocation recommendations
8. Long-term safety improvement strategies

Provide concise analysis with actionable recommendations for improving road safety across multiple locations.
Consider geographical, temporal, and environmental factors that may connect these accidents.`;

    const userQuestion = question || "Please analyze these accidents and provide comprehensive insights and recommendations for improving road safety across these locations.";

    const batchPrompt = `${systemPrompt}

ACCIDENT BATCH ANALYSIS:
${batchContext}

RECENT CONVERSATION:
${conversationHistory}

Question: ${userQuestion}

Please provide a comprehensive analysis that:
- Identifies patterns and trends across all accidents
- Suggests systemic improvements
- Recommends policy changes
- Provides actionable safety strategies
- Considers resource allocation
- Suggests monitoring and prevention strategies

Conversation rules:
- Treat the latest user question as the main task.
- Use recent conversation to understand follow-up intent.
- Do not repeat the same overall summary for every follow-up.
- If the user asks about one theme such as causes, patterns, recommendations, or infrastructure, answer only that theme.
- If the user message is vague acknowledgement text like "ok", "yes", or "hmm", ask one short clarifying question instead of repeating the batch summary.

Keep the answer concise, avoid repeating accident facts, and use no more than 10 bullets total.`;

    let geminiResult;
    try {
      geminiResult = await callGemini(batchPrompt);
    } catch (err) {
      if (!isGeminiUnavailable(err)) {
        throw err;
      }

      res.json({
        response: generateBatchFallbackAnalysis(submissionResult.rows, userQuestion),
        model: "local-fallback",
        submissionsAnalyzed: submissionResult.rows.length,
        submissions: submissionResult.rows.map(sub => ({
          id: sub.id,
          fir_number: sub.fir_number,
          location: `${sub.place_of_accident}, ${sub.mandal}`,
          district: sub.district,
          date: sub.accident_date
        })),
        performance: {
          response_time: 0,
          model: "local-fallback",
          tokens: 0,
          api: "Local fallback",
          optimization: "rule-based",
          batch_size: submissionResult.rows.length
        }
      });
      return;
    }

    res.json({
      response: geminiResult.response,
      model: geminiResult.model,
      submissionsAnalyzed: submissionResult.rows.length,
      submissions: submissionResult.rows.map(sub => ({
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
        batch_size: submissionResult.rows.length
      }
    });

  } catch (err: any) {
    console.error("Gemini batch analyze error:", err);
    res.status(500).json({ 
      error: err?.message || "AI batch analysis failed. Please try again later."
    });
  }
});

export default router;
