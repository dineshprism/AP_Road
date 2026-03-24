import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

console.log("Testing Gemini API...");

const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function testGemini() {
  try {
    console.log(`Calling Gemini model: ${model}`);
    const result = await ai.models.generateContent({
      model,
      contents: "Hello, can you analyze traffic accidents?",
    });
    console.log("SUCCESS Gemini Response:", result.text);
  } catch (error) {
    console.error("ERROR Gemini Error:", error.message);
  }
}

testGemini();
