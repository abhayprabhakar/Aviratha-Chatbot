import { NextRequest, NextResponse } from 'next/server'
import { SessionService } from '@/lib/session'
import { LLMService, LLMConfig } from '@/lib/llm'
import { createVectorService } from '@/lib/vector-multi'
import { chatRateLimit, rateLimitMiddleware } from '@/lib/rate-limit'

const sessionService = new SessionService()
const llmService = new LLMService()
const vectorService = createVectorService()

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, chatRateLimit)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      )
    }

    const session = await sessionService.validateSession(token)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      message, 
      conversationId, 
      llmConfig,
      useRAG = true
    } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    // Check if message is off-topic using LLM classification with keyword fallback
    const isOnTopic = await classifyMessageTopic(message);
    if (!isOnTopic) {
      // Create conversation if not provided
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        currentConversationId = await sessionService.createConversation(session.sessionId);
      }
      
      // Add user message to conversation
      await sessionService.addMessage(currentConversationId, 'user', message);
      
      // Determine rejection response based on content type
      let rejectionResponse = `I'm specialized in hydroponics and plant cultivation. `;
      
      // Detect specific types of off-topic content
      const message_lower = message.toLowerCase();
      
      // Fiction check
      const isFictionalQuery = /\b(superman|batman|spider[ -]?man|iron[ -]?man|thor|hulk|captain america|wonder woman|flash|aquaman|cyborg|green lantern|martian|justice league|avengers|x-men|fictional|fantasy|imaginary|superhero|super hero|super power|mythical|legendary|magical|wizard|witch|dragon|fairy|elf|dwarf|hobbit|jedi|sith|darth vader|luke skywalker|harry potter|gandalf|frodo|voldemort|dumbledore|naruto|goku|pokemon|mario|zelda|link)\b/i.test(message);
      
      // Medical check
      const isMedicalQuery = /\b(cure|treat|heal|therapy|medicine|medical|disease|illness|remedy|symptoms)\b/i.test(message_lower);
      
      // Dual-purpose check
      const isDualPurposeQuery = /\b(and also|as well as|while you're at it|besides that|additionally|on another note)\b/i.test(message_lower);
      
      // Controlled substance check
      const isControlledSubstanceQuery = /\b(thc|cannabis|marijuana|weed|pot|cocaine|heroin|psychedelic|mushroom|psilocybin|lsd|meth)\b/i.test(message_lower);
      
      // Plant personification check
      const isPersonificationQuery = /\b(plants|crops).+\b(feel|think|talk|say|opinion|emotions|sentient|consciousness)\b/i.test(message_lower);
      
      // Personal advice check
      const isPersonalAdviceQuery = /\b(should i|advice for me|my life|my career|my relationship|my spouse|my partner|my family|my parents|my children|my kids|my marriage|my divorce)\b/i.test(message_lower);
      
      // Add specific context for different types of off-topic content
      if (isFictionalQuery) {
        rejectionResponse += `I don't discuss fictional characters or hypothetical scenarios, even when related to plants or hydroponics. I focus only on real-world plant cultivation. `;
      } else if (isMedicalQuery) {
        rejectionResponse += `I don't provide medical advice or discuss health claims related to plants. I focus on plant cultivation techniques only. `;
      } else if (isControlledSubstanceQuery) {
        rejectionResponse += `I don't provide information about growing controlled substances. I focus on legal plant cultivation only. `;
      } else if (isDualPurposeQuery) {
        rejectionResponse += `I can only answer questions specifically about hydroponics and plant cultivation, not other topics that might be included in your question. `;
      } else if (isPersonificationQuery) {
        rejectionResponse += `I provide factual information about plants rather than discussing hypothetical feelings or thoughts plants might have. `;
      } else if (isPersonalAdviceQuery) {
        rejectionResponse += `I provide information about plant cultivation but can't offer personal advice about life decisions. `;
      }
      
      rejectionResponse += `I'm not able to provide information about topics outside of practical plant growing and agriculture. I'd be happy to help with questions about growing real plants in water-based systems, nutrient solutions, plant health, or related agricultural topics instead.`;
      
      // Add AI response to conversation
      await sessionService.addMessage(
        currentConversationId, 
        'assistant', 
        rejectionResponse,
        {
          type: 'ai_response',
          llmProvider: 'system',
          llmModel: 'filter',
          ragUsed: false,
          contextSources: 0,
          fromKnowledgeBase: false,
          sourceCategories: '',
          timestamp: new Date().toISOString()
        } as any
      );
      
      return NextResponse.json({
        success: true,
        response: rejectionResponse,
        conversationId: currentConversationId,
        contextUsed: false,
        sourcesCount: 0,
        fromKnowledgeBase: false,
        sourceCategories: ''
      });
    }

    // Create conversation if not provided
    let currentConversationId = conversationId
    if (!currentConversationId) {
      currentConversationId = await sessionService.createConversation(session.sessionId)
    }

    // Add user message to conversation
    await sessionService.addMessage(currentConversationId, 'user', message)

    // Get conversation history
    const messages = await sessionService.getConversationMessages(currentConversationId, session.sessionId)
    const chatMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))

    let context: string[] = []
    let fromKnowledgeBase = false
    let sourceCategories: string[] = []

    // Perform RAG search if enabled
    if (useRAG) {
      try {
        // Retrieve chunks, prioritizing the knowledge base documents
        const similarChunks = await vectorService.searchSimilarChunks(
          message, 
          8, // Increased from 5 to 8
          'knowledge-base-admin' // Always search as the knowledge base admin
        )
        
        if (similarChunks.length > 0) {
          // Extract source categories from document titles
          sourceCategories = similarChunks
            .map(chunk => {
              const title = chunk.metadata?.documentTitle || '';
              // Extract category from "Category - Document Name" pattern
              const categoryMatch = title.match(/^([^-]+) -/);
              return categoryMatch ? categoryMatch[1].trim() : '';
            })
            .filter(Boolean);

          // Create a Set to remove duplicates
          sourceCategories = [...new Set(sourceCategories)];
          
          // Check if any chunks have high similarity (from knowledge base)
          fromKnowledgeBase = similarChunks.some(chunk => chunk.similarity > 0.5);
          
          context = similarChunks.map(chunk => 
            `Source: ${chunk.metadata?.documentTitle || 'Unknown'}\n${chunk.content}`
          );
        }
      } catch (error) {
        console.warn('RAG search failed:', error)
        // Continue without RAG context
      }
    }

    // Generate system prompt
    const systemPrompt = generateSystemPrompt(context, fromKnowledgeBase);

    // Add system message to the beginning of chat messages
    const fullMessages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...chatMessages
    ];

    // Generate AI response
    const aiResponse = await llmService.generateResponse(
      fullMessages,  // Use fullMessages instead of chatMessages
      llmConfig,
      context.length > 0 ? context : undefined
    )

    // Add AI response to conversation
    await sessionService.addMessage(
      currentConversationId, 
      'assistant', 
      aiResponse,
      {
        type: 'ai_response', // Add this type field
        llmProvider: llmConfig.provider,
        llmModel: llmConfig.model,
        ragUsed: context.length > 0,
        contextSources: context.length,
        fromKnowledgeBase: fromKnowledgeBase,
        sourceCategories: sourceCategories.join(', '),
        timestamp: new Date().toISOString()
      } as any // Add this type assertion
    )

    return NextResponse.json({
      success: true,
      response: aiResponse,
      conversationId: currentConversationId,
      contextUsed: context.length > 0,
      sourcesCount: context.length,
      fromKnowledgeBase: fromKnowledgeBase,
      sourceCategories: sourceCategories.join(', ')
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}

// Update the generateSystemPrompt function:
function generateSystemPrompt(context: string[], fromKnowledgeBase: boolean): string {
  if (context.length === 0) {
    return `You are a helpful AI assistant specializing in hydroponics. 
    IMPORTANT: If asked about hydroponics topics, clearly state that you don't have specific information from the hydroponics knowledge base on that particular topic.
    For questions not related to hydroponics, respond helpfully without this disclaimer.`;
  }

  return `You are a specialized hydroponics assistant with access to expert information.
  IMPORTANT: Base your answer ONLY on the following hydroponics knowledge base information:
  
  ${context.join('\n\n')}
  
  Answer questions precisely using this information. If the knowledge base doesn't contain complete information to answer the question:
  1. First provide what information IS available from the knowledge base
  2. Then clearly state: "The knowledge base doesn't contain complete information on this specific point."
  3. Only then provide a general answer based on your training, clearly indicating it's not from the knowledge base.
  
  Always prioritize the knowledge base information when answering.`;
}
import { NextRequest, NextResponse } from 'next/server'
import { SessionService } from '@/lib/session'
import { LLMService, LLMConfig } from '@/lib/llm'
import { createVectorService } from '@/lib/vector-multi'
import { chatRateLimit, rateLimitMiddleware } from '@/lib/rate-limit'

const sessionService = new SessionService()
const llmService = new LLMService()
const vectorService = createVectorService()

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, chatRateLimit)
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      )
    }

    const session = await sessionService.validateSession(token)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Invalid session' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      message, 
      conversationId, 
      llmConfig,
      useRAG = true
    } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    // Create conversation if not provided
    let currentConversationId = conversationId
    if (!currentConversationId) {
      currentConversationId = await sessionService.createConversation(session.sessionId)
    }

    // Add user message to conversation
    await sessionService.addMessage(currentConversationId, 'user', message)

    // Get conversation history
    const messages = await sessionService.getConversationMessages(currentConversationId, session.sessionId)
    const chatMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))

    let context: string[] = []
    let fromKnowledgeBase = false
    let sourceCategories: string[] = []

    // Perform RAG search if enabled
    if (useRAG) {
      try {
        // Retrieve chunks, prioritizing the knowledge base documents
        const similarChunks = await vectorService.searchSimilarChunks(
          message, 
          8, // Increased from 5 to 8
          'knowledge-base-admin' // Always search as the knowledge base admin
        )
        
        if (similarChunks.length > 0) {
          // Extract source categories from document titles
          sourceCategories = similarChunks
            .map(chunk => {
              const title = chunk.metadata?.documentTitle || '';
              // Extract category from "Category - Document Name" pattern
              const categoryMatch = title.match(/^([^-]+) -/);
              return categoryMatch ? categoryMatch[1].trim() : '';
            })
            .filter(Boolean);

          // Create a Set to remove duplicates
          sourceCategories = [...new Set(sourceCategories)];
          
          // Check if any chunks have high similarity (from knowledge base)
          fromKnowledgeBase = similarChunks.some(chunk => chunk.similarity > 0.5);
          
          context = similarChunks.map(chunk => 
            `Source: ${chunk.metadata?.documentTitle || 'Unknown'}\n${chunk.content}`
          );
        }
      } catch (error) {
        console.warn('RAG search failed:', error)
        // Continue without RAG context
      }
    }

    // Generate system prompt
    const systemPrompt = generateSystemPrompt(context, fromKnowledgeBase);

    // Add system message to the beginning of chat messages
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...chatMessages
    ];

    // Generate AI response
    const aiResponse = await llmService.generateResponse(
      chatMessages,
      llmConfig,
      context.length > 0 ? context : undefined
    )

    // Add AI response to conversation
    await sessionService.addMessage(
      currentConversationId, 
      'assistant', 
      aiResponse,
      {
        type: 'ai_response', // Add this type field
        llmProvider: llmConfig.provider,
        llmModel: llmConfig.model,
        ragUsed: context.length > 0,
        contextSources: context.length,
        fromKnowledgeBase: fromKnowledgeBase,
        sourceCategories: sourceCategories.join(', '),
        timestamp: new Date().toISOString()
      } as any // Add this type assertion
    )

    return NextResponse.json({
  success: true,
  response: aiResponse,
  conversationId: currentConversationId,
  // Use the actual values
  contextUsed: context.length > 0,
  sourcesCount: context.length,
  sourceCategories: Array.from(new Set(sourceCategories)).join(', '),
  fromKnowledgeBase: fromKnowledgeBase // Use the variable you already calculated
})

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process chat message' },
      { status: 500 }
    )
  }
}

