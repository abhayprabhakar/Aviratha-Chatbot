import axios from 'axios';

export interface PlantIdentificationResult {
  suggestions: {
    id: string;
    plant_name: string;
    plant_details: {
      common_names?: string[];
      scientific_name: string;
      wiki_description?: {
        value: string;
      };
    };
    probability: number;
  }[];
  is_plant: boolean;
  is_healthy: boolean;
  health_assessment?: {
    is_healthy: boolean;
    diseases: {
      name: string;
      probability: number;
      description: string;
      treatment?: {
        prevention?: string;
        chemical?: string;
        biological?: string;
      };
      similar_images?: string[];
    }[];
  };
  modifiers: string[];
}

export class PlantIdService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.plant.id/v2';

  constructor() {
    const apiKey = process.env.PLANTID_API_KEY;
    if (!apiKey) {
      throw new Error('PLANTID_API_KEY environment variable is not set');
    }
    this.apiKey = apiKey;
  }

  /**
   * Identifies plants from base64-encoded images
   */
    async identifyPlant(
    base64Images: string[],
    options: {
        includeHealthAssessment?: boolean;
        includeSimilarImages?: boolean;
        language?: string;
    } = {}
    ): Promise<PlantIdentificationResult> {
    try {
        // Make two separate API calls - one for identification, one for health
        // First, identify the plant
        const identificationResponse = await axios.post(
        `${this.baseUrl}/identify`,
        {
            images: base64Images,
            modifiers: ["crops_fast"],
            plant_language: options.language || 'en',
            plant_details: [
            "common_names",
            "url",
            "wiki_description",
            "taxonomy",
            "synonyms"
            ]
        },
        {
            headers: {
            'Content-Type': 'application/json',
            'Api-Key': this.apiKey,
            },
        }
        );
        
        // Second, do a health assessment
        const healthResponse = await axios.post(
        `${this.baseUrl}/health_assessment`,
        {
            images: base64Images,
            modifiers: ["crops_fast"],
            language: options.language || 'en',
            disease_details: ["description", "treatment", "classification"],
        },
        {
            headers: {
            'Content-Type': 'application/json',
            'Api-Key': this.apiKey,
            },
        }
        );
        
        console.log("Plant.id API health response:", JSON.stringify(healthResponse.data, null, 2).substring(0, 500) + "...");
        
        // Combine the results
        const combinedResult = {
        ...identificationResponse.data,
        health_assessment: healthResponse.data.health_assessment,
        is_healthy: healthResponse.data.health_assessment?.is_healthy ?? true
        };
        
        return combinedResult;
    } catch (error) {
        console.error('Plant identification error:', error);
        throw new Error(error instanceof Error ? error.message : 'Plant identification failed');
    }
}

// Delete your existing formatIdentificationForLLM method completely and replace with this:

/**
 * Formats plant identification results for the chatbot - concise version
 */
formatIdentificationForLLM(result: PlantIdentificationResult, detailed: boolean = false): string {
  let formattedResult = '';
  
  // Check if it's a plant
  if (!result.is_plant) {
    return "The image does not appear to contain a plant. Please upload a clearer image of a plant for identification.";
  }
  
  // Start with health assessment first - prioritize this information
  formattedResult += `## Plant Health Assessment\n\n`;
  
  if (result.health_assessment) {
    formattedResult += `**Health Status**: ${result.health_assessment.is_healthy ? '✅ Healthy' : '❌ Potential Issues Detected'}\n\n`;
    
    // If plant has health issues, detail them prominently - but limit to top 3 issues
    if (!result.health_assessment.is_healthy && result.health_assessment.diseases?.length) {
      formattedResult += `### Detected Health Issues\n\n`;
      
      // Sort diseases by probability (highest first) and take top 3
      const topIssues = [...result.health_assessment.diseases]
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3);
        
      topIssues.forEach((disease, index) => {
        formattedResult += `**Issue ${index + 1}**: ${disease.name} (${(disease.probability * 100).toFixed(1)}% confidence)\n`;
      });
      
      formattedResult += `\n`;
    } else if (result.health_assessment.is_healthy) {
      formattedResult += `No health issues detected. The plant appears to be in good condition.\n\n`;
    }
  } else {
    formattedResult += `Health assessment information could not be determined. For better health analysis, try uploading a clearer image showing any problematic areas.\n\n`;
  }
  
  // Add plant identification information (basic version)
  formattedResult += `## Plant Identification Results\n\n`;
  
  // Get the top suggestion
  const topSuggestion = result.suggestions[0];
  if (!topSuggestion) {
    return "I couldn't identify the plant in this image with confidence. Please upload a clearer image.";
  }
  
  // Basic plant information
  formattedResult += `**Plant Name**: ${topSuggestion.plant_name}\n`;
  
  if (topSuggestion.plant_details?.common_names?.length) {
    formattedResult += `**Common Names**: ${topSuggestion.plant_details.common_names.join(', ')}\n`;
  }
  
  formattedResult += `**Scientific Name**: ${topSuggestion.plant_details.scientific_name}\n`;
  formattedResult += `**Confidence**: ${(topSuggestion.probability * 100).toFixed(1)}%\n\n`;
  
  // Brief description (first 1-3 sentences only)
  if (topSuggestion.plant_details?.wiki_description?.value) {
    const description = topSuggestion.plant_details.wiki_description.value;
    const sentences = description.split(/(?<=[.!?])\s+/);
    const briefDescription = sentences.slice(0, Math.min(2, sentences.length)).join(' ');
    
    formattedResult += `**Description**: ${briefDescription}\n\n`;
  }
  
  // Return the concise information
  return formattedResult;
}

