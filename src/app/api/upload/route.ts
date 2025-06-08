import { NextRequest, NextResponse } from 'next/server'
import { SessionService } from '@/lib/session'
import { uploadRateLimit, rateLimitMiddleware } from '@/lib/rate-limit'
import { createVectorService } from '@/lib/vector-multi'
import { prisma } from '@/lib/prisma'

const sessionService = new SessionService()
const vectorService = createVectorService()
const FLASK_SERVER_URL = 'http://localhost:5000'

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, uploadRateLimit)
  if (rateLimitResponse) {
    return rateLimitResponse
  }  try {
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

    // Get the form data from the request
    const formData = await request.formData()
    
    // Create a new FormData to forward to Flask
    const flaskFormData = new FormData()
    
    // Copy all form fields
    for (const [key, value] of formData.entries()) {
      flaskFormData.append(key, value)
    }

    // Forward the request to Flask server with Flask token
    const flaskResponse = await fetch(`${FLASK_SERVER_URL}/upload`, {      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flaskToken}`
      },
      body: flaskFormData
    })

    const flaskResult = await flaskResponse.json()
    
    // If upload was successful, generate embeddings for RAG
    if (flaskResult.success && flaskResult.document) {
      try {
        console.log('🔄 Starting embedding generation for document:', flaskResult.document.id)
        
        // Create document record in Prisma database
        const document = await prisma.document.create({
          data: {
            id: flaskResult.document.id,
            title: flaskResult.document.title,
            fileName: flaskResult.document.fileName,
            content: flaskResult.document.content,
            fileType: flaskResult.document.fileType,            fileSize: parseInt(flaskResult.document.fileSize),
            uploadedBy: session.sessionId,
            isPublic: flaskResult.document.isPublic || false,
            metadata: flaskResult.document.metadata ? JSON.stringify(flaskResult.document.metadata) : undefined
          }
        })
        
        // Split content into chunks
        const chunks = vectorService.splitTextIntoChunks(document.content, 1000, 200)
        console.log(`📄 Split document into ${chunks.length} chunks`)
        
        // Generate embeddings for chunks
        await vectorService.createDocumentEmbeddings(document.id, chunks)
        console.log('✅ Embeddings generated successfully')
        
        // Add embedding info to response
        flaskResult.embeddings = {
          generated: true,
          chunkCount: chunks.length
        }
        
      } catch (embeddingError) {
        console.error('❌ Embedding generation failed:', embeddingError)
        // Don't fail the upload, just log the error
        flaskResult.embeddings = {
          generated: false,
          error: 'Embedding generation failed, but document uploaded successfully'
        }
      }
    }
    
    // Return the Flask response to the client
    return NextResponse.json(flaskResult, { status: flaskResponse.status })

  } catch (error) {
    console.error('Upload proxy error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process upload request' },
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