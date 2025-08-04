import { NextRequest, NextResponse } from 'next/server'
import { SessionService } from '@/lib/session'
import { LLMService } from '@/lib/llm'

const sessionService = new SessionService()
const llmService = new LLMService()

export async function POST(request: NextRequest) {
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
    const { conversationId } = body

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    // Get conversation messages
    const messages = await sessionService.getConversationMessages(conversationId, session.sessionId)
    
    // Only generate title if we have enough messages (at least 2-4 exchanges)
    if (messages.length < 3) {
      return NextResponse.json({
        success: false,
        error: 'Not enough messages to generate title'
      })
    }

    // Get first 2-3 exchanges (user + assistant pairs)
    const relevantMessages = messages.slice(0, 6) // First 3 exchanges max
    
    // Create a prompt for title generation
    const conversationText = relevantMessages
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n')

    const titlePrompt = `Based on this conversation about hydroponics, generate a short, descriptive title (3-6 words max) that captures the main topic discussed:

${conversationText}

Generate only the title, nothing else. Examples of good titles:
- "Lettuce Nutrient Deficiency"
- "DWC System Setup"
- "pH Problem Troubleshooting"
- "Tomato Growing Tips"
- "Plant Identification Help"

Title:`

    const generatedTitle = await llmService.generateResponse(
      [{ role: 'user', content: titlePrompt }],
      {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        temperature: 0.3,
        maxTokens: 50
      }
    )

    // Clean up the title (remove quotes, extra text, etc.)
    const cleanTitle = generatedTitle
      .trim()
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/^Title:\s*/i, '') // Remove "Title:" prefix
      .slice(0, 50) // Limit length

    // Update conversation title
    const success = await sessionService.updateConversationTitle(
      conversationId, 
      session.sessionId, 
      cleanTitle
    )

    if (success) {
      return NextResponse.json({
        success: true,
        title: cleanTitle
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to update conversation title'
      })
    }

  } catch (error) {
    console.error('Title generation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate title' },
      { status: 500 }
    )
  }
}