/**
 * Generates follow-up questions based on plant identification and health assessment
 */
public generateFollowUpQuestions(identificationResult: any, userMessage: string): string {
  // First check if it's a plant
  if (!identificationResult.is_plant) {
    return ""; // Return empty string for non-plants
  }
  
  const questions: string[] = [];
  const plantName = identificationResult.suggestions[0]?.plant_name || 'this plant';
  
  // Lowercase user message for easier comparison
  const lowerUserMessage = userMessage?.toLowerCase() || '';
  
  // Helper function to check if a question is similar to what the user already asked
  const isQuestionAsked = (question: string): boolean => {
    const lowerQuestion = question.toLowerCase();
    // Check key phrases to determine if the user already asked something similar
    const keyPhrases = [
      'suitable for hydroponics',
      'health issue',
      'prevent',
      'nutrient solution',
      'ph',
      'ec',
      'ppm',
      'common problem'
    ];
    
    return keyPhrases.some(phrase => 
      lowerQuestion.includes(phrase) && lowerUserMessage.includes(phrase)
    );
  };
  
  // Always ask about suitability for hydroponics (unless already asked)
  const suitabilityQuestion = `Is ${plantName} suitable for hydroponics?`;
  if (!isQuestionAsked(suitabilityQuestion)) {
    questions.push(suitabilityQuestion);
  }
  
  // Add health-related questions if issues detected (unless already asked)
  if (identificationResult.health_assessment && !identificationResult.health_assessment.is_healthy) {
    const healthQuestion = `What should I do about the health issues detected in my ${plantName}?`;
    if (!isQuestionAsked(healthQuestion)) {
      questions.push(healthQuestion);
    }
    
    const severityQuestion = `How severe are these issues in hydroponics compared to soil?`;
    if (!isQuestionAsked(severityQuestion)) {
      questions.push(severityQuestion);
    }
    
    const preventionQuestion = `How can I prevent these issues in my hydroponic system?`;
    if (!isQuestionAsked(preventionQuestion)) {
      questions.push(preventionQuestion);
    }
  }
  
  // Add general hydroponic care questions (unless already asked)
  const nutrientQuestion = `What are the optimal nutrient solution, pH, and EC/PPM levels for ${plantName}?`;
  if (!isQuestionAsked(nutrientQuestion)) {
    questions.push(nutrientQuestion);
  }
  
  const problemsQuestion = `What are common problems when growing ${plantName} hydroponically?`;
  if (!isQuestionAsked(problemsQuestion)) {
    questions.push(problemsQuestion);
  }
  
  // If we filtered out all questions or the user asked a comprehensive question,
  // add some different questions
  if (questions.length < 2) {
    const additionalQuestions = [
      `What's the ideal light cycle for ${plantName} in hydroponics?`,
      `How long does it take to grow ${plantName} to maturity in hydroponics?`,
      `What hydroponic system type works best for ${plantName}?`,
      `Is ${plantName} easy to grow for hydroponic beginners?`
    ];
    
    for (const question of additionalQuestions) {
      if (!isQuestionAsked(question)) {
        questions.push(question);
        if (questions.length >= 3) break; // Add up to 3 additional questions
      }
    }
  }
  
  // Format questions as a list
  if (questions.length === 0) {
    return "";
  }
  
  let questionText = `\n### Would you like to know more about:\n\n`;
  questions.forEach((q, i) => {
    questionText += `${i+1}. ${q}\n`;
  });
  
  questionText += `\nJust ask any of these questions or type your own question about this plant!`;
  
  return questionText;
}
/**
 * Generates a response to a custom user query about a plant image
 */
