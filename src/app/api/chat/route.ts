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
    let fromKnowledgeBase = false
    let sourceCategories: string[] = []

    // Perform RAG search if enabled
    if (useRAG) {
      try {
        // Retrieve chunks, prioritizing the knowledge base documents
        const similarChunks = await vectorService.searchSimilarChunks(
          message, 
          8, // Increased from 5 to 8
          'knowledge-base-admin' // Always search as the knowledge base admin
        )
        
        if (similarChunks.length > 0) {
          // Extract source categories from document titles
          sourceCategories = similarChunks
            .map(chunk => {
              const title = chunk.metadata?.documentTitle || '';
              // Extract category from "Category - Document Name" pattern
              const categoryMatch = title.match(/^([^-]+) -/);
              return categoryMatch ? categoryMatch[1].trim() : '';
            })
            .filter(Boolean);

          // Create a Set to remove duplicates
          sourceCategories = [...new Set(sourceCategories)];
          
          // Check if any chunks have high similarity (from knowledge base)
          fromKnowledgeBase = similarChunks.some(chunk => chunk.similarity > 0.5);
          
          context = similarChunks.map(chunk => 
            `Source: ${chunk.metadata?.documentTitle || 'Unknown'}\n${chunk.content}`
          );
        }
      } catch (error) {
        console.warn('RAG search failed:', error)
        // Continue without RAG context
      }
    }

    // Generate system prompt
    const systemPrompt = generateSystemPrompt(context, fromKnowledgeBase);

    // Add system message to the beginning of chat messages
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...chatMessages
    ];

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
        type: 'ai_response', // Add this type field
        llmProvider: llmConfig.provider,
        llmModel: llmConfig.model,
        ragUsed: context.length > 0,
        contextSources: context.length,
        fromKnowledgeBase: fromKnowledgeBase,
        sourceCategories: sourceCategories.join(', '),
        timestamp: new Date().toISOString()
      } as any // Add this type assertion
    )

    return NextResponse.json({
  success: true,
  response: aiResponse,
  conversationId: currentConversationId,
  // Use the actual values
  contextUsed: context.length > 0,
  sourcesCount: context.length,
  sourceCategories: Array.from(new Set(sourceCategories)).join(', '),
  fromKnowledgeBase: fromKnowledgeBase // Use the variable you already calculated
})

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}

// Update the generateSystemPrompt function:
function generateSystemPrompt(context: string[], fromKnowledgeBase: boolean): string {
  if (context.length === 0) {
    return `You are a helpful AI assistant specializing in hydroponics. 
    IMPORTANT: If asked about hydroponics topics, clearly state that you don't have specific information from the hydroponics knowledge base on that particular topic.
    For questions not related to hydroponics, respond helpfully without this disclaimer.`;
  }

  return `You are a specialized hydroponics assistant with access to expert information.
  IMPORTANT: Base your answer ONLY on the following hydroponics knowledge base information:
  
  ${context.join('\n\n')}
  
  Answer questions precisely using this information. If the knowledge base doesn't contain complete information to answer the question:
  1. First provide what information IS available from the knowledge base
  2. Then clearly state: "The knowledge base doesn't contain complete information on this specific point."
  3. Only then provide a general answer based on your training, clearly indicating it's not from the knowledge base.
  
  Always prioritize the knowledge base information when answering.`;
}