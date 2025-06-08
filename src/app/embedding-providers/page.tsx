'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Paper,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Alert,
  Chip,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  Cancel as ErrorIcon,
  Settings as SettingsIcon,
  Psychology as BrainIcon,
  Speed as SpeedIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material'

interface ProviderInfo {
  provider: string
  model?: string
  configured: boolean
}

interface AvailableProviders {
  [key: string]: boolean
}

interface TestResult {
  success: boolean
  provider: string
  model?: string
  embeddingDimensions?: number
  testPassed?: boolean
  message?: string
  error?: string
}

export default function EmbeddingProvidersPage() {
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null)
  const [availableProviders, setAvailableProviders] = useState<AvailableProviders>({})
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [selectedProvider, setSelectedProvider] = useState('gemini')
  const [selectedModel, setSelectedModel] = useState('')
  const [testText, setTestText] = useState('This is a test text for generating embeddings')

  const providerModels = {
    openai: ['text-embedding-ada-002', 'text-embedding-3-small', 'text-embedding-3-large'],
    gemini: ['text-embedding-004'],
    huggingface: [
      'sentence-transformers/all-MiniLM-L6-v2',
      'sentence-transformers/all-mpnet-base-v2',
      'BAAI/bge-small-en-v1.5'
    ],
    cohere: ['embed-english-v3.0', 'embed-english-light-v3.0'],
    ollama: ['nomic-embed-text', 'mxbai-embed-large'],
    local: ['fallback']
  }

  const providerDescriptions = {
    openai: 'Industry standard embeddings with excellent quality',
    gemini: 'Google\'s embedding model with free tier and great performance',
    huggingface: 'Open source models with various sizes and specializations',
    cohere: 'High-quality embeddings with good performance',
    ollama: 'Run models locally for complete privacy and control',
    local: 'Basic fallback embeddings for development and testing'
  }

  useEffect(() => {
    fetchProviderInfo()
  }, [])
  const fetchProviderInfo = async () => {
    try {
      const response = await fetch('/api/embedding-providers')
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Expected JSON, received:', text.substring(0, 200))
        throw new Error('Server returned non-JSON response')
      }
      
      const data = await response.json()
      
      if (data.success) {
        setProviderInfo(data.currentProvider)
        setAvailableProviders(data.availableProviders)
        setSelectedProvider(data.currentProvider.provider)
        setSelectedModel(data.currentProvider.model || '')
      }
    } catch (error) {
      console.error('Error fetching provider info:', error)
    } finally {
      setLoading(false)
    }
  }
  const testProvider = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/embedding-providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider: selectedProvider,
          model: selectedModel || undefined,
          testText
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Expected JSON, received:', text.substring(0, 200))
        throw new Error('Server returned non-JSON response')
      }

      const result = await response.json()
      setTestResult(result)
    } catch (error) {
      console.error('Test error:', error)
      setTestResult({
        success: false,
        provider: selectedProvider,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setTesting(false)
    }
  }

  const getProviderIcon = (provider: string, available: boolean) => {
    if (available) {
      return <CheckIcon color="success" />
    } else {
      return <ErrorIcon color="error" />
    }
  }

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <BrainIcon color="primary" />
            Embedding Providers Configuration
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure and test different embedding providers as alternatives to OpenAI.
            Each provider offers different benefits in terms of cost, performance, and privacy.
          </Typography>
        </Box>

        {/* Current Provider Status */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <SettingsIcon color="primary" />
              Current Configuration
            </Typography>
            {providerInfo && (
              <Box>
                <Chip 
                  label={`Provider: ${providerInfo.provider}`}
                  color={providerInfo.configured ? 'success' : 'error'}
                  sx={{ mr: 2, mb: 1 }}
                />
                {providerInfo.model && (
                  <Chip 
                    label={`Model: ${providerInfo.model}`}
                    variant="outlined"
                    sx={{ mr: 2, mb: 1 }}
                  />
                )}
                <Chip 
                  label={providerInfo.configured ? 'Configured' : 'Not Configured'}
                  color={providerInfo.configured ? 'success' : 'error'}
                  sx={{ mb: 1 }}
                />
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Available Providers */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Available Providers
            </Typography>            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
              {Object.entries(availableProviders).map(([provider, available]) => (
                <Box key={provider}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        {getProviderIcon(provider, available)}
                        <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                          {provider}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {providerDescriptions[provider as keyof typeof providerDescriptions]}
                      </Typography>
                      <Chip 
                        label={available ? 'Available' : 'Not Configured'}
                        color={available ? 'success' : 'default'}
                        size="small"
                      />                    </CardContent>
                  </Card>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Test Provider */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <SpeedIcon color="primary" />
              Test Embedding Provider
            </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3, mb: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Provider</InputLabel>
                <Select
                  value={selectedProvider}
                  label="Provider"
                  onChange={(e) => {
                    setSelectedProvider(e.target.value)
                    setSelectedModel('')
                  }}
                >
                  {Object.keys(providerModels).map((provider) => (
                    <MenuItem key={provider} value={provider}>
                      {provider.charAt(0).toUpperCase() + provider.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth>
                <InputLabel>Model</InputLabel>
                <Select
                  value={selectedModel}
                  label="Model"
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  {providerModels[selectedProvider as keyof typeof providerModels]?.map((model) => (
                    <MenuItem key={model} value={model}>
                      {model}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <TextField
              fullWidth
              label="Test Text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              multiline
              rows={3}
              sx={{ mb: 3 }}
            />

            <Button
              variant="contained"
              onClick={testProvider}
              disabled={testing}
              sx={{ mb: 3 }}
            >
              {testing ? <CircularProgress size={24} /> : 'Test Provider'}
            </Button>

            {testResult && (
              <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mb: 2 }}>
                {testResult.success ? (
                  <Box>
                    <Typography variant="subtitle2">
                      ✅ {testResult.message}
                    </Typography>
                    {testResult.embeddingDimensions && (
                      <Typography variant="body2">
                        Generated {testResult.embeddingDimensions}-dimensional embedding vector
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Typography>
                    ❌ Error: {testResult.error}
                  </Typography>
                )}
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Setup Instructions */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Setup Instructions
            </Typography>
            
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">🟢 Gemini (Recommended)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" paragraph>
                  Google's embedding API with generous free tier and excellent quality.
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>Setup:</strong>
                </Typography>
                <Typography variant="body2" component="div">
                  1. Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">Google AI Studio</a><br/>
                  2. Create a new API key<br/>
                  3. Add to your .env.local: <code>GEMINI_API_KEY=your_key_here</code><br/>
                  4. Restart your application
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">🤗 Hugging Face</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" paragraph>
                  Open source models with free tier and various specializations.
                </Typography>
                <Typography variant="body2" component="div">
                  1. Create account at <a href="https://huggingface.co" target="_blank" rel="noopener">Hugging Face</a><br/>
                  2. Generate API token in settings<br/>
                  3. Add to .env.local: <code>HUGGINGFACE_API_KEY=your_token_here</code><br/>
                  4. Choose from various models like sentence-transformers/all-MiniLM-L6-v2
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">🦙 Ollama (Local)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" paragraph>
                  Run embedding models locally for complete privacy and no API costs.
                </Typography>
                <Typography variant="body2" component="div">
                  1. Install Ollama: <code>curl -fsSL https://ollama.ai/install.sh | sh</code><br/>
                  2. Pull embedding model: <code>ollama pull nomic-embed-text</code><br/>
                  3. Start Ollama service: <code>ollama serve</code><br/>
                  4. No API key needed!
                </Typography>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">🏢 Cohere</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" paragraph>
                  High-quality embeddings with good performance and free tier.
                </Typography>
                <Typography variant="body2" component="div">
                  1. Sign up at <a href="https://cohere.ai" target="_blank" rel="noopener">Cohere</a><br/>
                  2. Generate API key<br/>
                  3. Add to .env.local: <code>COHERE_API_KEY=your_key_here</code>
                </Typography>
              </AccordionDetails>
            </Accordion>
          </CardContent>
        </Card>
      </Paper>
    </Container>
  )
}
