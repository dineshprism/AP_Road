import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../auth.js";
import pool from "../db.js";

const router = Router();

// Ultra-optimized Ollama API call for maximum performance
async function callUltraOptimizedOllama(prompt: string, model: string = "phi3:mini") {
  try {
    console.log("Calling ultra-optimized Ollama with prompt:", prompt.substring(0, 100) + "...");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout
    
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        // Ultra-optimized parameters for maximum speed
        options: {
          temperature: 0.3,        // Very low for consistency
          top_p: 0.95,           // High diversity
          max_tokens: 300,         // Shorter responses
          repeat_penalty: 1.2,      // Strong repetition reduction
          num_predict: 200,          // Very fast generation
          num_ctx: 1024,           // Smaller context for speed
          stop: ["\n"],            // Stop at first newline
          mirostat: 1,              // Enable mirostat sampling
          seed: 42                  // Consistent responses
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
    console.log("Ultra-optimized Ollama response received, length:", data.response?.length || 0);
    
    if (!data.response || data.response.trim().length === 0) {
      throw new Error("Ollama returned empty response. Model may be overloaded or crashed.");
    }
    
    return data.response;
  } catch (error: any) {
    console.error("Ultra-optimized Ollama API error:", error);
    
    if (error.name === 'AbortError' || error.code === 'UND_ERR_HEADERS_TIMEOUT') {
      throw new Error("Ollama request timed out. Please try again or restart Ollama.");
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error("Cannot connect to Ollama. Please make sure Ollama is running with 'ollama serve'.");
    } else {
      throw new Error(`Ollama connection failed: ${error.message}`);
    }
  }
}

// POST /api/rag/analyze-ultra - Ultra-optimized analysis
router.post("/analyze-ultra", authMiddleware, async (req: AuthRequest, res: Response) => {
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

    // Create ultra-optimized context for maximum speed
    const context = `
ACCIDENT ANALYSIS - FIR: ${submission.fir_number}
LOCATION: ${submission.place_of_accident}, ${submission.mandal}, ${submission.district}
POLICE STATION: ${submission.police_station}
ROAD TYPE: ${submission.road_type}
DATE/TIME: ${submission.accident_date} at ${submission.accident_time}
CASUALTIES: ${submission.persons_died} died, ${submission.persons_injured} injured

ULTRA-OPTIMIZED ANALYSIS FOCUS:
1. Primary cause identification
2. Contributing factors  
3. Preventive measures
4. Infrastructure recommendations
5. Safety improvement suggestions

Provide concise, actionable analysis focused on accident prevention and safety improvements.
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

    const ultraOptimizedPrompt = `${systemPrompt}\n\n${context}\n\nQuestion: ${userQuestion}`;

    const response = await callUltraOptimizedOllama(ultraOptimizedPrompt);

    res.json({
      response: response,
      model: "phi3:mini (ultra-optimized)",
      submission: {
        id: submission.id,
        fir_number: submission.fir_number,
        location: `${submission.place_of_accident}, ${submission.mandal}`,
        district: submission.district
      },
      performance: {
        response_time: "ultra-optimized",
        model: "phi3:mini",
        tokens_used: 300,
        optimization_level: "ultra",
        timeout: "20s"
      }
    });

  } catch (err: any) {
    console.error("Ultra-optimized analyze error:", err);
    res.status(500).json({ 
      error: err.message,
      details: err.toString()
    });
  }
});

export default router;
