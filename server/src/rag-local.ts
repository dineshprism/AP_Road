import crypto from "crypto";
import { Document } from "@langchain/core/documents";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import pool from "./db.js";

export interface AccidentSubmissionRecord {
  id: string;
  district: string;
  place_of_accident: string;
  mandal: string;
  police_station: string;
  fir_number: string;
  road_type: string;
  accident_date: string;
  accident_time: string | null;
  lat_long: string | null;
  persons_died: number;
  persons_injured: number;
  vehicles: unknown;
  drivers: unknown;
  driver_related_causes: unknown;
  vehicle_condition_causes: unknown;
  road_engineering_nature: unknown;
  road_engineering_junctions: unknown;
  road_engineering_signages: unknown;
  road_engineering_median: unknown;
  road_engineering_culverts: unknown;
}

interface CachedEmbeddingRow {
  submission_id: string;
  content_hash: string;
  embedding: number[];
  content: string;
}

interface AnalysisResult {
  response: string;
  contextSubmissions: Array<{
    id: string;
    fir_number: string;
    district: string;
    score?: number;
  }>;
  model: string;
  retrieval: {
    query: string;
    documents_considered: number;
    top_k: number;
    embedding_model: string;
  };
}

function getOllamaBaseUrl() {
  return process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
}

function getOllamaChatModel() {
  return process.env.OLLAMA_CHAT_MODEL || "qwen2.5:3b-instruct";
}

function getOllamaEmbeddingModel() {
  return process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
}

function getOllamaTemperature() {
  return Number(process.env.OLLAMA_TEMPERATURE ?? 0.2);
}

function getTopK() {
  return Number(process.env.RAG_TOP_K ?? 5);
}

let embeddingsClient: OllamaEmbeddings | null = null;
let chatModel: ChatOllama | null = null;

function getEmbeddingsClient() {
  if (!embeddingsClient) {
    embeddingsClient = new OllamaEmbeddings({
      model: getOllamaEmbeddingModel(),
      baseUrl: getOllamaBaseUrl(),
    });
  }
  return embeddingsClient;
}

function getChatModel() {
  if (!chatModel) {
    chatModel = new ChatOllama({
      model: getOllamaChatModel(),
      baseUrl: getOllamaBaseUrl(),
      temperature: getOllamaTemperature(),
    });
  }
  return chatModel;
}

function stableJson(value: unknown): string {
  if (value == null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function truthyKeys(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === "string") {
    try {
      return truthyKeys(JSON.parse(value));
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  return Object.entries(value as Record<string, unknown>)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key.replace(/_/g, " "));
}

function stringifyList(items: string[]) {
  return items.length > 0 ? items.join(", ") : "None recorded";
}

function summarizeVehicles(value: unknown) {
  const vehicles = Array.isArray(value) ? value : [];
  if (vehicles.length === 0) return "No vehicle details recorded";
  return vehicles
    .map((vehicle: any, index) => {
      const registration = vehicle?.registration_number || "Unknown registration";
      const classType = vehicle?.class_type || "Unknown type";
      return `Vehicle ${index + 1}: ${registration} (${classType})`;
    })
    .join("; ");
}

function summarizeDrivers(value: unknown) {
  const drivers = Array.isArray(value) ? value : [];
  if (drivers.length === 0) return "No driver details recorded";
  return drivers
    .map((driver: any, index) => {
      const name = driver?.name || "Unknown";
      const dlNumber = driver?.dl_number || "No DL";
      const authority = driver?.licensing_authority || "No authority";
      return `Driver ${index + 1}: ${name}, DL ${dlNumber}, Authority ${authority}`;
    })
    .join("; ");
}

export function buildSubmissionRagContent(submission: AccidentSubmissionRecord) {
  return [
    `FIR ${submission.fir_number}`,
    `District: ${submission.district}`,
    `Location: ${submission.place_of_accident}, ${submission.mandal}`,
    `Police Station: ${submission.police_station}`,
    `Road Type: ${submission.road_type}`,
    `Accident Date: ${submission.accident_date}`,
    `Accident Time: ${submission.accident_time || "Not recorded"}`,
    `Coordinates: ${submission.lat_long || "Not recorded"}`,
    `Casualties: ${submission.persons_died} deaths, ${submission.persons_injured} injuries`,
    `Vehicles: ${summarizeVehicles(submission.vehicles)}`,
    `Drivers: ${summarizeDrivers(submission.drivers)}`,
    `Driver-related causes: ${stringifyList(truthyKeys(submission.driver_related_causes))}`,
    `Vehicle condition causes: ${stringifyList(truthyKeys(submission.vehicle_condition_causes))}`,
    `Road engineering nature factors: ${stringifyList(truthyKeys(submission.road_engineering_nature))}`,
    `Road engineering junction factors: ${stringifyList(truthyKeys(submission.road_engineering_junctions))}`,
    `Road engineering signage factors: ${stringifyList(truthyKeys(submission.road_engineering_signages))}`,
    `Road engineering median factors: ${stringifyList(truthyKeys(submission.road_engineering_median))}`,
    `Road engineering culvert factors: ${stringifyList(truthyKeys(submission.road_engineering_culverts))}`,
  ].join("\n");
}

function buildContentHash(submission: AccidentSubmissionRecord) {
  return crypto
    .createHash("sha256")
    .update(stableJson(submission))
    .digest("hex");
}

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) return -1;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) return -1;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

