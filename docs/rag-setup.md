# RAG Accident Analysis Setup Instructions

## 1. Install Dependencies

### Frontend Dependencies
```bash
npm install langchain @langchain/community axios
```

### Backend Dependencies  
```bash
cd server
npm install langchain @langchain/community
```

## 2. Setup Ollama (Local LLM)

### Install Ollama
```bash
# Windows (Download from https://ollama.com/download)
# Or use WSL/PowerShell

# Linux/Mac
curl -fsSL https://ollama.com/install.sh | sh
```

### Download Model
```bash
# Start Ollama server
ollama serve

# Download Llama 3.2 8B model (recommended)
ollama pull llama3.2:8b

# Alternative: Qwen 2.5 7B (smaller, faster)
ollama pull qwen2.5:7b
```

### Verify Installation
```bash
# Test the model
ollama run llama3.2:8b "Hello, can you help analyze traffic accidents?"
```

## 3. Start Your Application

### Terminal 1: Backend Server
```bash
cd server
npm run dev
```

### Terminal 2: Frontend
```bash
npm run dev
```

### Terminal 3: Ollama (if not running automatically)
```bash
ollama serve
```

## 4. Test the RAG Features

### Single Accident Analysis
1. Login as any district user
2. Go to "View Past Submissions" 
3. Click the **"Analyse"** button beside any submission
4. Chat interface opens with AI analysis

### Multi-Accident Analysis
1. Select multiple submissions using checkboxes
2. Click **"Analyse Selected (X)"** button
3. Chat interface opens with batch analysis

### Sample Questions to Ask
- "What are the main causes of these accidents?"
- "What preventive measures would you recommend?"
- "Are there any patterns in these accidents?"
- "What infrastructure improvements are needed?"
- "How can similar accidents be prevented?"

## 5. Troubleshooting

### If Chat Says "Ollama service not running"
- Make sure Ollama is installed and running
- Check if Ollama is accessible at http://localhost:11434
- Try: `ollama list` to see available models

### If Analysis is Slow
- Use smaller model: `ollama pull qwen2.5:7b`
- Close other applications to free up RAM
- Consider using a machine with more memory

### If No Response
- Check browser console for errors
- Verify backend is running on port 3000
- Check if Ollama model is downloaded: `ollama list`

## 6. Features Available

### ✅ Single Accident Analysis
- Detailed root cause analysis
- Preventive recommendations
- Infrastructure suggestions
- Investigation guidance

### ✅ Multi-Accident Analysis  
- Pattern detection across accidents
- Trend analysis
- Risk factor identification
- Policy recommendations

### ✅ Interactive Chat
- Natural language queries
- Follow-up questions
- Contextual responses
- Suggested questions

### ✅ Smart Integration
- Works with existing submission data
- No manual data entry required
- Real-time analysis
- User-friendly interface

## 7. Model Configuration

The system uses Llama 3.2 8B model by default, which provides:
- Good reasoning capabilities
- Fast local inference  
- No API costs
- Complete privacy
- Accident domain knowledge

You can switch to other models by changing the model name in `server/src/routes/rag.ts`:
```typescript
const ollama = new ChatOllama({
  baseUrl: "http://localhost:11434", 
  model: "qwen2.5:7b", // Change this
});
```

## 8. Next Steps

Once working, you can:
1. Add more sophisticated RAG with vector embeddings
2. Include historical accident data for better context
3. Add preventive measure recommendations database
4. Implement accident severity prediction
5. Add multi-language support (Telugu, Hindi, English)

This gives you a complete AI-powered accident analysis system! 🚀
