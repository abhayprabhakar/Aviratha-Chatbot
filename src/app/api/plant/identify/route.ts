import { NextRequest, NextResponse } from 'next/server';
import { PlantIdService } from '@/lib/plant-id';
import { SessionService } from '@/lib/session';
import { LLMService } from '@/lib/llm';
import { imageUploadService } from '@/lib/image-upload';

// Services
const plantIdService = new PlantIdService();
const sessionService = new SessionService();
const llmService = new LLMService();

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: 'No token provided' }, { status: 401 });
    }

    const session = await sessionService.validateSession(token);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const userMessage = formData.get('userMessage') as string || "I've uploaded a plant image for identification and health assessment.";
    const conversationId = formData.get('conversationId') as string;
    
    if (!files.length) {
      return NextResponse.json({ success: false, error: 'No files provided' }, { status: 400 });
    }

    // Process images securely
    const base64Images: string[] = [];
    const uploadedImages: string[] = [];
    
    for (const file of files) {
      try {
        // Upload image securely
        const uploadedImage = await imageUploadService.uploadPlantImage(file, session.sessionId);
        uploadedImages.push(uploadedImage.publicUrl);

        // Convert to base64 for Plant.id API
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64 = buffer.toString('base64');
        base64Images.push(base64);
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
        return NextResponse.json({ 
          success: false, 
          error: uploadError instanceof Error ? uploadError.message : 'Image upload failed'
        }, { status: 400 });
      }
    }

    // Call Plant.id API
    const identificationResult = await plantIdService.identifyPlant(
      base64Images, 
      { includeHealthAssessment: true }
    );

    if (!identificationResult.health_assessment) {
      console.log("No health assessment data returned from Plant.id API, generating manual analysis");
    }
    
    // Format results for LLM
    const formattedResults = plantIdService.formatIdentificationForLLM(identificationResult);
    const followUpQuestions = plantIdService.generateFollowUpQuestions(identificationResult, userMessage);

    // Generate hydroponic insights
    let hydroponicInsights = "";
    let initialResponse = "";
    
    try {
      const hasHealthIssues = identificationResult.health_assessment && 
                            !identificationResult.health_assessment.is_healthy && 
                            identificationResult.health_assessment.diseases?.length > 0;
      
      const hasCustomQuery = userMessage !== "I've uploaded a plant image for identification and health assessment.";
      
      if (hasCustomQuery) {
        initialResponse = plantIdService.generateCustomResponse(identificationResult, userMessage);
      } else {
        initialResponse = formattedResults;
      }
      
      const promptContent = hasHealthIssues ? 
        `I need hydroponic-specific growing advice for this plant with health issues. 
        The user said: "${userMessage}"
        
        Here's the identification data: 
        Plant Name: ${identificationResult.suggestions[0]?.plant_name || 'Unknown'}
        Scientific Name: ${identificationResult.suggestions[0]?.plant_details?.scientific_name || 'Unknown'}
        Health Status: ${identificationResult.health_assessment?.is_healthy ? 'Healthy' : 'Has health issues'}
        Top Health Issues: ${identificationResult.health_assessment?.diseases?.slice(0, 3).map(d => d.name).join(', ') || 'None'}
        
        Please provide comprehensive advice on:
        1. How to address the identified health issues in a hydroponic setup
        2. Whether these issues are more common/severe in hydroponics than soil
        3. Preventative measures specific to hydroponics
        4. Adjustments to nutrient solution, pH, or EC/PPM that might help
        5. Whether this plant is generally suitable for hydroponics
        
        Format the response clearly with markdown headings and be specific to hydroponics.
        If the user's message contains a specific question, prioritize answering that first.` : 
        
        `I need specific hydroponic growing advice for this plant.
        The user said: "${userMessage}"
        
        Here's the identification data:
        Plant Name: ${identificationResult.suggestions[0]?.plant_name || 'Unknown'}
        Scientific Name: ${identificationResult.suggestions[0]?.plant_details?.scientific_name || 'Unknown'}
        Health Status: ${identificationResult.health_assessment?.is_healthy ? 'Healthy' : 'Has health issues'}
        
        Please provide comprehensive advice on:
        1. Whether this plant is suitable for hydroponics
        2. Optimal nutrient solution recommendations (EC/PPM, pH)
        3. Light requirements and growing conditions
        4. Special considerations for hydroponic growth
        5. Common problems to watch for when growing this plant hydroponically and preventative measures
        
        Format the response clearly with markdown headings.
        If the user's message contains a specific question, prioritize answering that first.`;
      
      const insightResponse = await llmService.generateResponse(
        [{ role: 'user', content: promptContent }],
        {
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          temperature: 0.7,
          maxTokens: 2000
        }
      );
      
      hydroponicInsights = insightResponse;
    } catch (error) {
      console.error('Failed to generate hydroponic insights:', error);
      hydroponicInsights = "Could not generate hydroponic-specific insights at this time.";
    }

    // Create or retrieve conversation
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      currentConversationId = await sessionService.createConversation(session.sessionId);
    }

    // Add user message with uploaded images
    await sessionService.addMessage(currentConversationId, 'user', userMessage, {
      type: 'plant_upload',
      uploadedImages: uploadedImages,
      timestamp: new Date().toISOString()
    } as any);

    // Add assistant response
    let assistantMessage = initialResponse;
    if (identificationResult.is_plant) {
      assistantMessage = `${initialResponse}${followUpQuestions}`;
    }

    await sessionService.addMessage(currentConversationId, 'assistant', assistantMessage, {
      type: 'plant_identification',
      plantData: {
        isPlant: identificationResult.is_plant,
        isHealthy: identificationResult.health_assessment?.is_healthy,
        plantName: identificationResult.suggestions[0]?.plant_name || 'Unknown',
        confidence: identificationResult.suggestions[0]?.probability || 0,
        completeAnalysis: hydroponicInsights,
        rawIdentificationResult: JSON.parse(JSON.stringify(identificationResult)),
        uploadedImages: uploadedImages,
        userQuery: userMessage,
        timestamp: new Date().toISOString()
      }
    } as any);

    // Trigger title generation for plant identification conversations - ONLY if no title exists
    try {
      const messages = await sessionService.getConversationMessages(currentConversationId, session.sessionId)
      
      // Check if conversation already has a title
      const conversations = await sessionService.getConversations(session.sessionId);
      const currentConv = conversations.find(conv => conv.id === currentConversationId);
      
      // Only generate title if no title exists yet
      if (!currentConv?.title && messages.length >= 2) {
        const plantName = identificationResult.suggestions[0]?.plant_name || 'Unknown Plant'
        const generatedTitle = `${plantName} Identification`
        console.log(`Generating plant ID title: "${generatedTitle}" for conversation ${currentConversationId}`)
        await sessionService.updateConversationTitle(currentConversationId, session.sessionId, generatedTitle)
      } else if (currentConv?.title) {
        console.log(`Conversation already has title: "${currentConv.title}" - not overwriting`)
      }
    } catch (error) {
      console.warn('Plant ID title generation failed:', error)
    }

    return NextResponse.json({
      success: true,
      identificationResult,
      formattedResults,
      hydroponicInsights,
      conversationId: currentConversationId,
      uploadedImages: uploadedImages
    });
    
  } catch (error) {
    console.error('Plant identification error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Plant identification failed' 
      }, 
      { status: 500 }
    );
  }
}