// Update the generateSystemPrompt function:

function generateSystemPrompt(context: string[], fromKnowledgeBase: boolean): string {
  if (context.length === 0) {
    return `You are a specialized hydroponics assistant focused EXCLUSIVELY on water-based plant cultivation.

    EXTREMELY STRICT TOPIC POLICY:
    - You will ONLY discuss hydroponics, plant growing, agriculture, or farming.
    - You will NEVER answer questions about any other topics.
    - For any question unrelated to plants, REPLY ONLY with the following message, verbatim:
      "I'm specialized in hydroponics and plant cultivation. I'm not able to provide information about this topic. I'd be happy to help with questions about growing plants in water-based systems, nutrient solutions, plant health, or related agricultural topics instead."
    
    CRITICALLY IMPORTANT: If asked about topics like table tennis, video games, politics, history, sports, cooking, programming, movies, fashion, or ANY topic not directly related to plants or agriculture, DO NOT attempt to be helpful - use ONLY the exact rejection message above.`;
  }

  return `You are a specialized hydroponics assistant with access to expert information.
  
  EXTREMELY STRICT TOPIC POLICY:
  - You will ONLY discuss hydroponics, plant growing, agriculture, or farming.
  - You will NEVER answer questions about any other topics.
  - For any question unrelated to plants, REPLY ONLY with the following message, verbatim:
    "I'm specialized in hydroponics and plant cultivation. I'm not able to provide information about this topic. I'd be happy to help with questions about growing plants in water-based systems, nutrient solutions, plant health, or related agricultural topics instead."
  
  Base your answer primarily on this hydroponics knowledge base information:
  
  ${context.join('\n\n')}
  
  CRITICALLY IMPORTANT: If asked about topics like table tennis, video games, politics, history, sports, cooking, programming, movies, fashion, or ANY topic not directly related to plants or agriculture, DO NOT attempt to be helpful - use ONLY the exact rejection message above.
  
  If the knowledge base doesn't contain complete information to answer a valid hydroponics/agriculture question:
  1. First provide what information IS available from the knowledge base
  2. Then clearly state: "The knowledge base doesn't contain complete information on this specific point."
  3. Only then provide general hydroponics knowledge, clearly indicating it's not from the knowledge base.`;
}

