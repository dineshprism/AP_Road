import { Router, Response } from "express";

const router = Router();

// Test endpoint to debug issues
router.get("/test", (_req, res) => {
  res.json({ 
    message: "RAG API is working",
    timestamp: new Date().toISOString(),
    ollama: "Testing connection to Ollama..."
  });
});

// Test Ollama connection
router.post("/test-ollama", async (_req, res) => {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "phi3:mini",
        prompt: "Hello, this is a test",
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    res.json({ 
      success: true,
      ollamaResponse: data.response,
      model: "phi3:mini"
    });
  } catch (error: any) {
    console.error("Ollama test error:", error);
    res.json({ 
      success: false,
      error: error.message 
    });
  }
});

export default router;
