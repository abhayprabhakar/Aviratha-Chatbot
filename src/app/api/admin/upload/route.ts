import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
// import { FileProcessingService } from '@/lib/file-processing'
import { verifySession } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    // In a real app, you'd check for admin permissions here
    const sessionData = await verifySession(request)
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Create uploads directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'uploads', 'admin')
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (error) {
      // Directory might already exist, ignore error
    }

    // Save file temporarily
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filePath = join(uploadDir, file.name)
    await writeFile(filePath, buffer)    // Process file and store in database
    // NOTE: FileProcessingService temporarily disabled for Flask backend integration
    // const fileProcessor = new FileProcessingService()
    // const processedDoc = await fileProcessor.processFile(
    //   filePath,
    //   file.name,
    //   'admin', // Uploaded by admin
    //   true // Mark as public (maintainer knowledge base)
    // )

    return NextResponse.json({ 
      success: true, 
      message: 'File uploaded successfully',
      fileName: file.name
    })
  } catch (error) {
    console.error('Error uploading admin file:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    )
  }
}
