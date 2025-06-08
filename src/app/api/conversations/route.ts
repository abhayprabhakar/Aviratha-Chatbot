import { NextRequest, NextResponse } from 'next/server'
import { SessionService } from '@/lib/session'

const sessionService = new SessionService()

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('id')

    if (conversationId) {
      // Get specific conversation messages
      const messages = await sessionService.getConversationMessages(conversationId, session.sessionId)
      return NextResponse.json({
        success: true,
        messages
      })
    } else {
      // Get all conversations for the session
      const conversations = await sessionService.getConversations(session.sessionId)
      return NextResponse.json({
        success: true,
        conversations
      })
    }

  } catch (error) {
    console.error('Get conversations error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve conversations' },
      { status: 500 }
    )
  }
}

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
    const { title } = body

    const conversationId = await sessionService.createConversation(session.sessionId, title)

    return NextResponse.json({
      success: true,
      conversationId
    })

  } catch (error) {
    console.error('Create conversation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create conversation' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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
    const { conversationId, title } = body

    if (!conversationId || !title) {
      return NextResponse.json(
        { success: false, error: 'Conversation ID and title are required' },
        { status: 400 }
      )
    }

    const updated = await sessionService.updateConversationTitle(conversationId, session.sessionId, title)

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found or access denied' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Conversation title updated successfully'
    })

  } catch (error) {
    console.error('Update conversation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update conversation' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('id')

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    const deleted = await sessionService.deleteConversation(conversationId, session.sessionId)

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found or access denied' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully'
    })

  } catch (error) {
    console.error('Delete conversation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete conversation' },
      { status: 500 }
    )
  }
}