generateCustomResponse(result: PlantIdentificationResult, userQuery: string): string {
  // First, extract key information from the Plant.id API result
  const plantName = result.suggestions[0]?.plant_name || 'Unknown plant';
  const commonNames = result.suggestions[0]?.plant_details?.common_names?.join(', ') || '';
  const confidence = result.suggestions[0]?.probability || 0;
  const isHealthy = result.health_assessment?.is_healthy || false;
  
  // Extract health issues, sorted by probability
  const healthIssues = result.health_assessment?.diseases
    ? [...result.health_assessment.diseases]
        .sort((a, b) => b.probability - a.probability)
    : [];
  
  // Format the custom response based on the user's query
  let response = '';
  
  // Check what the user is asking about
  const query = userQuery.toLowerCase();
  
  // If asking specifically about health issues
  if (query.includes('health') || query.includes('issue') || query.includes('problem') || 
      query.includes('disease') || query.includes('what') && query.includes('wrong')) {
    
    response += `## Plant Health Analysis\n\n`;
    
    if (isHealthy) {
      response += `Your ${plantName} appears to be healthy. I don't detect any significant issues in the image.\n\n`;
    } else {
      response += `I've analyzed your ${plantName} and detected the following potential issues:\n\n`;
      
      // List all health issues with their probabilities
      healthIssues.forEach((issue, index) => {
        response += `**${index + 1}.** ${issue.name} (${(issue.probability * 100).toFixed(1)}% confidence)\n`;
        
        // Add description if available and probability is significant
        if (issue.description && issue.probability > 0.15) {
          response += `   - ${issue.description}\n`;
        }
      });
      
      // Add treatment info for the most probable issue
      if (healthIssues.length > 0 && healthIssues[0].treatment) {
        response += `\n### Recommended Treatment for ${healthIssues[0].name}:\n\n`;
        
        if (healthIssues[0].treatment.prevention) {
          response += `**Prevention:** ${healthIssues[0].treatment.prevention}\n\n`;
        }
        
        if (healthIssues[0].treatment.biological) {
          response += `**Biological Treatment:** ${healthIssues[0].treatment.biological}\n\n`;
        }
        
        if (healthIssues[0].treatment.chemical) {
          response += `**Chemical Treatment:** ${healthIssues[0].treatment.chemical}\n\n`;
        }
      }
    }
  }
  // If asking about identification
  else if (query.includes('identify') || query.includes('what') || query.includes('plant is this')) {
    response += `## Plant Identification\n\n`;
    response += `This plant appears to be **${plantName}** (${(confidence * 100).toFixed(1)}% confidence).\n\n`;
    
    if (commonNames) {
      response += `**Common names:** ${commonNames}\n\n`;
    }
    
    // Add a brief description if available
    if (result.suggestions[0]?.plant_details?.wiki_description?.value) {
      const description = result.suggestions[0].plant_details.wiki_description.value;
      const sentences = description.split(/(?<=[.!?])\s+/);
      const briefDescription = sentences.slice(0, Math.min(2, sentences.length)).join(' ');
      response += `**Description:** ${briefDescription}\n\n`;
    }
  }
  // Generic response for any other query
  else {
    // Start with identification
    response += `## Plant Analysis\n\n`;
    response += `I've analyzed your image and identified this as **${plantName}** (${(confidence * 100).toFixed(1)}% confidence).\n\n`;
    
    // Then add health status
    response += `### Health Status: ${isHealthy ? '✅ Healthy' : '❌ Potential Issues Detected'}\n\n`;
    
    if (!isHealthy && healthIssues.length > 0) {
      response += `I've detected some potential issues:\n\n`;
      
      // List top 3 health issues
      healthIssues.slice(0, 3).forEach((issue, index) => {
        response += `**Issue ${index + 1}:** ${issue.name} (${(issue.probability * 100).toFixed(1)}% confidence)\n`;
      });
    }
  }
  
  return response;
}
}
