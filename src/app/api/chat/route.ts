import { NextRequest, NextResponse } from 'next/server'
import { SessionService } from '@/lib/session'
import { LLMService, LLMConfig } from '@/lib/llm'
import { createVectorService } from '@/lib/vector-multi'
import { chatRateLimit, rateLimitMiddleware } from '@/lib/rate-limit'

const sessionService = new SessionService()
const llmService = new LLMService()
const vectorService = createVectorService()

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, chatRateLimit)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      )
    }

    const session = await sessionService.validateSession(token)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      message, 
      conversationId, 
      llmConfig,
      useRAG = true
    }: {
      message: string
      conversationId?: string
      llmConfig: LLMConfig
      useRAG?: boolean
    } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    // Create conversation if not provided
    let currentConversationId = conversationId
    if (!currentConversationId) {
      currentConversationId = await sessionService.createConversation(session.sessionId)
    }

    // Add user message to conversation
    await sessionService.addMessage(currentConversationId, 'user', message)

    // Get conversation history
    const messages = await sessionService.getConversationMessages(currentConversationId, session.sessionId)
    const chatMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))

    let context: string[] = []

    // Perform RAG search if enabled
    if (useRAG) {
      try {
        const similarChunks = await vectorService.searchSimilarChunks(
          message, 
          5, 
          session.sessionId
        )
        
        context = similarChunks.map(chunk => 
          `Source: ${chunk.metadata?.documentTitle || 'Unknown'}\n${chunk.content}`
        )
      } catch (error) {
        console.warn('RAG search failed:', error)
        // Continue without RAG context
      }
    }

    // Generate AI response
    const aiResponse = await llmService.generateResponse(
      chatMessages,
      llmConfig,
      context.length > 0 ? context : undefined
    )

    // Add AI response to conversation
    await sessionService.addMessage(
      currentConversationId, 
      'assistant', 
      aiResponse,
      {
        llmProvider: llmConfig.provider,
        llmModel: llmConfig.model,
        ragUsed: context.length > 0,
        contextSources: context.length,
        timestamp: new Date().toISOString()
      }
    )

    return NextResponse.json({
      success: true,
      response: aiResponse,
      conversationId: currentConversationId,
      contextUsed: context.length > 0,
      sourcesCount: context.length
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}
