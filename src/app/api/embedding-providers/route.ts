import { NextRequest, NextResponse } from 'next/server'
import { createVectorService, MultiVectorService } from '@/lib/vector-multi'

export async function GET() {
  try {
    const vectorService = createVectorService()
    const info = vectorService.getProviderInfo()
    
    // Check which providers are available
    const availableProviders = {
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      huggingface: !!process.env.HUGGINGFACE_API_KEY,
      cohere: !!process.env.COHERE_API_KEY,
      ollama: true, // Always try to connect
      local: true   // Always available as fallback
    }

    return NextResponse.json({
      success: true,
      currentProvider: info,
      availableProviders,
      recommendations: [
        {
          provider: 'gemini',
          reason: 'Free tier with excellent quality',
          setup: 'Get API key from https://aistudio.google.com/app/apikey'
        },
        {
          provider: 'huggingface',
          reason: 'Free and open source models',
          setup: 'Get API token from https://huggingface.co/settings/tokens'
        },
        {
          provider: 'ollama',
          reason: 'Completely local and private',
          setup: 'Install Ollama and run: ollama pull nomic-embed-text'
        }
      ]
    })
  } catch (error) {
    console.error('Error getting embedding providers:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get provider information'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { provider, model, testText = "This is a test embedding" } = await request.json()
    
    if (!provider) {
      return NextResponse.json({
        success: false,
        error: 'Provider is required'
      }, { status: 400 })
    }

    // Test the specified provider
    const vectorService = new MultiVectorService({
      provider,
      model
    })

    const testEmbedding = await vectorService.generateEmbedding(testText)
    
    if (!testEmbedding) {
      return NextResponse.json({
        success: false,
        error: `Failed to generate embedding with provider: ${provider}`
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      provider,
      model,
      embeddingDimensions: testEmbedding.length,
      testPassed: true,
      message: `Successfully generated ${testEmbedding.length}-dimensional embedding using ${provider}`
    })

  } catch (error) {
    console.error('Error testing embedding provider:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
