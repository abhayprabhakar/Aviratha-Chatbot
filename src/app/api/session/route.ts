import { NextRequest, NextResponse } from 'next/server'
import { SessionService } from '@/lib/session'

const sessionService = new SessionService()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { isAdmin = false, userId } = body

    let result
    if (userId) {
      // Find or create a session for this user
      result = await sessionService.findOrCreateUserSession(userId, isAdmin)
    } else {
      // Create a new anonymous session
      result = await sessionService.createSession(isAdmin)
    }

    return NextResponse.json({ 
      success: true, 
      sessionId: result.sessionId, 
      token: result.token 
    })
  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create session' },
      { status: 500 }
    )
  }
}

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

    const stats = await sessionService.getSessionStats(session.sessionId)

    return NextResponse.json({ 
      success: true, 
      session: {
        sessionId: session.sessionId,
        isAdmin: session.isAdmin,
        createdAt: session.createdAt
      },
      stats
    })
  } catch (error) {
    console.error('Session validation error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to validate session' },
      { status: 500 }
    )
  }
}
