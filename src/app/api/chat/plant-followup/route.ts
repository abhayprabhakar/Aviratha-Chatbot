import { NextRequest, NextResponse } from 'next/server';
import { SessionService, MessageMetadata, Message } from '@/lib/session';
import { LLMService } from '@/lib/llm';

const sessionService = new SessionService();
const llmService = new LLMService();

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const session = await sessionService.validateSession(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      message, 
      conversationId 
    } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    // Get the most recent plant identification data from the conversation
    const messages = await sessionService.getConversationMessages(conversationId, session.sessionId);
    
    // Find the most recent plant identification message using proper typing
    const plantIdentificationMessage = messages
      .reverse()
      .find(msg => {
        // Type check to ensure metadata exists and has the right structure
        return msg.metadata && typeof msg.metadata === 'object' && 'type' in msg.metadata && msg.metadata.type === 'plant_identification';
      }) as Message | undefined;

    // Check if we found a valid plant identification message with the required data
    if (!plantIdentificationMessage || 
        !plantIdentificationMessage.metadata || 
        !plantIdentificationMessage.metadata.plantData) {
      return NextResponse.json({ error: 'No plant identification data found in this conversation' }, { status: 404 });
    }

    // Get plant data and complete analysis with proper type assertion
    const {
      plantName = "Unknown plant",
      completeAnalysis = "",
      rawIdentificationResult,
      isHealthy = false
    } = plantIdentificationMessage.metadata.plantData;

    // Get userQuery separately with a default value
    const userQuery = 
      (plantIdentificationMessage.metadata.plantData as any).userQuery || 
      "I've uploaded a plant image for identification and health assessment.";

    // Add user message to conversation
    await sessionService.addMessage(conversationId, 'user', message);

    // Based on the user's question, generate a targeted response
    // Categories of possible questions
    const isAboutHealth = message.toLowerCase().includes('health') || 
                         message.toLowerCase().includes('issue') ||
                         message.toLowerCase().includes('disease');
                         
    const isAboutNutrients = message.toLowerCase().includes('nutrient') || 
                            message.toLowerCase().includes('ph') || 
                            message.toLowerCase().includes('solution') ||
                            message.toLowerCase().includes('ppm') || 
                            message.toLowerCase().includes('ec');
                            
    const isAboutSuitability = message.toLowerCase().includes('suitable') || 
                              message.toLowerCase().includes('good for') || 
                              message.toLowerCase().includes('grow in');
                              
    const isAboutPrevention = message.toLowerCase().includes('prevent') || 
                             message.toLowerCase().includes('avoid');

    // Create a better prompt that considers the original user query
    let prompt = `You are a hydroponics expert assistant. A user has uploaded an image of ${plantName}.

    Initial query: "${userQuery}"
    Follow-up question: "${message}"

    Here's what we know about the plant:
    - Plant name: ${plantName}
    - Health status: ${isHealthy ? 'Healthy' : 'Has health issues'}

    Complete analysis from earlier:
    ${completeAnalysis}

    Please provide a customized answer addressing specifically what the user is asking about now. Use markdown formatting and keep your answer under 250 words unless more detail is necessary.

    Important instructions:
    1. Address the user's follow-up question directly
    2. Reference any relevant parts of their initial query for context
    3. Don't repeat basic identification information they already know
    4. Focus on practical advice specific to hydroponics`;
    // Add specific instructions based on question type
    if (isAboutHealth) {
      prompt += `\n\nFocus on the health issues, their causes, and specific treatments in a hydroponic environment.`;
    } else if (isAboutNutrients) {
      prompt += `\n\nFocus on specific nutrient requirements, pH levels, and EC/PPM recommendations for ${plantName} in hydroponics.`;
    } else if (isAboutSuitability) {
      prompt += `\n\nDiscuss how well ${plantName} grows in hydroponic systems, ideal system types, and any special considerations.`;
    } else if (isAboutPrevention) {
      prompt += `\n\nFocus on preventative measures specific to hydroponics to maintain healthy ${plantName} plants and avoid common issues.`;
    }

    // Generate response
    const response = await llmService.generateResponse(
      [{ role: 'user', content: prompt }],
      {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        temperature: 0.7,
        maxTokens: 1000
      }
    );

    // Add assistant response to conversation with properly typed metadata
    await sessionService.addMessage(conversationId, 'assistant', response, {
      type: 'plant_followup',
      timestamp: new Date().toISOString()
    } as any);
    // Trigger title generation for plant conversations - ONLY if no title exists
    try {
      const messages = await sessionService.getConversationMessages(conversationId, session.sessionId)
      
      // Check if conversation already has a title  
      const conversations = await sessionService.getConversations(session.sessionId);
      const currentConv = conversations.find(conv => conv.id === conversationId);
      
      // Only generate title if no title exists yet AND we have the right message count
      if (!currentConv?.title && (messages.length === 3 || messages.length === 4)) {
        console.log(`Triggering plant follow-up title generation for conversation ${conversationId}`)
        fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/chat/generate-title`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ conversationId })
        }).catch(error => {
          console.warn('Title generation failed:', error)
        })
      } else if (currentConv?.title) {
        console.log(`Plant follow-up: Conversation already has title: "${currentConv.title}" - not generating new one`)
      }
    } catch (error) {
      console.warn('Title generation trigger failed:', error)
    }

    return NextResponse.json({
      success: true,
      response,
      conversationId
    });
  } catch (error) {
    console.error('Plant followup API error:', error);
    return NextResponse.json(
      { error: 'Failed to process plant follow-up question' },
      { status: 500 }
    );
  }
}