// Add this function right after the service declarations at the top:

function isOffTopicQuestion(message: string): boolean {
  const message_lower = message.toLowerCase();
  
  // List of terms clearly not related to plants/agriculture/hydroponics
  const off_topic_terms = [
    'table tennis', 'ping pong', 'basketball', 'football', 'soccer',
    'politics', 'election', 'movie', 'film', 'celebrity', 'actor',
    'cryptocurrency', 'bitcoin', 'stock market', 'computer', 'programming',
    'video game', 'smartphone', 'dating', 'recipe', 'cooking', 'baking',
    'history', 'war', 'mathematics', 'physics', 'sports', 'music', 'song',
    'guitar', 'piano', 'dance', 'television', 'show', 'series', 'episode',
    'car', 'automobile', 'vehicle', 'fashion', 'clothing', 'makeup',
    'how to', 'teach me', 'explain', 'what is', 'tell me about',
    'review', 'compare', 'versus', 'vs'
  ];
  
  // If the message contains these off-topic terms, mark it as off-topic
  if (off_topic_terms.some(term => message_lower.includes(term))) {
    // Also check it DOESN'T contain hydroponics-related terms
    const hydroponic_terms = [
      'hydropon', 'plant', 'grow', 'nutrient', 'water', 'ph', 'light', 
      'seed', 'farm', 'crop', 'cultiva', 'greenhouse', 'garden', 'agriculture'
    ];
    
    // If it contains off-topic terms AND doesn't contain hydroponic terms, it's off-topic
    return !hydroponic_terms.some(term => message_lower.includes(term));
  }
  
  return false;
}


