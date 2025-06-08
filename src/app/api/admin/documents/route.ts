import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
// import { FileProcessingService } from '@/lib/file-processing'
import { verifySession } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    // In a real app, you'd check for admin permissions here
    const sessionData = await verifySession(request)
    
    const documents = await prisma.document.findMany({
      where: {
        isPublic: true // Only show public documents that maintainers can manage
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        title: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        uploadedBy: true,
        createdAt: true,
        isPublic: true
      }
    })

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Error fetching admin documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionData = await verifySession(request)
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('id')

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Delete document and its embeddings
    await prisma.documentChunk.deleteMany({
      where: { documentId }
    })

    await prisma.document.delete({
      where: { id: documentId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}
