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

      if (/\b(hello|hi|hey|greetings|good morning|good afternoon)\b/i.test(message_lower)) {
        rejectionResponse = `Hello! I'm your hydroponics assistant. I'd love to help you with questions about growing plants in water-based systems, nutrient solutions, plant health, or any agricultural topics. What would you like to know about hydroponics?`;
      } else if (/\b(what.*can.*you|what.*do.*you|who.*are.*you|tell.*about.*yourself)\b/i.test(message_lower)) {
        rejectionResponse = `I'm a specialized AI assistant focused on hydroponics and plant cultivation. I can help you with:

• Plant growing techniques and systems (DWC, NFT, Aeroponics, etc.)
• Nutrient solutions and pH management
• Plant health and troubleshooting
• Lighting and environmental controls
• Crop selection and cultivation tips
• System setup and maintenance

What hydroponic topic would you like to explore?`;
      } else {
        rejectionResponse = `I specialize in hydroponics and plant cultivation. While I can't help with that particular topic, I'd be happy to answer questions about growing plants in water-based systems, nutrient solutions, plant health, or related agricultural topics. Is there anything about hydroponics you'd like to know?`;
      }
      
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
    
    // Trigger title generation for new conversations
    if (token) {
      await triggerTitleGeneration(currentConversationId, token)
    }

    return NextResponse.json({
      success: true,
      response: aiResponse,
      conversationId: currentConversationId,
      contextUsed: context.length > 0,
      sourcesCount: context.length,
      fromKnowledgeBase: fromKnowledgeBase,
      sourceCategories: Array.from(new Set(sourceCategories)).join(', ')
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
    // 1. ALLOW most hydroponic questions - be more permissive
    const message_lower = message.toLowerCase();
    
    // Quick approval for obvious hydroponic terms
    const hydroponicTerms = /\b(hydropon|hydroponic|plant|grow|growing|nutrient|water|ph|light|seed|farm|crop|cultivat|greenhouse|garden|agriculture|lettuce|tomato|basil|spinach|kale|herb|vegetable|fruit|root|leaf|stem|flower|soil|fertilizer|dwc|nft|ebb|flow|aeropon|drip|system|setup|ppm|ec|tds)|what.*(and all|everything).*answer|what.*can.*you.*(help|do|answer)|tell.*about.*yourself|who.*are.*you|what.*are.*you|how.*work|explain.*yourself/i.test(message_lower);
    
    if (hydroponicTerms) {
      // Even if it contains hydroponic terms, check for obviously problematic content
      const severeProblems = [
        /\b(superman|batman|spider[ -]?man|avengers|fictional|superhero|dragon|wizard|jedi|pokemon)\b/i,
        /\b(thc|cannabis|marijuana|cocaine|heroin|meth)\b/i,
        /\b(cure cancer|treat aids|heal diabetes)\b/i,
        /\b(kill|murder|violence|bomb|weapon)\b/i
      ];
      
      if (severeProblems.some(pattern => pattern.test(message_lower))) {
        return false;
      }
      
      // For hydroponic-related questions, be very permissive
      return true;
    }
    
    // 2. LLM Classification for borderline cases only
    const classifierPrompt = `Is this question related to hydroponics, plant growing, or agriculture?

Question: "${message}"

You should answer "ON-TOPIC" for:
- Any question about growing plants
- Questions about plant care, nutrients, water, pH, lighting
- Questions about farming or gardening
- Questions about what the assistant can help with
- General questions about capabilities
- Simple greetings if they mention plants

Only answer "OFF-TOPIC" for:
- Pure entertainment (movies, games, sports)
- Pure technology (computers, phones, apps)
- Pure politics or religion
- Pure medical advice for humans
- Fictional characters or stories
- Illegal activities

Respond with only "ON-TOPIC" or "OFF-TOPIC":`;

    const response = await llmService.generateResponse(
      [{ role: 'user', content: classifierPrompt }],
      {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        temperature: 0.3,
        maxTokens: 10
      }
    );
    
    const isOnTopic = response.trim().includes("ON-TOPIC");
    console.log(`LLM classifier result for "${message.slice(0, 50)}...": ${isOnTopic ? 'ON-TOPIC' : 'OFF-TOPIC'}`);
    return isOnTopic;
    
  } catch (error) {
    console.warn('Topic classification failed:', error);
    
    // 3. VERY PERMISSIVE FALLBACK
    const message_lower = message.toLowerCase();
    
    // Only reject obviously non-plant related content
    const clearlyOffTopic = [
      /\b(movie|film|celebrity|actor|actress|director)\b/i,
      /\b(sports|football|basketball|soccer|tennis|golf)\b/i,
      /\b(computer|programming|software|app|phone|internet)\b/i,
      /\b(politics|election|president|government|democrat|republican)\b/i,
      /\b(religion|god|bible|prayer|church|mosque|temple)\b/i,
      /\b(superman|batman|fictional|superhero|movie)\b/i
    ];
    
    // Only reject if it clearly matches off-topic patterns AND doesn't mention plants
    const containsPlantTerms = /\b(plant|grow|hydroponic|garden|farm|crop|vegetable|fruit|nutrient|water|ph|seed)\b/i.test(message_lower);
    
    if (containsPlantTerms) {
      return true; // If it mentions plants at all, allow it
    }
    
    // Only reject if clearly off-topic
    return !clearlyOffTopic.some(pattern => pattern.test(message_lower));
  }
}

async function triggerTitleGeneration(conversationId: string, token: string) {
  try {
    // Get conversation messages to check count
    const session = await sessionService.validateSession(token)
    if (!session) {
      console.warn('Invalid session for title generation')
      return
    }
    
    const messages = await sessionService.getConversationMessages(conversationId, session.sessionId)
    
    // Only generate title after 3rd or 4th message (2nd exchange) and if no title exists yet
    if ((messages.length >= 3 && messages.length <= 4)) {
      // Check if conversation already has a title
      const conversations = await sessionService.getConversations(session.sessionId);
      const currentConv = conversations.find(conv => conv.id === conversationId);
      
      // Only generate if no title exists yet
      if (!currentConv?.title) {
        console.log(`Triggering title generation for conversation ${conversationId} with ${messages.length} messages (no title exists)`);
        
        // Make async call to title generation (don't wait for it)
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
      } else {
        console.log(`Conversation already has title: "${currentConv.title}"`)
      }
    } else {
      console.log(`Not generating title yet: ${messages.length} messages (need 3-4 and no existing title)`)
    }
  } catch (error) {
    console.warn('Title generation trigger failed:', error)
  }
}