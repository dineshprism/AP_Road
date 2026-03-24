# Accident RAG System Architecture

## 1. Database Setup
- PostgreSQL + pgvector extension
- Store accident submissions as embeddings
- Vector similarity search

## 2. LLM Setup (Ollama)
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Download small model
ollama pull llama3.2:8b
ollama pull qwen2.5:7b

# Start Ollama server
ollama serve
```

## 3. RAG Pipeline (LangChain)

### Document Processing
- Accident submissions → text chunks
- Generate embeddings using sentence-transformers
- Store in pgvector with metadata

### Query Processing
- User question → embedding
- Vector search for relevant accidents
- Context + question → LLM response

## 4. Integration Points

### Backend API Endpoints
- `POST /api/rag/query` - Ask questions about accidents
- `POST /api/rag/analyze` - Get insights on patterns
- `GET /api/rag/similar/:id` - Find similar accidents

### Frontend Components
- Chat interface for natural language queries
- Accident pattern analysis
- Similar case recommendations

## 5. Use Cases

### For District Officers
- "Show me accidents with similar conditions"
- "What are common causes in my area?"
- "Suggest preventive measures for NH-16"

### For DGP/ADGP
- "Compare accident trends across districts"
- "Identify high-risk corridors"
- "Generate monthly safety insights"

### For Investigation
- "Find similar FIR patterns"
- "Suggest investigation steps"
- "Identify potential causes"

## 6. Sample Queries

### Pattern Analysis
- "What are the most common accident types in Visakhapatnam?"
- "Show me accidents involving trucks on NH-16"
- "What time do most fatal accidents occur?"

### Predictive Insights
- "Which areas need safety improvements?"
- "What are the risk factors for rainy season?"
- "Suggest patrol schedules based on accident hotspots"

### Case Assistance
- "Find similar cases to FIR #123"
- "What investigation steps should I take?"
- "Suggest witnesses for this accident type"
