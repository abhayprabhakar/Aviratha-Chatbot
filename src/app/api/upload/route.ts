import { NextRequest, NextResponse } from 'next/server'
import { SessionService } from '@/lib/session'
import { uploadRateLimit, rateLimitMiddleware } from '@/lib/rate-limit'
import { createVectorService } from '@/lib/vector-multi'
import { prisma } from '@/lib/prisma'

const sessionService = new SessionService()
const vectorService = createVectorService()
const FLASK_SERVER_URL = 'http://localhost:5000'

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Document uploads have been disabled. This chatbot uses a pre-loaded knowledge base.' 
    },
    { status: 403 }
  )
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

    // Validate Next.js session first
    const session = await sessionService.validateSession(token)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      )
    }

    // Create or get Flask session for this Next.js session
    let flaskToken = null
    try {
      const flaskSessionResponse = await fetch(`${FLASK_SERVER_URL}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: session.sessionId,
          userPreferences: {}
        })
      })

      if (flaskSessionResponse.ok) {
        const flaskSession = await flaskSessionResponse.json()
        flaskToken = flaskSession.token
      } else {
        throw new Error('Failed to create Flask session')
      }
    } catch (flaskError) {
      console.error('Flask session creation error:', flaskError)
      return NextResponse.json(
        { success: false, error: 'Failed to create processing session' },
        { status: 500 }
      )
    }

    // Forward the request to Flask server with Flask token
    const flaskResponse = await fetch(`${FLASK_SERVER_URL}/documents`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${flaskToken}`
      }
    })

    const flaskResult = await flaskResponse.json()
    
    // Return the Flask response to the client
    return NextResponse.json(flaskResult, { status: flaskResponse.status })

  } catch (error) {
    console.error('Get documents proxy error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve documents' },
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

    // Skip Next.js session validation - let Flask handle authentication
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('id')

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Forward the request to Flask server
    const flaskResponse = await fetch(`${FLASK_SERVER_URL}/documents/${documentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    const flaskResult = await flaskResponse.json()
    
    // Return the Flask response to the client
    return NextResponse.json(flaskResult, { status: flaskResponse.status })

  } catch (error) {
    console.error('Delete document proxy error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}