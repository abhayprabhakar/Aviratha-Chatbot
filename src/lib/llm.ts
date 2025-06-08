import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'
import axios from 'axios'

export interface LLMConfig {
  provider: 'openai' | 'gemini' | 'claude' | 'ollama'
  model: string
  temperature?: number
  maxTokens?: number
  streaming?: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export class LLMService {
  private openai?: OpenAI
  private gemini?: GoogleGenerativeAI
  private claude?: Anthropic

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    }
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    }
    if (process.env.ANTHROPIC_API_KEY) {
      this.claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    }
  }

  async generateResponse(
    messages: ChatMessage[],
    config: LLMConfig,
    context?: string[]
  ): Promise<string> {
    const systemMessage = context && context.length > 0 
      ? `You are a helpful AI assistant with access to the following relevant information:\n\n${context.join('\n\n')}\n\nUse this information to help answer the user's questions when relevant.`
      : 'You are a helpful AI assistant.'

    const fullMessages: ChatMessage[] = [
      { role: 'system', content: systemMessage },
      ...messages
    ]

    switch (config.provider) {
      case 'openai':
        return this.generateOpenAIResponse(fullMessages, config)
      case 'gemini':
        return this.generateGeminiResponse(fullMessages, config)
      case 'claude':
        return this.generateClaudeResponse(fullMessages, config)
      case 'ollama':
        return this.generateOllamaResponse(fullMessages, config)
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`)
    }
  }

  private async generateOpenAIResponse(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    if (!this.openai) throw new Error('OpenAI not configured')

    const response = await this.openai.chat.completions.create({
      model: config.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 2000
    })

    return response.choices[0]?.message?.content || 'No response generated'
  }

  private async generateGeminiResponse(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    if (!this.gemini) throw new Error('Gemini not configured')

    const model = this.gemini.getGenerativeModel({ model: config.model })
    
    // Convert messages to Gemini format
    const prompt = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n')

    const systemPrompt = messages.find(msg => msg.role === 'system')?.content || ''
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt

    const result = await model.generateContent(fullPrompt)
    return result.response.text()
  }

  private async generateClaudeResponse(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    if (!this.claude) throw new Error('Claude not configured')

    const systemMessage = messages.find(msg => msg.role === 'system')
    const chatMessages = messages.filter(msg => msg.role !== 'system')

    const response = await this.claude.messages.create({
      model: config.model,
      max_tokens: config.maxTokens || 2000,
      temperature: config.temperature || 0.7,
      system: systemMessage?.content,
      messages: chatMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))
    })

    return response.content[0]?.type === 'text' ? response.content[0].text : 'No response generated'
  }

  private async generateOllamaResponse(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    
    try {
      const response = await axios.post(`${baseUrl}/api/chat`, {
        model: config.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: false,
        options: {
          temperature: config.temperature || 0.7,
          num_predict: config.maxTokens || 2000
        }
      })

      return response.data.message?.content || 'No response generated'
    } catch (error) {
      throw new Error(`Ollama request failed: ${error}`)
    }
  }

  async getAvailableModels(provider: string): Promise<string[]> {
    switch (provider) {
      case 'openai':
        return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
      case 'gemini':
        return ['gemini-pro', 'gemini-pro-vision']
      case 'claude':
        return ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
      case 'ollama':
        return this.getOllamaModels()
      default:
        return []
    }
  }

  private async getOllamaModels(): Promise<string[]> {
    try {
      const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
      const response = await axios.get(`${baseUrl}/api/tags`)
      return response.data.models?.map((model: any) => model.name) || []
    } catch (error) {
      console.warn('Failed to fetch Ollama models:', error)
      return ['llama2', 'codellama', 'mistral']
    }
  }

  async generateStreamingResponse(
    messages: ChatMessage[], 
    config: LLMConfig, 
    context?: string[]
  ): Promise<AsyncIterable<string>> {
    const fullMessages = this.buildMessages(messages, context)
    
    switch (config.provider) {
      case 'openai':
        return this.generateOpenAIStreamingResponse(fullMessages, config)
      case 'gemini':
        return this.generateGeminiStreamingResponse(fullMessages, config)
      case 'claude':
        return this.generateClaudeStreamingResponse(fullMessages, config)
      case 'ollama':
        return this.generateOllamaStreamingResponse(fullMessages, config)
      default:
        throw new Error(`Streaming not supported for provider: ${config.provider}`)
    }
  }

  private async *generateOpenAIStreamingResponse(messages: ChatMessage[], config: LLMConfig): AsyncIterable<string> {
    if (!this.openai) throw new Error('OpenAI not configured')

    const stream = await this.openai.chat.completions.create({
      model: config.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 2000,
      stream: true
    })

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) {
        yield content
      }
    }
  }

  private async *generateGeminiStreamingResponse(messages: ChatMessage[], config: LLMConfig): AsyncIterable<string> {
    if (!this.gemini) throw new Error('Gemini not configured')

    const model = this.gemini.getGenerativeModel({ model: config.model })
    
    const prompt = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n')

    const systemPrompt = messages.find(msg => msg.role === 'system')?.content || ''
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt

    const result = await model.generateContentStream(fullPrompt)
    
    for await (const chunk of result.stream) {
      const chunkText = chunk.text()
      if (chunkText) {
        yield chunkText
      }
    }
  }

  private async *generateClaudeStreamingResponse(messages: ChatMessage[], config: LLMConfig): AsyncIterable<string> {
    if (!this.claude) throw new Error('Claude not configured')

    const systemMessage = messages.find(msg => msg.role === 'system')
    const chatMessages = messages.filter(msg => msg.role !== 'system')

    const stream = await this.claude.messages.create({
      model: config.model,
      max_tokens: config.maxTokens || 2000,
      temperature: config.temperature || 0.7,
      system: systemMessage?.content,
      messages: chatMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      stream: true
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield chunk.delta.text
      }
    }
  }

  private async *generateOllamaStreamingResponse(messages: ChatMessage[], config: LLMConfig): AsyncIterable<string> {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    
    try {
      const response = await axios.post(`${baseUrl}/api/chat`, {
        model: config.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: true,
        options: {
          temperature: config.temperature || 0.7,
          num_predict: config.maxTokens || 2000
        }
      }, {
        responseType: 'stream'
      })

      for await (const chunk of response.data) {
        const data = JSON.parse(chunk.toString())
        if (data.message?.content) {
          yield data.message.content
        }
      }
    } catch (error) {
      throw new Error(`Ollama streaming request failed: ${error}`)
    }
  }

  private buildMessages(messages: ChatMessage[], context?: string[]): ChatMessage[] {
    const systemMessage = context && context.length > 0 
      ? `You are a helpful AI assistant with access to the following relevant information:\n\n${context.join('\n\n')}\n\nUse this information to help answer the user's questions when relevant.`
      : 'You are a helpful AI assistant.'

    return [
      { role: 'system', content: systemMessage },
      ...messages
    ]
  }
}
