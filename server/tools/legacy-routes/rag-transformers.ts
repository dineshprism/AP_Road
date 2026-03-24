import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../auth.js";
import pool from "../db.js";

const router = Router();

// Import transformers library
let transformersPipeline: any = null;

async function initializeTransformers() {
  try {
    // Dynamic import for transformers
    const transformers = await import('@xenova/transformers');
    transformersPipeline = await transformers.pipeline('text-generation', 'microsoft/phi-3-mini-4k-instruct');
    console.log("✅ Transformers pipeline initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Failed to initialize transformers:", error);
    return false;
  }
}

// Direct transformers API call (without LangChain)
async function callTransformers(prompt: string, model: string = "microsoft/phi-3-mini-4k-instruct") {
  try {
    // Initialize pipeline if not already done
    if (!pipeline) {
      const initialized = await initializeTransformers();
      if (!initialized) {
        throw new Error("Failed to initialize transformers pipeline");
      }
    }

    console.log("Calling Transformers with prompt:", prompt.substring(0, 100) + "...");
    
    const response = await transformersPipeline(prompt, {
      max_new_tokens: 512,
      temperature: 0.7,
      top_p: 0.8,
      repetition_penalty: 1.1,
      do_sample: false,
    });

    if (!response) {
      throw new Error(`Transformers API error: No response received`);
    }

    const result = response[0]?.generated_text;
    console.log("Transformers response received:", result?.substring(0, 200));
    return result;
  } catch (error: any) {
    console.error("Transformers API error:", error);
    throw error;
  }
}

// POST /api/rag/analyze-transformers - Analyze with transformers
router.post("/analyze-transformers", authMiddleware, async (req: AuthRequest, res: Response) => {
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

    // Format submission as context
    const context = `
Accident Report Details:
- FIR Number: ${submission.fir_number}
- Location: ${submission.place_of_accident}, ${submission.mandal}, ${submission.district}
- Police Station: ${submission.police_station}
- Road Type: ${submission.road_type}
- Date & Time: ${submission.accident_date} at ${submission.accident_time}
- Coordinates: ${submission.lat_long || 'Not available'}
- Casualties: ${submission.persons_died} died, ${submission.persons_injured} injured
- Vehicles: ${JSON.stringify(submission.vehicles, null, 2)}
- Driver Causes: ${JSON.stringify(submission.driver_related_causes, null, 2)}
- Vehicle Condition: ${JSON.stringify(submission.vehicle_condition_causes, null, 2)}
- Road Engineering Issues: 
  * Nature: ${JSON.stringify(submission.road_engineering_nature, null, 2)}
  * Junctions: ${JSON.stringify(submission.road_engineering_junctions, null, 2)}
  * Signages: ${JSON.stringify(submission.road_engineering_signages, null, 2)}
  * Median: ${JSON.stringify(submission.road_engineering_median, null, 2)}
  * Culverts: ${JSON.stringify(submission.road_engineering_culverts, null, 2)}
`;

    const systemPrompt = `You are an expert traffic accident analyst for Andhra Pradesh Police. 
Provide detailed analysis, insights, and recommendations based on the accident data. 
Focus on:
1. Root cause analysis
2. Preventive measures
3. Infrastructure improvements needed
4. Safety recommendations
5. Investigation suggestions
Be specific, practical, and actionable in your responses.
Keep responses concise but comprehensive.`;

    const userQuestion = question || "Please analyze this accident and provide insights and recommendations.";

    const fullPrompt = `${systemPrompt}\n\nContext: ${context}\n\nQuestion: ${userQuestion}`;

    const response = await callTransformers(fullPrompt);

    res.json({
      response: response,
      model: "microsoft/phi-3-mini-4k-instruct",
      submission: {
        id: submission.id,
        fir_number: submission.fir_number,
        location: `${submission.place_of_accident}, ${submission.mandal}`,
        district: submission.district
      }
    });

  } catch (err: any) {
    console.error("Transformers analyze error:", err);
    res.status(500).json({ 
      error: err.message,
      details: err.toString()
    });
  }
});

// POST /api/rag/batch-analyze-transformers - Batch analyze with transformers
router.post("/batch-analyze-transformers", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { submissionIds, question } = req.body;

    if (!submissionIds || !Array.isArray(submissionIds) || submissionIds.length === 0) {
      res.status(400).json({ error: "Submission IDs array is required" });
      return;
    }

    // Get multiple submissions
    const placeholders = submissionIds.map((_, index) => `$${index + 1}`);
    const submissionResult = await pool.query(
      `SELECT id, district, place_of_accident, mandal, police_station, fir_number, 
              road_type, accident_date, accident_time, lat_long, persons_died, 
              persons_injured, vehicles, drivers, driver_related_causes, 
              vehicle_condition_causes, road_engineering_nature, road_engineering_junctions, 
              road_engineering_signages, road_engineering_median, road_engineering_culverts
       FROM accident_submissions WHERE id = (${placeholders})`,
      submissionIds
    );

    if (submissionResult.rows.length === 0) {
      res.status(404).json({ error: "No submissions found" });
      return;
    }

    // Format multiple submissions as context
    const submissionsContext = submissionResult.rows.map((sub, index) => `
Accident ${index + 1}:
- FIR: ${sub.fir_number}
- Location: ${sub.place_of_accident}, ${sub.mandal}, ${sub.district}
- Date: ${sub.accident_date} at ${sub.accident_time}
- Casualties: ${sub.persons_died} died, ${sub.persons_injured} injured
- Road Type: ${sub.road_type}
- Driver Causes: ${JSON.stringify(sub.driver_related_causes, null, 2)}
`).join('\n');

    const systemPrompt = `You are an expert traffic accident analyst for Andhra Pradesh Police. 
Analyze the provided accident reports and provide comprehensive insights. 
Focus on:
1. Common patterns across accidents
2. Risk factors and trends
3. Infrastructure issues
4. Preventive strategies
5. Policy recommendations
Be thorough and provide actionable insights for improving road safety.`;

    const userQuestion = question || "Please analyze these accidents and provide comprehensive insights and recommendations.";

    const fullPrompt = `${systemPrompt}\n\nAccident Reports:\n${submissionsContext}\n\nQuestion: ${userQuestion}`;

    const response = await callTransformers(fullPrompt);

    res.json({
      response: response,
      model: "microsoft/phi-3-mini-4k-instruct",
      submissionsAnalyzed: submissionResult.rows.length,
      submissions: submissionResult.rows.map(sub => ({
        id: sub.id,
        fir_number: sub.fir_number,
        location: `${sub.place_of_accident}, ${sub.mandal}`,
        district: sub.district,
        date: sub.accident_date
      }))
    });

  } catch (err: any) {
    console.error("Transformers batch analyze error:", err);
    res.status(500).json({ 
      error: err.message,
      details: err.toString()
    });
  }
});

export default router;