async function fetchCachedEmbeddings(submissionIds: string[]) {
  if (submissionIds.length === 0) return new Map<string, CachedEmbeddingRow>();
  const result = await pool.query<CachedEmbeddingRow>(
    `SELECT submission_id, content_hash, embedding, content
     FROM submission_rag_cache
     WHERE submission_id = ANY($1::uuid[])`,
    [submissionIds]
  );
  return new Map(result.rows.map((row) => [row.submission_id, row]));
}

async function upsertCachedEmbedding(submissionId: string, contentHash: string, content: string, embedding: number[]) {
  await pool.query(
    `INSERT INTO submission_rag_cache (submission_id, content_hash, content, embedding, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, now())
     ON CONFLICT (submission_id)
     DO UPDATE SET
       content_hash = EXCLUDED.content_hash,
       content = EXCLUDED.content,
       embedding = EXCLUDED.embedding,
       updated_at = now()`,
    [submissionId, contentHash, content, JSON.stringify(embedding)]
  );
}

export async function ensureSubmissionEmbeddings(submissions: AccidentSubmissionRecord[]) {
  const cachedMap = await fetchCachedEmbeddings(submissions.map((submission) => submission.id));
  const ready = new Map<string, { content: string; embedding: number[] }>();
  const missing: Array<{ submission: AccidentSubmissionRecord; content: string; contentHash: string }> = [];

  for (const submission of submissions) {
    const content = buildSubmissionRagContent(submission);
    const contentHash = buildContentHash(submission);
    const cached = cachedMap.get(submission.id);

    if (cached && cached.content_hash === contentHash && Array.isArray(cached.embedding)) {
      ready.set(submission.id, { content: cached.content, embedding: cached.embedding });
      continue;
    }

    missing.push({ submission, content, contentHash });
  }

  if (missing.length > 0) {
    const vectors = await getEmbeddingsClient().embedDocuments(missing.map((item) => item.content));
    for (let index = 0; index < missing.length; index += 1) {
      const item = missing[index];
      const embedding = vectors[index];
      await upsertCachedEmbedding(item.submission.id, item.contentHash, item.content, embedding);
      ready.set(item.submission.id, { content: item.content, embedding });
    }
  }

  return ready;
}

export async function retrieveRelevantSubmissions(
  submissions: AccidentSubmissionRecord[],
  question: string
) {
  const embeddingMap = await ensureSubmissionEmbeddings(submissions);
  const queryEmbedding = await getEmbeddingsClient().embedQuery(question);

  return submissions
    .map((submission) => {
      const cached = embeddingMap.get(submission.id);
      return {
        submission,
        score: cached ? cosineSimilarity(queryEmbedding, cached.embedding) : -1,
        content: cached?.content || buildSubmissionRagContent(submission),
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.min(getTopK(), submissions.length));
}

function buildHistory(history?: Array<{ role: "user" | "assistant"; content: string }>) {
  if (!history || history.length === 0) return "No prior conversation.";
  return history
    .slice(-6)
    .map((item) => `${item.role === "user" ? "User" : "Assistant"}: ${item.content}`)
    .join("\n");
}

const analysisPrompt = PromptTemplate.fromTemplate(
  `You are an expert road accident analyst for Andhra Pradesh Police.

Use only the retrieved context provided below. Do not invent facts not grounded in the context.
If the user asks for recommendations, make them practical and specific.
If the question is narrow, answer only that narrow question.

Retrieved accident context:
{context}

Recent conversation:
{history}

Question:
{question}

Answer with short sections and concise bullets when useful.`
);

const analysisChain = RunnableSequence.from([
  analysisPrompt,
  getChatModel(),
  new StringOutputParser(),
]);

export async function analyzeWithLocalRag(options: {
  submissions: AccidentSubmissionRecord[];
  question: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<AnalysisResult> {
  const retrieved = await retrieveRelevantSubmissions(options.submissions, options.question);
  const contextDocuments = retrieved.map(
    (item) =>
      new Document({
        pageContent: item.content,
        metadata: {
          submissionId: item.submission.id,
          firNumber: item.submission.fir_number,
          district: item.submission.district,
          similarityScore: item.score,
        },
      })
  );

  const context = contextDocuments
    .map((doc, index) => {
      const metadata = doc.metadata as Record<string, unknown>;
      return `Context ${index + 1} (FIR ${metadata.firNumber}, District ${metadata.district}, Similarity ${(Number(metadata.similarityScore) || 0).toFixed(3)}):\n${doc.pageContent}`;
    })
    .join("\n\n");

  const response = await analysisChain.invoke({
    context,
    history: buildHistory(options.history),
    question: options.question,
  });

  return {
    response,
    model: getOllamaChatModel(),
    contextSubmissions: retrieved.map((item) => ({
      id: item.submission.id,
      fir_number: item.submission.fir_number,
      district: item.submission.district,
      score: Number(item.score.toFixed(4)),
    })),
    retrieval: {
      query: options.question,
      documents_considered: options.submissions.length,
      top_k: retrieved.length,
      embedding_model: getOllamaEmbeddingModel(),
    },
  };
}

export function getLocalRagConfig() {
  return {
    ollamaBaseUrl: getOllamaBaseUrl(),
    chatModel: getOllamaChatModel(),
    embeddingModel: getOllamaEmbeddingModel(),
  };
}
