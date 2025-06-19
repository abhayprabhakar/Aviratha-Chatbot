import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from './prisma'

export interface SessionData {
  sessionId: string
  userId?: string
  isAdmin: boolean
  createdAt: Date
}

export interface ConversationData {
  id: string
  title?: string
  createdAt: Date
  messageCount: number
}

// Add these new interfaces right here, after the existing interfaces
export interface MessageMetadata {
  [key: string]: any; // Add index signature to make it compatible with Prisma's JSON type
  type?: string;
  plantData?: {
    isPlant: boolean;
    isHealthy?: boolean;
    plantName: string;
    confidence: number;
    completeAnalysis?: string;
    rawIdentificationResult?: any;
    timestamp?: string;
  };
  timestamp?: string;
  contextUsed?: boolean;
  sourcesCount?: number;
  sourceCategories?: string;
  fromKnowledgeBase?: boolean;
  llmProvider?: string; // Add these fields that were causing errors
  llmModel?: string;
  ragUsed?: boolean;
  contextSources?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: MessageMetadata;
  createdAt: string | Date;
}

export class SessionService {
  private jwtSecret: string

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key'
  }

  async createSession(isAdmin: boolean = false): Promise<{ sessionId: string; token: string }> {
    const sessionId = uuidv4()
    
    // Create session in database
    await prisma.session.create({
      data: {
        sessionId,
        isAdmin
      }
    })

    // Generate JWT token
    const token = jwt.sign(
      { sessionId, isAdmin },
      this.jwtSecret,
      { expiresIn: '7d' }
    )

    return { sessionId, token }
  }

  async findOrCreateUserSession(userId: string, isAdmin: boolean = false): Promise<{ sessionId: string; token: string }> {
    // First, try to find an existing session for this user
    const existingSession = await prisma.session.findFirst({
      where: { userId }
    })

    if (existingSession) {
      // Generate a new JWT token for the existing session
      const token = jwt.sign(
        { sessionId: existingSession.sessionId, isAdmin: existingSession.isAdmin },
        this.jwtSecret,
        { expiresIn: '7d' }
      )
      
      return { sessionId: existingSession.sessionId, token }
    }

    // If no existing session, create a new one
    const sessionId = uuidv4()
    
    await prisma.session.create({
      data: {
        sessionId,
        userId,
        isAdmin
      }
    })

    // Generate JWT token
    const token = jwt.sign(
      { sessionId, isAdmin },
      this.jwtSecret,
      { expiresIn: '7d' }
    )

    return { sessionId, token }
  }

  async validateSession(token: string): Promise<SessionData | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any
      
      // Check if session exists in database
      const session = await prisma.session.findUnique({
        where: { sessionId: decoded.sessionId }
      })

      if (!session) {
        return null
      }

      return {
        sessionId: session.sessionId,
        userId: session.userId || undefined,
        isAdmin: session.isAdmin,
        createdAt: session.createdAt
      }
    } catch (error) {
      return null
    }
  }

  async createConversation(sessionId: string, title?: string): Promise<string> {
    const conversation = await prisma.conversation.create({
      data: {
        sessionId,
        title: title || `Conversation ${new Date().toLocaleDateString()}`
      }
    })

    return conversation.id
  }

  async getConversations(sessionId: string): Promise<ConversationData[]> {
    const conversations = await prisma.conversation.findMany({
      where: { sessionId },
      include: {
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    return conversations.map(conv => ({
      id: conv.id,
      title: conv.title || undefined,
      createdAt: conv.createdAt,
      messageCount: conv._count.messages
    }))
  }

  async addMessage(
    conversationId: string, 
    role: 'user' | 'assistant' | 'system', 
    content: string,
    metadata?: MessageMetadata  // Update this type from 'any' to 'MessageMetadata'
  ): Promise<void> {
    await prisma.message.create({
      data: {
        conversationId,
        role,
        content,
        metadata: metadata as any // Cast to 'any' for Prisma compatibility
      }
    })

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() }
    })
  }

  // And update the return type of this method:
  async getConversationMessages(conversationId: string, sessionId: string): Promise<Message[]> {
    // Verify the conversation belongs to the session
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        sessionId
      }
    })

    if (!conversation) {
      throw new Error('Conversation not found or access denied')
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    })

    return messages.map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
      metadata: msg.metadata as MessageMetadata | undefined, // Add type assertion here
      createdAt: msg.createdAt
    }))
  }

  async deleteConversation(conversationId: string, sessionId: string): Promise<boolean> {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        sessionId
      }
    })

    if (!conversation) {
      return false
    }

    await prisma.conversation.delete({
      where: { id: conversationId }
    })

    return true
  }

  async updateConversationTitle(conversationId: string, sessionId: string, title: string): Promise<boolean> {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        sessionId
      }
    })

    if (!conversation) {
      return false
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title }
    })

    return true
  }

  async getSessionStats(sessionId: string) {
    const conversationCount = await prisma.conversation.count({
      where: { sessionId }
    })

    const messageCount = await prisma.message.count({
      where: {
        conversation: {
          sessionId
        }
      }
    })

    const documentCount = await prisma.document.count({
      where: { uploadedBy: sessionId }
    })

    return {
      conversations: conversationCount,
      messages: messageCount,
      documents: documentCount
    }
  }

  async cleanupOldSessions(): Promise<void> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Delete sessions older than 30 days (cascades to conversations and messages)
    await prisma.session.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo
        },
        isAdmin: false // Don't delete admin sessions
      }
    })
  }

  async verifySession(request: Request): Promise<SessionData | null> {
    try {
      const authHeader = request.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return null
      }

      const token = authHeader.substring(7)
      return await this.validateSession(token)
    } catch (error) {
      return null
    }
  }
}

// Export a singleton instance for convenience
export const sessionService = new SessionService()

// Export the verifySession function for backward compatibility
export async function verifySession(request: Request): Promise<SessionData | null> {
  return sessionService.verifySession(request)
}
