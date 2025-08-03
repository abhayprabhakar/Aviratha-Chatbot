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

    // Try to validate session, but don't require it for summarization
    let session = null
    try {
      session = await sessionService.validateSession(token)
    } catch (error) {
      console.warn('Session validation failed, proceeding without session:', error)
    }

    const body = await request.json()
    const { content, conversationId, messageId } = body

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      )
    }

    // Generate summary using LLM
    const summaryPrompt = `Please provide a concise summary of the following text. Keep the key points and important information, but make it about 30-40% of the original length. Maintain the same tone and formatting style (including markdown if present):

${content}`

    const summary = await llmService.generateResponse(
      [{ role: 'user', content: summaryPrompt }],
      {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        temperature: 0.3,
        maxTokens: 1000
      }
    )

    return NextResponse.json({
      success: true,
      summary: summary.trim(),
      originalContent: content
    })

  } catch (error) {
    console.error('Summarization error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}