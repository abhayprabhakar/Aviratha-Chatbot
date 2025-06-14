'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  IconButton,
  Drawer,
  List,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Card,
  CardContent,
  Avatar,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel,
  Badge,
  Fab,
  Tooltip,
  CircularProgress,
  AppBar,
  Toolbar,
  useTheme,
  useMediaQuery,
  Zoom,
  Fade,
  Stack
} from '@mui/material'
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as UserIcon,
  Description as FileTextIcon,
  Settings as SettingsIcon,
  Upload as UploadIcon,
  Chat as MessageSquareIcon,
  Book as BookIcon,
  Delete as DeleteIcon,
  Menu as MenuIcon,
  AutoAwesome as SparklesIcon,
  Bolt as ZapIcon,
  Star as StarIcon,
  Add as AddIcon,
  PictureAsPdf as PdfIcon,
  TextSnippet as TxtIcon,
  Article as DocIcon
} from '@mui/icons-material'
import { UserIdentificationService } from '@/lib/user-identification'
import MarkdownRenderer from './MarkdownRenderer'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: any
  createdAt: string
}

interface Conversation {
  id: string
  title?: string
  createdAt: string
  messageCount: number
}

interface Document {
  id: string
  title: string
  fileName: string
  fileType: string
  fileSize: number
}

interface LLMConfig {
  provider: 'openai' | 'gemini' | 'claude' | 'ollama'
  model: string
  temperature: number
  maxTokens: number
}

const defaultLLMConfig: LLMConfig = {
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  temperature: 0.7,
  maxTokens: 2000
}

