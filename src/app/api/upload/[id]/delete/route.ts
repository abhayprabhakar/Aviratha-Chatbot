import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ success: false, error: 'No document ID provided' }, { status: 400 })
  }
  try {
    // Delete all chunks for this document
    await prisma.documentChunk.deleteMany({ where: { documentId: id } })
    // Delete the document itself
    await prisma.document.delete({ where: { id } })
    // Try to delete the file from uploads/ if it exists
    try {
      const doc = await prisma.document.findUnique({ where: { id } })
      if (doc && doc.fileName) {
        const fs = await import('fs')
        const path = await import('path')
        const uploadPath = path.join(process.cwd(), 'uploads', doc.fileName)
        if (fs.existsSync(uploadPath)) {
          fs.unlinkSync(uploadPath)
        }
      }
    } catch (e) {
      // Ignore file delete errors
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as any)?.message || 'Failed to delete document' }, { status: 500 })
  }
}
