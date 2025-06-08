import * as fs from 'fs'
import * as path from 'path'
import mammoth from 'mammoth'
import { prisma } from './prisma'
import { createVectorService, MultiVectorService } from './vector-multi'

export interface ProcessedDocument {
  id: string
  title: string
  content: string
  fileName: string
  fileType: string
  fileSize: number
}

export class FileProcessingService {
  private vectorService: MultiVectorService

  constructor() {
    this.vectorService = createVectorService()
  }

  async processFile(
    filePath: string,
    fileName: string,
    uploadedBy?: string,
    isPublic: boolean = false
  ): Promise<ProcessedDocument> {
    console.log('Processing file:', { filePath, fileName, uploadedBy, isPublic })
    
    const fileStats = fs.statSync(filePath)
    const fileType = path.extname(fileName).toLowerCase().substring(1)
    
    // Validate file type
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,txt,docx,doc,md').split(',')
    if (!allowedTypes.includes(fileType)) {
      throw new Error(`File type ${fileType} is not supported`)
    }

    // Validate file size
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
    if (fileStats.size > maxSize) {
      throw new Error(`File size exceeds maximum limit of ${maxSize} bytes`)
    }

    let content: string
    
    try {
      switch (fileType) {
        case 'pdf':
          content = await this.processPDF(filePath)
          break
        case 'docx':
        case 'doc':
          content = await this.processDocx(filePath)
          break
        case 'txt':
        case 'md':
          content = await this.processText(filePath)
          break
        default:
          throw new Error(`Unsupported file type: ${fileType}`)
      }
    } catch (error) {
      throw new Error(`Failed to process file: ${error}`)
    }

    // Clean and validate content
    content = this.cleanContent(content)
    if (content.length < 100) {
      throw new Error('Document content is too short to be useful')
    }

    // Save document to database
    const document = await prisma.document.create({
      data: {
        title: this.generateTitle(fileName, content),
        content,
        fileName,
        fileType,
        fileSize: fileStats.size,
        uploadedBy,
        isPublic,
        metadata: {
          processedAt: new Date().toISOString(),
          originalPath: filePath
        }
      }
    })

    // Generate embeddings for the document
    await this.generateEmbeddings(document.id, content)

    // Clean up temporary file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    return {
      id: document.id,
      title: document.title,
      content: document.content,
      fileName: document.fileName,
      fileType: document.fileType,
      fileSize: document.fileSize
    }
  }

  private async processPDF(filePath: string): Promise<string> {
    console.log('Processing PDF at path:', filePath)
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`PDF file not found: ${filePath}`)
    }
    
    try {
      const dataBuffer = fs.readFileSync(filePath)
      const pdfParse = await import('pdf-parse')
      
      const data = await pdfParse.default(dataBuffer)
      
      if (!data.text || data.text.trim().length === 0) {
        throw new Error('No text content extracted from PDF')
      }
      
      return data.text.trim()
      
    } catch (error: any) {
      console.error('PDF processing error:', error.message)
      throw new Error(`Failed to parse PDF: ${error.message}`)
    }
  }

  private async processDocx(filePath: string): Promise<string> {
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value
  }

  private async processText(filePath: string): Promise<string> {
    return fs.readFileSync(filePath, 'utf-8')
  }

  private cleanContent(content: string): string {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .replace(/[^\x20-\x7E\n]/g, '')
      .trim()
  }

  private generateTitle(fileName: string, content: string): string {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    for (const line of lines) {
      if (line.length > 10 && line.length < 100 && !line.includes('.') && line.split(' ').length > 1) {
        return line
      }
    }

    return path.basename(fileName, path.extname(fileName))
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
  }  private async generateEmbeddings(documentId: string, content: string): Promise<void> {
    const chunks = this.vectorService.splitTextIntoChunks(content)
    await this.vectorService.createDocumentEmbeddings(documentId, chunks)
  }

  async deleteDocument(documentId: string, sessionId?: string): Promise<boolean> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        OR: [
          { uploadedBy: sessionId },
          { isPublic: true, uploadedBy: 'admin' }
        ]
      }
    })

    if (!document) {
      return false
    }

    await prisma.document.delete({
      where: { id: documentId }
    })

    return true
  }

  async getUserDocuments(sessionId: string): Promise<ProcessedDocument[]> {
    const documents = await prisma.document.findMany({
      where: {
        OR: [
          { uploadedBy: sessionId },
          { isPublic: true }
        ]
      },
      select: {
        id: true,
        title: true,
        content: true,
        fileName: true,
        fileType: true,
        fileSize: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return documents
  }

  async getDocumentStats(): Promise<{ totalDocuments: number; totalSize: number; publicDocuments: number }> {
    const stats = await prisma.document.aggregate({
      _count: { id: true },
      _sum: { fileSize: true }
    })

    const publicStats = await prisma.document.count({
      where: { isPublic: true }
    })

    return {
      totalDocuments: stats._count.id || 0,
      totalSize: stats._sum.fileSize || 0,
      publicDocuments: publicStats
    }
  }

  async testPDFProcessing(filePath: string): Promise<string> {
    return await this.processPDF(filePath)  }
}
