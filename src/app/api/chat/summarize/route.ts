import { NextRequest, NextResponse } from 'next/server'
import { SessionService } from '@/lib/session'
import { LLMService } from '@/lib/llm'

const sessionService = new SessionService()
const llmService = new LLMService()

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      )
    }

    // Try to validate session, but don't require it for summarization
    let session = null
    try {
      session = await sessionService.validateSession(token)
    } catch (error) {
      console.warn('Session validation failed, proceeding without session:', error)
    }

    const body = await request.json()
    const { content, conversationId, messageId } = body

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      )
    }

    // Generate summary using LLM
    const summaryPrompt = `You are a specialized hydroponics plant care summarizer with expertise in plant health, nutrition, and growing systems.

**CORE OBJECTIVE:**
Transform hydroponics and plant care content into actionable, precise bullet points for growers using strict markdown formatting.

**MANDATORY FORMATTING RULES:**
- Use ONLY bullet points (- or *) - NO numbered lists, paragraphs, or prose
- Group related points under **bold subheadings** (## format for major sections)
- Maintain consistent indentation for sub-bullets (2 spaces for nested points)
- Preserve original markdown formatting (**bold**, *italic*, \`code\`, etc.)
- Each bullet point must be a complete, standalone statement
- Maximum 2 levels of nesting to avoid complexity

**HYDROPONICS-SPECIFIC CONTENT PROCESSING:**
- Prioritize plant health indicators, nutrient levels, pH values, and environmental conditions
- Extract specific measurements (PPM, EC, pH ranges, temperatures, humidity levels)
- Highlight growth stages, feeding schedules, and timing information
- Emphasize troubleshooting steps and problem identification
- Focus on actionable care instructions and maintenance tasks
- Preserve exact nutrient ratios, concentrations, and mixing instructions

**PLANT CARE FOCUS AREAS:**
- **Growing Conditions**: pH, EC/PPM, temperature, humidity, lighting schedules
- **Nutrition**: Nutrient solutions, deficiency symptoms, feeding frequencies
- **Plant Health**: Disease symptoms, pest identification, treatment methods
- **System Maintenance**: Equipment checks, cleaning procedures, replacement schedules
- **Growth Monitoring**: Harvest timing, pruning techniques, yield optimization
- **Troubleshooting**: Problem diagnosis, corrective actions, prevention methods

**QUALITY STANDARDS:**
- Each bullet point: 5-30 words maximum (longer for technical instructions)
- Preserve exact measurements, ratios, and scientific terms
- Include timing information (daily, weekly, during flowering, etc.)
- Maintain plant variety specifics and growth stage distinctions
- Remove filler words but keep precision indicators (exactly, approximately, between)
- No introductory text, conclusions, or meta-commentary

**CONTENT EXCLUSIONS:**
- Do NOT add growing advice not present in the original text
- Do NOT interpret symptoms beyond what's explicitly described
- Do NOT include your own plant care recommendations
- Do NOT create generic growing tips or platitudes
- Do NOT repeat the same care instruction in different bullets

**STRUCTURE REQUIREMENTS:**
- Start immediately with bullet points (no preamble)
- Organize by plant care priority: critical issues first, routine care after
- Group by growth stage when applicable (seedling, vegetative, flowering, harvest)
- Use subheadings for different plant varieties or system types
- End cleanly with the last bullet point (no closing remarks)

**HYDROPONICS TERMINOLOGY PRESERVATION:**
- Keep exact nutrient names (CalMag, Grow/Bloom ratios, etc.)
- Preserve system types (DWC, NFT, Ebb & Flow, Aeroponics)
- Maintain equipment specifications (pump rates, timer settings, light schedules)
- Include plant-specific terms (nodes, internodes, trichomes, pistils)
- Retain measurement units (ml/L, g/gal, PPFD, DLI)

**URGENCY INDICATORS:**
- Mark time-sensitive actions with specific timing
- Highlight critical thresholds that require immediate attention
- Emphasize seasonal or growth-stage dependent care
- Note emergency responses for plant stress or system failures

--- TEXT START ---
${content}
--- TEXT END ---`;

    const summary = await llmService.generateResponse(
      [{ role: 'user', content: summaryPrompt }],
      {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        temperature: 0.3,
        maxTokens: 1000
      }
    )

    return NextResponse.json({
      success: true,
      summary: summary.trim(),
      originalContent: content
    })

  } catch (error) {
    console.error('Summarization error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to generate summary' },
      { status: 500 }
    )
  }
}
