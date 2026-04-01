import { Router, Response } from "express";
import pool from "../db.js";
import { authMiddleware, AuthRequest } from "../auth.js";
import {
  AccidentSubmissionRecord,
  analyzeWithLocalRag,
  ensureSubmissionEmbeddings,
  getLocalRagConfig,
} from "../rag-local.js";

const router = Router();

router.use(authMiddleware);

async function isAdminUser(userId: string) {
  const roleResult = await pool.query(
    "SELECT 1 FROM user_roles WHERE user_id = $1 AND role IN ('admin', 'dgp', 'adgp') LIMIT 1",
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

router.get("/local/config", (_req, res) => {
  res.json(getLocalRagConfig());
});

router.post("/analyze-local", async (req: AuthRequest, res: Response) => {
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

    const analysis = await analyzeWithLocalRag({
      submissions,
      question:
        question ||
        "Please analyze this accident and provide the main causes, contributing factors, investigation observations, and preventive recommendations.",
      history,
    });

    const submission = submissions[0];
    res.json({
      response: analysis.response,
      model: analysis.model,
      mode: "local-rag",
      submission: {
        id: submission.id,
        fir_number: submission.fir_number,
        location: `${submission.place_of_accident}, ${submission.mandal}`,
        district: submission.district,
      },
      retrieval: analysis.retrieval,
      contextSubmissions: analysis.contextSubmissions,
    });
  } catch (error: any) {
    console.error("Local RAG analyze error:", error);
    res.status(500).json({ error: error.message || "Local RAG analysis failed" });
  }
});

router.post("/batch-analyze-local", async (req: AuthRequest, res: Response) => {
  try {
    const { submissionIds, question, history } = req.body;
    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      res.status(400).json({ error: "Submission IDs array is required" });
      return;
    }

    const submissions = await fetchAccessibleSubmissions(req.user!.userId, submissionIds);
    if (submissions.length === 0) {
      res.status(404).json({ error: "No submissions found" });
      return;
    }

    const analysis = await analyzeWithLocalRag({
      submissions,
      question:
        question ||
        "Please analyze these accidents and identify the key patterns, recurring causes, and preventive recommendations across the selected submissions.",
      history,
    });

    res.json({
      response: analysis.response,
      model: analysis.model,
      mode: "local-rag",
      submissionsAnalyzed: submissions.length,
      submissions: submissions.map((submission) => ({
        id: submission.id,
        fir_number: submission.fir_number,
        location: `${submission.place_of_accident}, ${submission.mandal}`,
        district: submission.district,
        date: submission.accident_date,
      })),
      retrieval: analysis.retrieval,
      contextSubmissions: analysis.contextSubmissions,
    });
  } catch (error: any) {
    console.error("Local RAG batch analyze error:", error);
    res.status(500).json({ error: error.message || "Local batch RAG analysis failed" });
  }
});

router.get("/similar/:id", async (req: AuthRequest, res: Response) => {
  try {
    const referenceId = String(req.params.id);
    const accessibleReference = await fetchAccessibleSubmissions(req.user!.userId, [referenceId]);
    if (accessibleReference.length === 0) {
      res.status(404).json({ error: "Reference submission not found" });
      return;
    }

    const reference = accessibleReference[0];
    const admin = await isAdminUser(req.user!.userId);
    const candidateResult = admin
      ? await pool.query<AccidentSubmissionRecord>(
          `SELECT id, district, place_of_accident, mandal, police_station, fir_number,
                  road_type, accident_date, accident_time, lat_long, persons_died, persons_injured,
                  vehicles, drivers, driver_related_causes, vehicle_condition_causes,
                  road_engineering_nature, road_engineering_junctions, road_engineering_signages,
                  road_engineering_median, road_engineering_culverts
           FROM accident_submissions
           WHERE id <> $1
           ORDER BY accident_date DESC
           LIMIT 250`,
          [referenceId]
        )
      : await pool.query<AccidentSubmissionRecord>(
          `SELECT id, district, place_of_accident, mandal, police_station, fir_number,
                  road_type, accident_date, accident_time, lat_long, persons_died, persons_injured,
                  vehicles, drivers, driver_related_causes, vehicle_condition_causes,
                  road_engineering_nature, road_engineering_junctions, road_engineering_signages,
                  road_engineering_median, road_engineering_culverts
           FROM accident_submissions
           WHERE id <> $1 AND user_id = $2
           ORDER BY accident_date DESC
           LIMIT 250`,
          [referenceId, req.user!.userId]
        );

    const candidates = candidateResult.rows;
    if (candidates.length === 0) {
      res.json({ reference, similarAccidents: [] });
      return;
    }

    const embedded = await ensureSubmissionEmbeddings([reference, ...candidates]);
    const referenceEmbedding = embedded.get(reference.id)?.embedding || [];
    const similarAccidents = candidates
      .map((submission) => {
        const candidateEmbedding = embedded.get(submission.id)?.embedding || [];
        let dot = 0;
        let leftNorm = 0;
        let rightNorm = 0;
        for (let index = 0; index < referenceEmbedding.length; index += 1) {
          dot += referenceEmbedding[index] * (candidateEmbedding[index] || 0);
          leftNorm += referenceEmbedding[index] * referenceEmbedding[index];
          rightNorm += (candidateEmbedding[index] || 0) * (candidateEmbedding[index] || 0);
        }
        const score = leftNorm && rightNorm ? dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)) : -1;
        return {
          id: submission.id,
          fir_number: submission.fir_number,
          district: submission.district,
          place_of_accident: submission.place_of_accident,
          accident_date: submission.accident_date,
          road_type: submission.road_type,
          persons_died: submission.persons_died,
          persons_injured: submission.persons_injured,
          score: Number(score.toFixed(4)),
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 10);

    res.json({ reference, similarAccidents });
  } catch (error: any) {
    console.error("Local RAG similar search error:", error);
    res.status(500).json({ error: error.message || "Failed to find similar accidents" });
  }
});

export default router;
