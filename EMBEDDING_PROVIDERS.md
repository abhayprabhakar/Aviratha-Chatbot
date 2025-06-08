# Alternative Embedding Providers Configuration

This document explains how to configure different embedding providers as alternatives to OpenAI.

## Supported Providers

### 1. Google Gemini Embeddings (Recommended Free Alternative)
- **Cost**: Free tier with generous limits
- **Quality**: Excellent, comparable to OpenAI
- **Setup**: Easy API key configuration

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your API key from: https://aistudio.google.com/app/apikey

### 2. Hugging Face Embeddings (Free/Open Source)
- **Cost**: Free tier available, paid for higher usage
- **Quality**: Good, many model options
- **Setup**: API key or self-hosted

```env
HUGGINGFACE_API_KEY=your_hf_api_key_here
```

Popular models:
- `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions, fast)
- `sentence-transformers/all-mpnet-base-v2` (768 dimensions, better quality)
- `BAAI/bge-small-en-v1.5` (384 dimensions, optimized)

### 3. Cohere Embeddings
- **Cost**: Free tier, then paid
- **Quality**: Very good
- **Setup**: API key required

```env
COHERE_API_KEY=your_cohere_api_key_here
```

### 4. Ollama (Local/Self-Hosted)
- **Cost**: Free (runs locally)
- **Quality**: Good, depends on model
- **Setup**: Install Ollama locally

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull embedding model
ollama pull nomic-embed-text
```

### 5. Local Embeddings (Fallback)
- **Cost**: Free
- **Quality**: Basic (for development/testing)
- **Setup**: No configuration needed

## Configuration Priority

The system will automatically choose the first available provider in this order:

1. **Gemini** (if `GEMINI_API_KEY` is set)
2. **Hugging Face** (if `HUGGINGFACE_API_KEY` is set)
3. **Cohere** (if `COHERE_API_KEY` is set)
4. **OpenAI** (if `OPENAI_API_KEY` is set)
5. **Ollama** (if running locally)
6. **Local fallback** (always available)

## Usage Examples

### Environment Variables (.env.local)

```env
# Option 1: Use Gemini (Recommended)
GEMINI_API_KEY=your_gemini_key

# Option 2: Use Hugging Face
HUGGINGFACE_API_KEY=your_huggingface_key

# Option 3: Use Cohere
COHERE_API_KEY=your_cohere_key

# Option 4: Use OpenAI (original)
OPENAI_API_KEY=your_openai_key

# Ollama endpoint (if using local Ollama)
OLLAMA_ENDPOINT=http://localhost:11434
```

### Programmatic Configuration

```typescript
import { MultiVectorService } from '@/lib/vector-multi'

// Use specific provider
const vectorService = new MultiVectorService({
  provider: 'gemini',
  model: 'text-embedding-004'
})

// Or use auto-detection
const autoService = createVectorService()
```

## Model Recommendations

### For Production:
1. **Gemini**: `text-embedding-004` (768 dimensions)
2. **OpenAI**: `text-embedding-ada-002` (1536 dimensions)
3. **Cohere**: `embed-english-v3.0` (1024 dimensions)

### For Development/Testing:
1. **Hugging Face**: `sentence-transformers/all-MiniLM-L6-v2`
2. **Ollama**: `nomic-embed-text`
3. **Local fallback**

## Migration Guide

### From OpenAI to Gemini:
1. Get Gemini API key from Google AI Studio
2. Add `GEMINI_API_KEY` to your environment
3. The system will automatically use Gemini

### From OpenAI to Hugging Face:
1. Create account at huggingface.co
2. Generate API token
3. Add `HUGGINGFACE_API_KEY` to environment

### To Use Local Embeddings:
1. Install Ollama: `curl -fsSL https://ollama.ai/install.sh | sh`
2. Pull model: `ollama pull nomic-embed-text`
3. Start Ollama service
4. System will auto-detect and use Ollama

## Performance Comparison

| Provider | Speed | Quality | Cost | Dimensions |
|----------|-------|---------|------|------------|
| OpenAI | Fast | Excellent | Paid | 1536 |
| Gemini | Fast | Excellent | Free/Paid | 768 |
| Cohere | Fast | Very Good | Free/Paid | 1024 |
| HuggingFace | Medium | Good | Free/Paid | 384-768 |
| Ollama | Slow | Good | Free | 384-768 |
| Local | Fast | Basic | Free | 384 |

## Troubleshooting

### Common Issues:

1. **"Provider not configured"**
   - Check environment variables
   - Verify API keys are valid

2. **"Vector dimension mismatch"**
   - Different providers use different dimensions
   - Clear existing embeddings when switching providers

3. **"Ollama connection failed"**
   - Ensure Ollama is running: `ollama serve`
   - Check endpoint configuration

4. **Rate limits**
   - Implement exponential backoff
   - Use batch processing for large documents

### Clear Existing Embeddings (when switching providers):

```sql
-- Clear all embeddings (run in database)
DELETE FROM DocumentChunk WHERE embedding IS NOT NULL;
```

## Next Steps

1. Choose your preferred provider
2. Add the API key to your `.env.local` file
3. Restart your application
4. Re-upload documents to generate new embeddings
