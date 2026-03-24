import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../auth.js";
import pool from "../db.js";

const router = Router();

// Optimized Ollama API call for better performance
async function callOptimizedOllama(prompt: string, model: string = "phi3:mini") {
  try {
    console.log("Calling optimized Ollama with prompt:", prompt.substring(0, 100) + "...");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        // Optimized parameters for speed and quality
        options: {
          temperature: 0.5,        // Lower for more deterministic responses
          top_p: 0.9,            // Good diversity
          max_tokens: 400,         // Balanced length
          repeat_penalty: 1.1,      // Reduce repetition
          num_predict: 256,          // Faster generation
          num_ctx: 2048,           // Standard context
          stop: ["\n\n", "\n"],     // Stop at natural breaks
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error("Ollama HTTP error:", response.status, response.statusText);
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Ollama response received, length:", data.response?.length || 0);
    
    if (!data.response || data.response.trim().length === 0) {
      throw new Error("Ollama returned empty response. Model may be overloaded or crashed.");
    }
    
    return data.response;
  } catch (error: any) {
    console.error("Ollama API error:", error);
    
    if (error.name === 'AbortError' || error.code === 'UND_ERR_HEADERS_TIMEOUT') {
      throw new Error("Ollama request timed out. Please try again or restart Ollama.");
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error("Cannot connect to Ollama. Please make sure Ollama is running with 'ollama serve'.");
    } else {
      throw new Error(`Ollama connection failed: ${error.message}`);
    }
  }
}

// POST /api/rag/analyze-optimized - Optimized Ollama analysis
router.post("/analyze-optimized", authMiddleware, async (req: AuthRequest, res: Response) => {
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

    // Create optimized context for faster analysis
    const context = `
ACCIDENT ANALYSIS REQUEST:
FIR: ${submission.fir_number}
Location: ${submission.place_of_accident}, ${submission.mandal}, ${submission.district}
Police Station: ${submission.police_station}
Road Type: ${submission.road_type}
Date: ${submission.accident_date} at ${submission.accident_time}
Casualties: ${submission.persons_died} died, ${submission.persons_injured} injured
Coordinates: ${submission.lat_long || 'Not available'}

ANALYSIS FOCUS:
1. Root cause identification
2. Contributing factors
3. Preventive measures
4. Infrastructure recommendations
5. Safety improvement suggestions

Please provide concise, actionable analysis focused on accident prevention and safety improvements.
`;

    const systemPrompt = `You are an expert traffic accident analyst for Andhra Pradesh Police. 
Analyze the provided accident data and provide specific, actionable insights.
Focus on:
- Primary causes and contributing factors
- Preventive measures for similar accidents
- Infrastructure improvements needed
- Safety recommendations for the location
- Investigation suggestions

Be thorough but concise. Provide practical recommendations that can be implemented.`;

    const userQuestion = question || "Please analyze this accident and provide insights and recommendations.";

    const optimizedPrompt = `${systemPrompt}\n\n${context}\n\nQuestion: ${userQuestion}`;

    const response = await callOptimizedOllama(optimizedPrompt);

    res.json({
      response: response,
      model: "phi3:mini (optimized)",
      submission: {
        id: submission.id,
        fir_number: submission.fir_number,
        location: `${submission.place_of_accident}, ${submission.mandal}`,
        district: submission.district
      },
      performance: {
        response_time: "optimized",
        model: "phi3:mini",
        tokens_used: 400
      }
    });

  } catch (err: any) {
    console.error("Optimized analyze error:", err);
    res.status(500).json({ 
      error: err.message,
      details: err.toString()
    });
  }
});

// POST /api/rag/batch-analyze-optimized - Optimized batch analysis
router.post("/batch-analyze-optimized", authMiddleware, async (req: AuthRequest, res: Response) => {
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

    // Create optimized batch context
    const batchContext = submissionResult.rows.map((sub, index) => 
      `Accident ${index + 1}: FIR ${sub.fir_number} - ${sub.place_of_accident}, ${sub.district}`
    ).join('\n');

    const systemPrompt = `You are an expert traffic accident analyst for Andhra Pradesh Police. 
Analyze the provided accident reports and provide comprehensive insights for multiple accidents.
Focus on:
1. Common patterns and trends across accidents
2. Risk factors and contributing elements
3. Infrastructure issues affecting multiple locations
4. Preventive strategies for the area
5. Policy recommendations for road safety

Provide thorough analysis with actionable recommendations for improving road safety.`;

    const userQuestion = question || "Please analyze these accidents and provide comprehensive insights and recommendations.";

    const optimizedPrompt = `${systemPrompt}\n\nAccident Reports:\n${batchContext}\n\nQuestion: ${userQuestion}`;

    const response = await callOptimizedOllama(optimizedPrompt);

    res.json({
      response: response,
      model: "phi3:mini (optimized batch)",
      submissionsAnalyzed: submissionResult.rows.length,
      submissions: submissionResult.rows.map(sub => ({
        id: sub.id,
        fir_number: sub.fir_number,
        location: `${sub.place_of_accident}, ${sub.mandal}`,
        district: sub.district,
        date: sub.accident_date
      })),
      performance: {
        response_time: "optimized",
        model: "phi3:mini",
        tokens_used: 400,
        batch_size: submissionResult.rows.length
      }
    });

  } catch (err: any) {
    console.error("Optimized batch analyze error:", err);
    res.status(500).json({ 
      error: err.message,
      details: err.toString()
    });
  }
});

export default router;