export default function ChatInterface() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [llmConfig, setLLMConfig] = useState<LLMConfig>(defaultLLMConfig)
  const [useRAG, setUseRAG] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile)
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    initializeSession()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const initializeSession = async () => {
    try {
      const userId = UserIdentificationService.getUserId()
      const isReturning = UserIdentificationService.isReturningUser()
      
      console.log(`Initializing session for ${isReturning ? 'returning' : 'new'} user:`, userId)

      const existingToken = localStorage.getItem('chat_token')
      if (existingToken) {
        const response = await fetch('/api/session', {
          headers: { 'Authorization': `Bearer ${existingToken}` }
        })
        
        if (response.ok) {
          setToken(existingToken)
          loadConversations(existingToken)
          loadDocuments(existingToken)
          return
        }
      }

      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          isAdmin: false,
          userId: userId
        })
      })

      const data = await response.json()
      if (data.success) {
        setToken(data.token)
        localStorage.setItem('chat_token', data.token)
        loadConversations(data.token)
        loadDocuments(data.token)
      }
    } catch (error) {
      console.error('Failed to initialize session:', error)
    }
  }

  const loadConversations = async (authToken: string) => {
    try {
      const response = await fetch('/api/conversations', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      const data = await response.json()
      if (data.success) {
        setConversations(data.conversations)
      }
    } catch (error) {
      console.error('Failed to load conversations:', error)
    }
  }

  const loadDocuments = async (authToken: string) => {
    try {
      const response = await fetch('/api/upload', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      const data = await response.json()
      if (data.success) {
        setDocuments(data.documents)
      }
    } catch (error) {
      console.error('Failed to load documents:', error)
    }
  }

  const loadConversation = async (conversationId: string) => {
    if (!token) return
    try {
      const response = await fetch(`/api/conversations?id=${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        setMessages(data.messages)
        setCurrentConversationId(conversationId)
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
    }
  }

  // Update the sendMessage function to handle knowledge base attribution
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !token) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    setIsLoading(true)

    const tempMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString()
    }
    setMessages(prev => [...prev, tempMessage])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId: currentConversationId,
          llmConfig,
          useRAG: true // Always use RAG for knowledge base
        })
      })

      const data = await response.json()
      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          metadata: {
            contextUsed: data.contextUsed,
            sourcesCount: data.sourcesCount,
            sourceCategories: data.sourceCategories, // New field for categories
            fromKnowledgeBase: data.fromKnowledgeBase // New field to indicate source
          },
          createdAt: new Date().toISOString()
        }
        
        setMessages(prev => [...prev.slice(0, -1), tempMessage, assistantMessage])
        setCurrentConversationId(data.conversationId)
        loadConversations(token)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const createNewConversation = () => {
    setMessages([])
    setCurrentConversationId(null)
  }

  const deleteConversation = async (conversationId: string) => {
    if (!token) return
    try {
      await fetch(`/api/conversations?id=${conversationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      loadConversations(token)
      if (currentConversationId === conversationId) {
        createNewConversation()
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // File upload disabled - using knowledge base only
    setShowSettings(false);
    alert('Document uploads have been disabled. This chatbot uses a pre-loaded knowledge base.');
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  const handleDeleteDocument = async (documentId: string, fileName?: string) => {
    if (!token) return
    if (!window.confirm(`Are you sure you want to delete${fileName ? ` "${fileName}"` : ''}?`)) return
    setDeleteMessage(null)
    try {
      // Use the correct API endpoint that proxies to Flask and deletes from both DBs
      const response = await fetch(`/api/upload?id=${documentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        setDeleteMessage('Document deleted successfully.')
        loadDocuments(token)
      } else {
        setDeleteMessage(data.error || 'Failed to delete document.')
      }
    } catch (error) {
      setDeleteMessage('Failed to delete document.')
      console.error('Delete document error:', error)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', position: 'relative' }}>
      {/* Mobile App Bar */}
      {isMobile && (
        <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
              <SparklesIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6" noWrap>
                Hydroponics AI Assistant
              </Typography>
            </Box>
          </Toolbar>
        </AppBar>
      )}

      {/* Sidebar */}
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sx={{
          width: 320,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 320,
            boxSizing: 'border-box',
            mt: isMobile ? 8 : 0,
          },
        }}
      >
        {/* Sidebar Header */}
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>            <Avatar 
              sx={{ 
                bgcolor: 'primary.main', 
                mr: 2,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              }}
            >
              <SparklesIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Hydroponics AI
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your Growing Assistant
              </Typography>
            </Box>
          </Box>
          
          <Button
            fullWidth
            variant="contained"
            startIcon={<AddIcon />}
            onClick={createNewConversation}            sx={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
              }
            }}
          >
            New Chat
          </Button>
        </Box>

        {/* Conversations */}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          <List>
            {conversations.map((conversation) => (
              <ListItemButton
                key={conversation.id}
                selected={currentConversationId === conversation.id}
                onClick={() => loadConversation(conversation.id)}
                sx={{
                  mx: 1,
                  mb: 0.5,
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'primary.contrastText',
                    },
                  },
                }}
              >
                <ListItemIcon>
                  <MessageSquareIcon />
                </ListItemIcon>
                <ListItemText
                  primary={conversation.title || 'New Chat'}
                  secondary={`${conversation.messageCount} messages`}
                  secondaryTypographyProps={{
                    color: currentConversationId === conversation.id ? 'inherit' : 'text.secondary'
                  }}
                />
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteConversation(conversation.id)
                  }}
                  sx={{
                    color: currentConversationId === conversation.id ? 'inherit' : 'text.secondary'
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemButton>
            ))}
          </List>
        </Box>

        {/* Sidebar Footer */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Stack spacing={1}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FileTextIcon />}
              onClick={() => setShowDocuments(true)}
              sx={{ justifyContent: 'flex-start' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <span>Knowledge Base</span>
                <Badge badgeContent={documents.length} color="primary" sx={{ ml: 'auto' }} />
              </Box>
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => setShowSettings(true)}
              sx={{ justifyContent: 'flex-start' }}
            >
              Settings
            </Button>
          </Stack>
        </Box>
      </Drawer>

      {/* Main Chat Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          mt: isMobile ? 8 : 0,
        }}
      >
        {/* Messages Container */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          <Container maxWidth="md" sx={{ height: '100%' }}>
            {messages.length === 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center',
                }}
              >
                <Avatar                  sx={{
                    width: 120,
                    height: 120,
                    mb: 3,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  }}
                >
                  <SparklesIcon sx={{ fontSize: 60 }} />
                </Avatar>
                <Typography variant="h4" gutterBottom fontWeight="bold">
                  Welcome to Hydroponics AI
                </Typography>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: 600 }}>
                  Your intelligent assistant for hydroponic growing. Ask me anything about nutrient solutions, 
                  plant care, system setup, or troubleshooting!
                </Typography>                <Box 
                  sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                    gap: 2,
                    maxWidth: 600 
                  }}
                >
                  <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => setInputMessage('What nutrients does lettuce need?')}>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <ZapIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="h6" gutterBottom>
                        Nutrients
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Learn about optimal nutrient solutions
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => setInputMessage('How do I set up a DWC system?')}>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <SettingsIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="h6" gutterBottom>
                        Setup
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Get help with system configuration
                      </Typography>
                    </CardContent>
                  </Card>
                  <Card sx={{ height: '100%', cursor: 'pointer' }} onClick={() => setInputMessage('My plants have yellow leaves, what should I do?')}>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <StarIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="h6" gutterBottom>
                        Troubleshooting
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Diagnose and solve plant issues
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            ) : (
              <Stack spacing={3} sx={{ pb: 2 }}>
                {messages.map((message, index) => (
                  <Fade in key={message.id} timeout={300} style={{ transitionDelay: `${index * 100}ms` }}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                        alignItems: 'flex-start',
                        gap: 2,
                      }}
                    >
                      <Avatar                        sx={{
                          bgcolor: message.role === 'user' ? 'primary.main' : 'secondary.main',
                          background: message.role === 'user' 
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : 'linear-gradient(135deg, #a8a8a8 0%, #7b7b7b 100%)',
                        }}
                      >
                        {message.role === 'user' ? <UserIcon /> : <BotIcon />}
                      </Avatar>
                      
                      <Card                        sx={{
                          maxWidth: '70%',
                          background: message.role === 'user'
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : theme.palette.background.paper,
                          color: message.role === 'user' ? 'white' : 'text.primary',
                        }}
                      >                        <CardContent>
                          <MarkdownRenderer 
                            content={message.content} 
                            isUserMessage={message.role === 'user'}
                          />
                          
                          {message.metadata?.contextUsed && (
                            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                              <Chip
                                icon={<FileTextIcon />}
                                label={message.metadata.fromKnowledgeBase 
                                  ? `From Hydroponics Knowledge Base (${message.metadata.sourceCategories})`
                                  : `Used ${message.metadata.sourcesCount} knowledge sources`}
                                size="small"
                                color={message.metadata.fromKnowledgeBase ? "success" : "default"}
                                variant="outlined"
                                sx={{ 
                                  color: message.role === 'user' ? 'white' : 'text.secondary',
                                  borderColor: message.role === 'user' ? 'white' : 'divider'
                                }}
                              />
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Box>
                  </Fade>
                ))}
                
                {isLoading && (
                  <Zoom in>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <Avatar                        sx={{
                          bgcolor: 'secondary.main',
                          background: 'linear-gradient(135deg, #a8a8a8 0%, #7b7b7b 100%)',
                        }}
                      >
                        <BotIcon />
                      </Avatar>
                      <Card>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={20} />
                            <Typography variant="body2" color="text.secondary">
                              Thinking...
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                  </Zoom>
                )}
                <div ref={messagesEndRef} />
              </Stack>
            )}
          </Container>
        </Box>

        {/* Input Area */}
        <Paper 
          elevation={8}          sx={{ 
            p: 3, 
            borderRadius: 0,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
            backdropFilter: 'blur(10px)',
            borderTop: 1,
            borderColor: 'divider'
          }}
        >
          <Container maxWidth="md">
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Ask me about hydroponics..."
                disabled={isLoading}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    background: 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(10px)',
                  }
                }}
                InputProps={{
                  endAdornment: inputMessage.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {inputMessage.length}/4000
                    </Typography>
                  ),
                }}
              />
              
              <Tooltip title="Send message">
                <Fab
                  color="primary"
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading}                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                      transform: 'scale(1.05)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  {isLoading ? <CircularProgress size={24} color="inherit" /> : <SendIcon />}
                </Fab>
              </Tooltip>
            </Box>
          </Container>
        </Paper>
      </Box>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SettingsIcon />
            <Typography variant="h6">AI Configuration</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Provider</InputLabel>
              <Select
                value={llmConfig.provider}
                label="Provider"
                onChange={(e) => setLLMConfig(prev => ({ ...prev, provider: e.target.value as any }))}
              >
                <MenuItem value="openai">OpenAI GPT</MenuItem>
                <MenuItem value="gemini">Google Gemini</MenuItem>
                <MenuItem value="claude">Anthropic Claude</MenuItem>
                <MenuItem value="ollama">Ollama</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              label="Model"
              value={llmConfig.model}
              onChange={(e) => setLLMConfig(prev => ({ ...prev, model: e.target.value }))}
            />
            
            <Box>
              <Typography gutterBottom>Temperature: {llmConfig.temperature}</Typography>
              <Slider
                value={llmConfig.temperature}
                onChange={(_, value) => setLLMConfig(prev => ({ ...prev, temperature: value as number }))}
                step={0.1}
                marks
                min={0}
                max={2}
                valueLabelDisplay="auto"
              />
            </Box>
            
            <FormControlLabel
              control={
                <Switch
                  checked={useRAG}
                  onChange={(e) => setUseRAG(e.target.checked)}
                />
              }
              label="Enable RAG (Knowledge Base)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Documents Dialog */}
      <Dialog open={showDocuments} onClose={() => setShowDocuments(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FileTextIcon />
              <Typography variant="h6">Knowledge Base ({documents.length})</Typography>
            </Box>
            {/* Knowledge Base Indicator */}
            <Tooltip title="This chatbot uses a specialized knowledge base">
              <IconButton 
                color="primary"
                onClick={() => alert('This chatbot uses a specialized hydroponics knowledge base covering Basic Concepts, Growing Conditions, Plant Care, Troubleshooting, and FAQs.')}
              >
                <BookIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogTitle>
        <DialogContent>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.txt,.doc,.docx,.md"
            multiple
            style={{ display: 'none' }}
          />
          {deleteMessage && (
            <Box sx={{ mb: 2 }}>
              <Typography color={deleteMessage.includes('success') ? 'success.main' : 'error.main'}>
                {deleteMessage}
              </Typography>
            </Box>
          )}
          <Box 
            sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 2,
              mt: 1
            }}
          >
            {documents.map((doc) => (
              <Card variant="outlined" key={doc.id}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    {doc.fileType === 'pdf' && <PdfIcon color="error" />}
                    {doc.fileType === 'txt' && <TxtIcon color="primary" />}
                    {(doc.fileType === 'doc' || doc.fileType === 'docx') && <DocIcon color="info" />}
                    <Typography variant="subtitle2" noWrap sx={{ flexGrow: 1 }}>
                      {doc.title}
                    </Typography>
                    <Tooltip title="Delete document">
                      <IconButton size="small" color="error" onClick={() => handleDeleteDocument(doc.id, doc.fileName)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(doc.fileSize)}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
          {documents.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <FileTextIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No documents uploaded yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upload PDF, TXT, DOC, or MD files to enhance AI responses
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDocuments(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
