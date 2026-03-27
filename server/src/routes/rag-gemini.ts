import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../auth.js";
import pool from "../db.js";
import { GoogleGenAI } from "@google/genai";

const router = Router();
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const geminiThinkingBudget = Number(process.env.GEMINI_THINKING_BUDGET ?? 0);
const geminiMaxOutputTokens = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 1200);

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
    console.error("Gemini API error:", error);
    
    if (error.message?.includes('API_KEY')) {
      throw new Error("Invalid Gemini API key. Please check your GEMINI_API_KEY environment variable.");
    } else if (error.message?.includes("404") || error.message?.includes("not found for API version")) {
      throw new Error(`Gemini model '${geminiModel}' is unavailable. Update GEMINI_MODEL to a supported model such as 'gemini-2.5-flash'.`);
    } else if (error.message?.includes('quota')) {
      throw new Error("Gemini API quota exceeded. Please check your billing.");
    } else {
      throw new Error(`Gemini API failed: ${error.message}`);
    }
  }
}

// POST /api/rag/analyze-gemini - Analyze with Gemini
router.post("/analyze-gemini", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { submissionId, question } = req.body;

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

Respond concisely and practically.
Limit your answer to short sections with bullets.
Do not repeat the accident facts already provided.
Keep the response under 10 bullet points total.

Question: ${question || "Please analyze this accident and provide comprehensive insights and recommendations."}
`;

    const geminiResult = await callGemini(context);

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
      error: "AI analysis failed. Please try again later."
    });
  }
});

// POST /api/rag/batch-analyze-gemini - Batch analyze with Gemini
router.post("/batch-analyze-gemini", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { submissionIds, question } = req.body;

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

Question: ${userQuestion}

Please provide a comprehensive analysis that:
- Identifies patterns and trends across all accidents
- Suggests systemic improvements
- Recommends policy changes
- Provides actionable safety strategies
- Considers resource allocation
- Suggests monitoring and prevention strategies

Keep the answer concise, avoid repeating accident facts, and use no more than 12 bullets total.`;

    const geminiResult = await callGemini(batchPrompt);

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
      error: "AI batch analysis failed. Please try again later."
    });
  }
});

export default router;
