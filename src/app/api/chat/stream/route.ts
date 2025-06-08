import { NextRequest } from 'next/server'
import { SessionService } from '@/lib/session'
import { LLMService, LLMConfig } from '@/lib/llm'
import { createVectorService } from '@/lib/vector-multi'

const sessionService = new SessionService()
const llmService = new LLMService()
const vectorService = createVectorService()

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'No token provided' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const session = await sessionService.validateSession(token)
    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
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
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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

    // Create streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial metadata
          const metadata = {
            type: 'metadata',
            conversationId: currentConversationId,
            contextUsed: context.length > 0,
            sourcesCount: context.length
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`))

          let fullResponse = ''

          // Generate streaming AI response
          const responseStream = await llmService.generateStreamingResponse(
            chatMessages,
            llmConfig,
            context.length > 0 ? context : undefined
          )

          // Stream the response
          for await (const chunk of responseStream) {
            fullResponse += chunk
            const data = {
              type: 'chunk',
              content: chunk
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
          }

          // Add AI response to conversation
          await sessionService.addMessage(
            currentConversationId, 
            'assistant', 
            fullResponse,
            {
              llmProvider: llmConfig.provider,
              llmModel: llmConfig.model,
              ragUsed: context.length > 0,
              contextSources: context.length,
              timestamp: new Date().toISOString()
            }
          )

          // Send completion signal
          const completion = {
            type: 'complete',
            fullResponse
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(completion)}\n\n`))
          controller.close()

        } catch (error) {
          console.error('Streaming error:', error)
          const errorData = {
            type: 'error',
            error: 'Failed to generate response'
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })

  } catch (error) {
    console.error('Chat stream API error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process chat message' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
