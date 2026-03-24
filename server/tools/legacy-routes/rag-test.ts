import { Router, Response } from "express";

const router = Router();

// Simple test without authentication
router.post("/analyze-test", async (req, res) => {
  try {
    console.log("RAG analyze request received:", req.body);
    
    // Test Ollama connection
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "phi3:mini",
        prompt: "Analyze this traffic accident: A car crashed on NH-16 during rainy season. What are the main causes and preventive measures?",
        stream: false,
      }),
    });

    if (!response.ok) {
      console.error("Ollama API error:", response.status);
      return res.status(500).json({ error: "Ollama API error" });
    }

    const data = await response.json();
    console.log("Ollama response:", data);

    res.json({ 
      success: true,
      response: data.response,
      model: "phi3:mini"
    });
    
  } catch (error: any) {
    console.error("RAG test error:", error);
    res.status(500).json({ 
      error: error.message,
      details: error.toString()
    });
  }
});

export default router;
