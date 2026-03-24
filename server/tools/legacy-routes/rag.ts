import { Router, Response } from "express";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { authMiddleware, AuthRequest } from "../auth.js";
import pool from "../db.js";

const router = Router();

// Initialize Ollama model
const ollama = new ChatOllama({
  baseUrl: "http://localhost:11434",
  model: "llama3.1:8b", // Updated to correct model name
});

// POST /api/rag/analyze - Analyze single submission
router.post("/analyze", authMiddleware, async (req: AuthRequest, res: Response) => {
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
Be specific, practical, and actionable in your responses.`;

    const userQuestion = question || "Please analyze this accident and provide insights and recommendations.";

    const response = await ollama.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(`Context: ${context}\n\nQuestion: ${userQuestion}`)
    ]);

    res.json({
      response: response.content,
      submission: {
        id: submission.id,
        fir_number: submission.fir_number,
        location: `${submission.place_of_accident}, ${submission.mandal}`,
        district: submission.district
      }
    });

  } catch (err: any) {
    console.error("RAG analyze error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/rag/batch-analyze - Analyze multiple submissions
router.post("/batch-analyze", authMiddleware, async (req: AuthRequest, res: Response) => {
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
- Vehicle Condition: ${JSON.stringify(sub.vehicle_condition_causes, null, 2)}
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

    const response = await ollama.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(`Accident Reports:\n${submissionsContext}\n\nQuestion: ${userQuestion}`)
    ]);

    res.json({
      response: response.content,
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
    console.error("RAG batch analyze error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/rag/similar/:id - Find similar accidents
router.get("/similar/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get the reference submission
    const refResult = await pool.query(
      "SELECT district, road_type, driver_related_causes, vehicle_condition_causes FROM accident_submissions WHERE id = $1",
      [id]
    );

    if (refResult.rows.length === 0) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    const reference = refResult.rows[0];

    // Find similar accidents (simple similarity based on district and road type)
    const similarResult = await pool.query(
      `SELECT id, fir_number, place_of_accident, mandal, district, road_type, 
              accident_date, persons_died, persons_injured, driver_related_causes
       FROM accident_submissions 
       WHERE district = $1 AND road_type = $2 AND id != $3
       ORDER BY accident_date DESC
       LIMIT 5`,
      [reference.district, reference.road_type, id]
    );

    res.json({
      reference: {
        district: reference.district,
        roadType: reference.road_type
      },
      similarAccidents: similarResult.rows
    });

  } catch (err: any) {
    console.error("Similar accidents error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