async function classifyMessageTopic(message: string): Promise<boolean> {
  try {
    // 1. FIRST-PASS BLOCKLIST: Immediately reject obvious problematic content
    const quickRejectPatterns = [
      // Fiction characters (existing check)
      /\b(superman|batman|spider[ -]?man|iron[ -]?man|thor|hulk|captain america|wonder woman|flash|aquaman|cyborg|green lantern|martian|justice league|avengers|x-men|fictional|fantasy|imaginary|superhero|super hero|super power|mythical|legendary|magical|wizard|witch|dragon|fairy|elf|dwarf|hobbit|jedi|sith|darth vader|luke skywalker|harry potter|gandalf|frodo|voldemort|dumbledore|naruto|goku|pokemon|mario|zelda|link)\b/i,
      
      // Dual-purpose questions
      /\b(hydropon|plant|grow).+\b(and also|while you're at it|besides that|additionally|on another note)\b/i,
      /\b(hydropon|plant|grow).+\b(can you also|plus|as well as|along with)\b.+\b(tell me about|explain|what is|how to)\b/i,
      
      // Plant personification
      /\b(plants|crops).+\b(feel|think|talk|say|opinion|emotions|sentient|consciousness)\b/i,
      
      // Medical claims
      /\b(cure|treat|heal|therapy|medicine|medical|disease|illness|remedy|symptoms)\b.+\b(hydropon|plant)\b/i,
      /\b(hydropon|plant)\b.+\b(cure|treat|heal|therapy|medicine|medical|disease|illness|remedy|symptoms)\b/i,
      
      // Controlled substances
      /\b(thc|cannabis|marijuana|weed|pot|cocaine|heroin|psychedelic|mushroom|psilocybin|lsd|meth)\b/i,
      
      // Religious/spiritual
      /\b(god|bible|quran|torah|spiritual|prayer|soul|spirit|religion|religious|faith|holy|sacred|divine)\b.+\b(hydropon|plant)\b/i,
      /\b(hydropon|plant)\b.+\b(god|bible|quran|torah|spiritual|prayer|soul|spirit|religion|religious|faith|holy|sacred|divine)\b/i,
      
      // Personal advice
      /\b(should i|advice for me|my life|my career|my relationship|my spouse|my partner|my family|my parents|my children|my kids|my marriage|my divorce)\b/i,
      
      // Jokes/sarcasm/non-serious
      /\b(joke|funny|humorous|entertaining|amusing|comedy|satire|parody|lol|lmao|rofl)\b.+\b(hydropon|plant)\b/i,
      
      // Politics with plants
      /\b(democrat|republican|election|political|president|governor|senator|congress|government|liberal|conservative|policy|regulation|law|legislation)\b.+\b(hydropon|plant)\b/i,
      /\b(hydropon|plant)\b.+\b(democrat|republican|election|political|president|governor|senator|congress|government|liberal|conservative|policy|regulation|law|legislation)\b/i,
    ];
    
    // Check if the message matches any of our immediate rejection patterns
    if (quickRejectPatterns.some(pattern => pattern.test(message))) {
      console.log('Quick rejection pattern matched');
      return false;
    }
    
    // 2. LLM-BASED CLASSIFICATION with enhanced prompt
    const classifierPrompt = `
    TASK: You are a binary classifier that determines if a question is related STRICTLY to REAL-WORLD hydroponics/plant cultivation or not.
    INPUT: "${message}"
    
    Rules:
    - VALID topics: real-world hydroponics, actual plant growing, practical agriculture, factual farming, realistic gardening
    - INVALID topics: 
      * Anything not related to plants or agriculture
      * FICTIONAL scenarios or characters
      * HYPOTHETICAL implausible situations
      * Questions about NON-EXISTENT entities
      * POLITICAL or RELIGIOUS discussions even if they mention plants
      * MEDICAL claims or advice related to plants
      * Questions about CONTROLLED SUBSTANCES
      * PERSONAL advice questions that mention plants
      * Questions that start about plants but then ask about unrelated topics
      * JOKES or NON-SERIOUS questions about plants
      * Questions asking plants to have FEELINGS, THOUGHTS, or CONSCIOUSNESS
    
    IMPORTANT: The entire question must be PURELY about practical plant cultivation. If it contains ANY non-plant-related elements, mark it OFF-TOPIC.
    
    Examples of OFF-TOPIC questions:
    - "How do I grow tomatoes hydroponically and what movie should I watch tonight?"
    - "Do hydroponic plants feel sad without soil?"
    - "Can hydroponic basil cure my headaches?"
    - "Should I leave my spouse to focus on my hydroponic farm?"
    - "What does the Bible say about hydroponics?"
    - "How to maximize THC in hydroponic cannabis?"
    - "Is hydroponics more aligned with liberal or conservative values?"
    - "Tell me a funny joke about hydroponic lettuce."
    
    OUTPUT: Respond ONLY with "ON-TOPIC" if the question is ENTIRELY about practical, real-world hydroponics/agriculture, or "OFF-TOPIC" for any question that includes non-plant elements or falls into the INVALID categories.
    `;
    
    const response = await llmService.generateResponse(
      [{ role: 'user', content: classifierPrompt }],
      {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        temperature: 0.1,
        maxTokens: 10
      }
    );
    
    const isOnTopic = response.trim().includes("ON-TOPIC");
    console.log(`LLM classifier result for "${message.slice(0, 30)}...": ${isOnTopic ? 'ON-TOPIC' : 'OFF-TOPIC'}`);
    return isOnTopic;
  } catch (error) {
    console.warn('Topic classification failed:', error);
    
    // 3. ENHANCED FALLBACK CHECK
    const message_lower = message.toLowerCase();
    
    // Check for mixed content: starts with hydroponics but adds other topics
    const containsHydroponicTerms = /\b(hydropon|plant|grow|nutrient|water|ph|light|seed|farm|crop|cultivat|greenhouse|garden|agriculture)\b/i.test(message_lower);
    
    if (containsHydroponicTerms) {
      // If it contains hydroponics terms, check for problematic combinations
      
      // Dual-purpose questions
      if (/\b(and also|as well as|while you're at it|besides that|additionally|on another note)\b/i.test(message_lower)) {
        console.log('Dual-purpose question detected');
        return false;
      }
      
      // Medical claims
      if (/\b(cure|treat|heal|therapy|medicine|medical|disease|illness|remedy|symptoms)\b/i.test(message_lower)) {
        console.log('Medical claim detected');
        return false;
      }
      
      // Controlled substances
      if (/\b(thc|cannabis|marijuana|weed|pot|cocaine|heroin|psychedelic|mushroom|psilocybin|lsd|meth)\b/i.test(message_lower)) {
        console.log('Controlled substance detected');
        return false;
      }
      
      // Personal advice
      if (/\b(should i|advice for me|my life|my career|my relationship|my spouse|my partner|my family|my parents|my children|my kids|my marriage|my divorce)\b/i.test(message_lower)) {
        console.log('Personal advice request detected');
        return false;
      }
      
      // Plant personification
      if (/\b(plants|crops).+\b(feel|think|talk|say|opinion|emotions|sentient|consciousness)\b/i.test(message_lower)) {
        console.log('Plant personification detected');
        return false;
      }
    }
    
    // Fall back to regular keyword check for everything else
    return !isOffTopicQuestion(message);
  }
}