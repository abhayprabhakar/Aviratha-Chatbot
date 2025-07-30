import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join, basename } from 'path';
import { PlantIdService } from '@/lib/plant-id';
import { SessionService } from '@/lib/session';
import { LLMService } from '@/lib/llm';
import crypto from 'crypto';

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

    // Create uploads directory
    const uploadDir = join(process.cwd(), 'uploads', 'plants', session.sessionId);
    await mkdir(uploadDir, { recursive: true });

    // Process images
    const base64Images: string[] = [];
    const filePaths: string[] = [];
    const savedImagePaths: string[] = []; // Add this array to track saved images
    
    for (const file of files) {
      // Validate mime type
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ 
          success: false, 
          error: `Invalid file type: ${file.type}. Please upload images only.` 
        }, { status: 400 });
      }

      // Create a unique filename to prevent conflicts
      const fileExt = file.name.split('.').pop();
      const uniqueFilename = `${crypto.randomUUID()}.${fileExt}`;
      
      // Save image to public directory so we can display it
      const publicImageDir = join(process.cwd(), 'public', 'uploaded-plants');
      await mkdir(publicImageDir, { recursive: true });
      const publicImagePath = join(publicImageDir, uniqueFilename);
      
      // Save image
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filePath = join(uploadDir, file.name);
      await writeFile(filePath, buffer);
      filePaths.push(filePath);

      // Also save to public directory
      await writeFile(publicImagePath, buffer);

      // Store the relative path for displaying in the UI
      savedImagePaths.push(`/uploaded-plants/${uniqueFilename}`);
      
      // Convert to base64
      const base64 = buffer.toString('base64');
      base64Images.push(base64);
    }

    // Call Plant.id API
    const identificationResult = await plantIdService.identifyPlant(
      base64Images, 
      { includeHealthAssessment: true }
    );

    if (!identificationResult.health_assessment) {
    console.log("No health assessment data returned from Plant.id API, generating manual analysis");
    }
    
    // Format results for LLM - get concise version
    const formattedResults = plantIdService.formatIdentificationForLLM(identificationResult);

    // Generate follow-up questions
    const followUpQuestions = plantIdService.generateFollowUpQuestions(identificationResult, userMessage);

    // Clean up temporary files
    for (const filePath of filePaths) {
    await rm(filePath, { force: true }).catch(console.error);
    }

    // Generate hydroponic-specific insights using LLM but store it for later use
    let hydroponicInsights = "";
    let initialResponse = "";  // Create a new variable for the initial response
    try {
      // Check if there are health issues to address
      const hasHealthIssues = identificationResult.health_assessment && 
                            !identificationResult.health_assessment.is_healthy && 
                            identificationResult.health_assessment.diseases?.length > 0;
      
      // First, check if the user has a custom query about the plant
      const hasCustomQuery = userMessage !== "I've uploaded a plant image for identification and health assessment.";
      
      if (hasCustomQuery) {
        // Generate a direct response to the user's specific question using plant.id data
        initialResponse = plantIdService.generateCustomResponse(identificationResult, userMessage);
      } else {
        // Use the default formatted response for standard uploads
        initialResponse = formattedResults;
      }
      
      // Always generate the complete hydroponic advice for follow-up questions
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
        [
          {
            role: 'user',
            content: promptContent
          }
        ],
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

    // Now, continue with the rest of the code...

    // Create or retrieve conversation
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      currentConversationId = await sessionService.createConversation(session.sessionId);
    }

    // Add user message about plant
    await sessionService.addMessage(currentConversationId, 'user', userMessage, {
      type: 'plant_upload',
      uploadedImages: savedImagePaths,
      timestamp: new Date().toISOString()
    } as any);


    // Only add follow-up questions if it's a plant with sufficient confidence
    let assistantMessage = initialResponse;
    if (identificationResult.is_plant) {
      assistantMessage = `${initialResponse}${followUpQuestions}`;
    }


    // Add assistant response with plant information
    await sessionService.addMessage(currentConversationId, 'assistant', assistantMessage, {
      type: 'plant_identification',
      plantData: {
        isPlant: identificationResult.is_plant,
        isHealthy: identificationResult.health_assessment?.is_healthy,
        plantName: identificationResult.suggestions[0]?.plant_name || 'Unknown',
        confidence: identificationResult.suggestions[0]?.probability || 0,
        completeAnalysis: hydroponicInsights,
        rawIdentificationResult: JSON.parse(JSON.stringify(identificationResult)),
        uploadedImages: savedImagePaths,
        userQuery: userMessage,
        timestamp: new Date().toISOString()
      }
    } as any);
    // Return results
    return NextResponse.json({
      success: true,
      identificationResult,
      formattedResults,
      hydroponicInsights,
      conversationId: currentConversationId,
      uploadedImages: savedImagePaths // Return image paths in response
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