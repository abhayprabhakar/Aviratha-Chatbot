import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from './prisma'

export interface EmbeddingResult {
  id: string
  content: string
  similarity: number
  metadata?: any
}

export type EmbeddingProvider = 'openai' | 'gemini' | 'huggingface' | 'cohere' | 'ollama' | 'local'

export interface EmbeddingConfig {
  provider: EmbeddingProvider
  model?: string
  apiKey?: string
  endpoint?: string
  dimensions?: number
}

export class MultiVectorService {
  private openai?: OpenAI
  private gemini?: GoogleGenerativeAI
  private config: EmbeddingConfig

  constructor(config?: EmbeddingConfig) {
    this.config = config || {
      provider: 'openai',
      model: 'text-embedding-ada-002'
    }

    this.initializeProviders()
  }

  private initializeProviders() {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY && (this.config.provider === 'openai' || !this.config.provider)) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    }

    // Initialize Gemini
    if (process.env.GEMINI_API_KEY && this.config.provider === 'gemini') {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    }
  }

  async generateEmbedding(text: string): Promise<number[] | null> {
    const cleanText = text.replace(/\n/g, ' ').trim()

    switch (this.config.provider) {
      case 'openai':
        return this.generateOpenAIEmbedding(cleanText)
      case 'gemini':
        return this.generateGeminiEmbedding(cleanText)
      case 'huggingface':
        return this.generateHuggingFaceEmbedding(cleanText)
      case 'cohere':
        return this.generateCohereEmbedding(cleanText)
      case 'ollama':
        return this.generateOllamaEmbedding(cleanText)
      case 'local':
        return this.generateLocalEmbedding(cleanText)
      default:
        console.warn(`Unknown embedding provider: ${this.config.provider}`)
        return null
    }
  }

  private async generateOpenAIEmbedding(text: string): Promise<number[] | null> {
    if (!this.openai) {
      console.warn('OpenAI not configured for embeddings')
      return null
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.config.model || 'text-embedding-ada-002',
        input: text
      })
      return response.data[0].embedding
    } catch (error) {
      console.error('Error generating OpenAI embedding:', error)
      return null
    }
  }

  private async generateGeminiEmbedding(text: string): Promise<number[] | null> {
    if (!this.gemini) {
      console.warn('Gemini not configured for embeddings')
      return null
    }

    try {
      const model = this.gemini.getGenerativeModel({ 
        model: this.config.model || 'text-embedding-004'
      })
      
      const result = await model.embedContent(text)
      return result.embedding.values
    } catch (error) {
      console.error('Error generating Gemini embedding:', error)
      return null
    }
  }

  private async generateHuggingFaceEmbedding(text: string): Promise<number[] | null> {
    const apiKey = process.env.HUGGINGFACE_API_KEY
    if (!apiKey) {
      console.warn('Hugging Face API key not configured')
      return null
    }

    try {
      const model = this.config.model || 'sentence-transformers/all-MiniLM-L6-v2'
      const response = await fetch(
        `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({ inputs: text })
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      // Handle different response formats
      if (Array.isArray(result) && Array.isArray(result[0])) {
        return result[0] // Most common format
      } else if (Array.isArray(result)) {
        return result
      } else {
        console.error('Unexpected Hugging Face response format:', result)
        return null
      }
    } catch (error) {
      console.error('Error generating Hugging Face embedding:', error)
      return null
    }
  }

  private async generateCohereEmbedding(text: string): Promise<number[] | null> {
    const apiKey = process.env.COHERE_API_KEY
    if (!apiKey) {
      console.warn('Cohere API key not configured')
      return null
    }

    try {
      const response = await fetch('https://api.cohere.ai/v1/embed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: [text],
          model: this.config.model || 'embed-english-v3.0',
          input_type: 'search_document'
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      return result.embeddings[0]
    } catch (error) {
      console.error('Error generating Cohere embedding:', error)
      return null
    }
  }

  private async generateOllamaEmbedding(text: string): Promise<number[] | null> {
    const endpoint = this.config.endpoint || 'http://localhost:11434'
    
    try {
      const response = await fetch(`${endpoint}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model || 'nomic-embed-text',
          prompt: text
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      return result.embedding
    } catch (error) {
      console.error('Error generating Ollama embedding:', error)
      return null
    }
  }

  private async generateLocalEmbedding(text: string): Promise<number[] | null> {
    // This would use a local Python service or TensorFlow.js model
    // For now, return a simple hash-based embedding as fallback
    console.warn('Local embeddings not yet implemented, using fallback')
    
    // Simple fallback: create a basic embedding from text features
    const words = text.toLowerCase().split(/\s+/)
    const embedding = new Array(384).fill(0) // Common embedding dimension
    
    // Basic feature extraction (this is very primitive)
    words.forEach((word, index) => {
      const hash = this.simpleHash(word)
      embedding[hash % embedding.length] += 1
    })
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    if (norm > 0) {
      return embedding.map(val => val / norm)
    }
    
    return embedding
  }

  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  async createDocumentEmbeddings(documentId: string, chunks: string[]): Promise<void> {
    const embeddings: any[] = []
    
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.generateEmbedding(chunks[i])
      if (embedding) {
        embeddings.push({
          documentId,
          content: chunks[i],
          embedding: JSON.stringify(embedding),
          chunkIndex: i,
          embeddingProvider: this.config.provider,
          embeddingModel: this.config.model || 'default'
        })
      }
    }

    if (embeddings.length > 0) {
      await prisma.documentChunk.createMany({
        data: embeddings
      })
    }
  }

  async searchSimilarChunks(
    query: string, 
    limit: number = 5,
    sessionId?: string
  ): Promise<EmbeddingResult[]> {
    const queryEmbedding = await this.generateEmbedding(query)
    
    if (!queryEmbedding) {
      console.warn('Could not generate embedding for query - returning empty results')
      return []
    }

    // Always include the admin knowledge base
    const knowledgeBaseAdmin = 'knowledge-base-admin';
    
    // Get all chunks with their embeddings
    const chunks = await prisma.documentChunk.findMany({
      include: {
        document: {
          select: {
            title: true,
            fileName: true,
            isPublic: true,
            uploadedBy: true
          }
        }
      },
      where: {
        embedding: { not: null },
        document: {
          // This prioritizes knowledge base documents
          uploadedBy: knowledgeBaseAdmin
        }
      }
    })

    // Log number of chunks and their document info for debugging
    console.log(`[RAG DEBUG] Chunks loaded for similarity: ${chunks.length}`)
    
    // Calculate cosine similarity for each chunk
    const similarities = chunks.map(chunk => {
      const chunkEmbedding = JSON.parse(chunk.embedding!)
      const similarity = this.cosineSimilarity(queryEmbedding, chunkEmbedding)
      
      return {
        id: chunk.id,
        content: chunk.content,
        similarity,
        metadata: {
          documentTitle: chunk.document.title,
          fileName: chunk.document.fileName,
          chunkIndex: chunk.chunkIndex,
          embeddingProvider: (chunk as any).embeddingProvider || 'unknown',
          embeddingModel: (chunk as any).embeddingModel || 'unknown'
        }
      }
    })

    // Sort by similarity and return top results
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .filter(result => result.similarity > 0.1) // Lower threshold for broader matches
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      console.warn(`Vector dimension mismatch: ${a.length} vs ${b.length}`)
      // Pad shorter vector with zeros
      const maxLength = Math.max(a.length, b.length)
      const paddedA = [...a, ...new Array(maxLength - a.length).fill(0)]
      const paddedB = [...b, ...new Array(maxLength - b.length).fill(0)]
      return this.cosineSimilarity(paddedA, paddedB)
    }

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) return 0

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  // Split text into chunks for better embedding
  splitTextIntoChunks(text: string, maxChunkSize: number = 1000, overlap: number = 200): string[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const chunks: string[] = []
    let currentChunk = ''

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim()
      if (currentChunk.length + trimmedSentence.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        
        // Add overlap from the end of the current chunk
        const words = currentChunk.split(' ')
        const overlapWords = words.slice(-Math.floor(overlap / 10)) // Approximate word count for overlap
        currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence
      } else {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim())
    }

    return chunks.filter(chunk => chunk.length > 50) // Filter out very small chunks
  }

  // Method to switch embedding provider at runtime
  switchProvider(config: EmbeddingConfig) {
    this.config = config
    this.initializeProviders()
  }

  // Get provider info
  getProviderInfo() {
    return {
      provider: this.config.provider,
      model: this.config.model,
      configured: this.isProviderConfigured()
    }
  }

  private isProviderConfigured(): boolean {
    switch (this.config.provider) {
      case 'openai':
        return !!this.openai
      case 'gemini':
        return !!this.gemini
      case 'huggingface':
        return !!process.env.HUGGINGFACE_API_KEY
      case 'cohere':
        return !!process.env.COHERE_API_KEY
      case 'ollama':
        return true // Always available if endpoint is accessible
      case 'local':
        return true // Fallback is always available
      default:
        return false
    }
  }
}

// Factory function to create vector service with environment-based configuration
export function createVectorService(): MultiVectorService {
  // Auto-detect available providers
  if (process.env.GEMINI_API_KEY) {
    return new MultiVectorService({
      provider: 'gemini',
      model: 'text-embedding-004'
    })
  } else if (process.env.HUGGINGFACE_API_KEY) {
    return new MultiVectorService({
      provider: 'huggingface',
      model: 'sentence-transformers/all-MiniLM-L6-v2'
    })
  } else if (process.env.COHERE_API_KEY) {
    return new MultiVectorService({
      provider: 'cohere',
      model: 'embed-english-v3.0'
    })
  } else if (process.env.OPENAI_API_KEY) {
    return new MultiVectorService({
      provider: 'openai',
      model: 'text-embedding-ada-002'
    })
  } else {
    // Try Ollama as fallback
    return new MultiVectorService({
      provider: 'ollama',
      model: 'nomic-embed-text',
      endpoint: 'http://localhost:11434'
    })
  }
}
