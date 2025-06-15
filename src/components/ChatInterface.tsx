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
    <Box sx={{ 
      display: 'flex', 
      height: '100vh', 
      position: 'relative',
      background: `
        linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%),
        radial-gradient(circle at 10% 20%, rgba(52, 152, 219, 0.05) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(155, 89, 182, 0.05) 0%, transparent 50%),
        radial-gradient(circle at 40% 40%, rgba(231, 76, 60, 0.03) 0%, transparent 50%)
      `,
      color: '#ffffff',
      overflow: 'hidden',      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 25% 25%, rgba(52, 152, 219, 0.02) 0%, transparent 1px),
          radial-gradient(circle at 75% 25%, rgba(155, 89, 182, 0.02) 0%, transparent 1px),
          radial-gradient(circle at 25% 75%, rgba(231, 76, 60, 0.02) 0%, transparent 1px),
          radial-gradient(circle at 75% 75%, rgba(52, 152, 219, 0.02) 0%, transparent 1px),
          radial-gradient(circle at 50% 50%, rgba(155, 89, 182, 0.02) 0%, transparent 1px)
        `,
        animation: 'sparkle 12s linear infinite',
        zIndex: 0,
        pointerEvents: 'none',
        '@keyframes sparkle': {
          '0%, 100%': { opacity: 0.2 },
          '50%': { opacity: 0.6 }
        }
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(45deg, transparent 48%, rgba(52, 152, 219, 0.01) 49%, rgba(52, 152, 219, 0.02) 50%, rgba(52, 152, 219, 0.01) 51%, transparent 52%)',
        backgroundSize: '100px 100px',
        animation: 'drift 25s linear infinite',
        zIndex: 0,
        pointerEvents: 'none',
        '@keyframes drift': {
          '0%': { transform: 'translateX(-100px) translateY(-100px)' },
          '100%': { transform: 'translateX(100px) translateY(100px)' }
        }
      }
    }}>
      {/* Mobile App Bar */}
      {isMobile && (        <AppBar 
          position="fixed" 
          sx={{ 
            zIndex: theme.zIndex.drawer + 1,
            background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 50%, rgba(15, 52, 96, 0.95) 100%)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(52, 152, 219, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(52, 152, 219, 0.1) 50%, transparent 100%)',
              opacity: 0.3,
              zIndex: -1
            }
          }}
        >
          <Toolbar>            <IconButton
              sx={{ 
                mr: 2, 
                color: '#3498db',
                background: 'rgba(52, 152, 219, 0.1)',
                '&:hover': {
                  background: 'rgba(52, 152, 219, 0.2)',
                  transform: 'scale(1.05)',
                },
                transition: 'all 0.3s ease'
              }}
              edge="start"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
              <SparklesIcon sx={{ 
                mr: 1, 
                color: '#3498db',
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%': { opacity: 0.7 },
                  '50%': { opacity: 1 },
                  '100%': { opacity: 0.7 }
                }
              }} />
              <Typography variant="h6" noWrap sx={{ 
                background: 'linear-gradient(45deg, #3498db 0%, #9b59b6 50%, #e74c3c 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontWeight: 700,
                textShadow: '0 0 30px rgba(52, 152, 219, 0.5)'
              }}>
                Hydroponics AI Assistant
              </Typography>
            </Box>
            <Chip 
              label="Active"
              size="small"
              sx={{
                background: 'linear-gradient(45deg, #4caf50, #8bc34a)',
                color: '#ffffff',
                fontWeight: 600,
                boxShadow: '0 4px 15px rgba(76, 175, 80, 0.3)',
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  left: 8,
                  animation: 'blink 1.5s infinite',
                  '@keyframes blink': {
                    '0%, 50%': { opacity: 1 },
                    '51%, 100%': { opacity: 0.3 }
                  }
                }
              }}
            />
          </Toolbar>
        </AppBar>
      )}{/* Sidebar */}      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sx={{
          width: 320,
          flexShrink: 0,
          zIndex: theme.zIndex.drawer,
          '& .MuiDrawer-paper': {
            width: 320,
            boxSizing: 'border-box',
            mt: isMobile ? 8 : 0,
            background: `
              linear-gradient(180deg, rgba(22, 33, 62, 0.95) 0%, rgba(26, 26, 46, 0.95) 100%),
              radial-gradient(circle at 50% 0%, rgba(52, 152, 219, 0.1) 0%, transparent 70%)
            `,
            backdropFilter: 'blur(20px)',
            borderRight: '1px solid rgba(52, 152, 219, 0.2)',
            color: '#ffffff',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '2px',
              height: '100%',
              background: 'linear-gradient(180deg, #3498db 0%, #9b59b6 50%, #e74c3c 100%)',
              opacity: 0.8,
              animation: 'slideUp 3s ease-in-out infinite',
              '@keyframes slideUp': {
                '0%': { transform: 'translateY(100%)' },
                '50%': { transform: 'translateY(-100%)' },
                '100%': { transform: 'translateY(100%)' }
              }
            }
          },
        }}
      >
        {/* Sidebar Header */}
        <Box sx={{ p: 3, borderBottom: '1px solid rgba(52, 152, 219, 0.2)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>            <Avatar 
              sx={{ 
                bgcolor: 'transparent', 
                mr: 2,
                background: 'linear-gradient(45deg, #3498db, #9b59b6)',
                boxShadow: '0 4px 20px rgba(52, 152, 219, 0.3)'
              }}
            >
              <SparklesIcon sx={{ color: '#ffffff' }} />
            </Avatar>
            <Box>              <Typography variant="h6" fontWeight="600" sx={{ 
                color: '#ffffff',
                background: 'linear-gradient(45deg, #3498db, #9b59b6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Hydroponics AI
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                Your Growing Assistant
              </Typography>
            </Box>
          </Box>
            <Button
            fullWidth
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={createNewConversation}            sx={{ 
              borderColor: 'rgba(52, 152, 219, 0.5)',
              color: '#3498db',
              background: 'rgba(52, 152, 219, 0.1)',
              backdropFilter: 'blur(10px)',
              '&:hover': {
                borderColor: '#3498db',
                background: 'rgba(52, 152, 219, 0.2)',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 20px rgba(52, 152, 219, 0.3)'
              },
              transition: 'all 0.3s ease'
            }}
          >
            New Chat
          </Button>
        </Box>        {/* Conversations */}
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
                  borderRadius: 2,                  color: '#ffffff',
                  '&:hover': {
                    bgcolor: 'rgba(52, 152, 219, 0.1)',
                  },
                  '&.Mui-selected': {
                    bgcolor: 'rgba(52, 152, 219, 0.2)',
                    borderLeft: '3px solid #3498db',
                    background: 'linear-gradient(90deg, rgba(52, 152, 219, 0.2) 0%, transparent 100%)',
                    '&:hover': {
                      bgcolor: 'rgba(52, 152, 219, 0.25)',
                    },
                    '& .MuiListItemIcon-root': {
                      color: '#3498db',
                    },
                  },
                }}
              >                <ListItemIcon>
                  <MessageSquareIcon sx={{ color: 'rgba(255, 255, 255, 0.8)' }} />
                </ListItemIcon>
                <ListItemText
                  primary={conversation.title || 'New Chat'}
                  secondary={`${conversation.messageCount} messages`}
                  primaryTypographyProps={{ color: '#ffffff' }}
                  secondaryTypographyProps={{
                    color: 'rgba(255, 255, 255, 0.6)'
                  }}
                />
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteConversation(conversation.id)
                  }}
                  sx={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    '&:hover': {
                      color: '#ffffff',
                      bgcolor: 'rgba(255, 255, 255, 0.1)'
                    }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemButton>
            ))}
          </List>
        </Box>        {/* Sidebar Footer */}
        <Box sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <Stack spacing={1}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FileTextIcon />}
              onClick={() => setShowDocuments(true)}
              sx={{ 
                justifyContent: 'flex-start',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  background: 'rgba(255, 255, 255, 0.05)',
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <span>Knowledge Base</span>
                <Badge badgeContent={documents.length} sx={{ 
                  ml: 'auto',
                  '& .MuiBadge-badge': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: '#ffffff'
                  }
                }} />
              </Box>
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => setShowSettings(true)}
              sx={{ 
                justifyContent: 'flex-start',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  background: 'rgba(255, 255, 255, 0.05)',
                }
              }}
            >
              Settings
            </Button>
          </Stack>
          
          {/* Branding */}
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography 
              variant="caption" 
              sx={{ 
                fontSize: '0.7rem',
                color: 'rgba(255, 255, 255, 0.4)',
                fontWeight: 300,
                letterSpacing: 0.5
              }}
            >
              Powered by{' '}
              <Typography 
                component="span" 
                variant="caption" 
                sx={{ 
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  background: 'linear-gradient(135deg, #ffffff 0%, #cccccc 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                Aviratha Digital Labs
              </Typography>
            </Typography>
          </Box>
        </Box>
      </Drawer>      {/* Main Chat Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          mt: isMobile ? 8 : 0,
          background: `
            linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%),
            radial-gradient(circle at 20% 50%, rgba(52, 152, 219, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(155, 89, 182, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(231, 76, 60, 0.05) 0%, transparent 50%)
          `,
          backgroundSize: '100% 100%, 800px 800px, 600px 600px, 400px 400px',
          backgroundPosition: 'center, 0% 50%, 100% 20%, 40% 80%',
          position: 'relative',
          zIndex: 1,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(45deg, transparent 49%, rgba(52, 152, 219, 0.03) 50%, transparent 51%)',
            backgroundSize: '60px 60px',
            opacity: 0.3,
            animation: 'float 20s ease-in-out infinite',
            zIndex: -1,
            '@keyframes float': {
              '0%, 100%': { transform: 'translateY(0px)' },
              '50%': { transform: 'translateY(-10px)' }
            }
          }
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
              >                <Avatar                  sx={{
                    width: 120,
                    height: 120,
                    mb: 3,
                    background: 'linear-gradient(45deg, #3498db, #9b59b6)',
                    boxShadow: '0 8px 32px rgba(52, 152, 219, 0.3)',
                  }}
                >
                  <SparklesIcon sx={{ fontSize: 60, color: '#ffffff' }} />
                </Avatar>                <Typography 
                  variant="h4" 
                  gutterBottom 
                  fontWeight="300"
                  sx={{
                    background: 'linear-gradient(45deg, #3498db 0%, #9b59b6 50%, #e74c3c 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    mb: 2,
                    fontWeight: 600
                  }}
                >
                  Welcome to Hydroponics AI
                </Typography>
                <Typography variant="h6" sx={{ mb: 4, maxWidth: 600, color: 'rgba(255, 255, 255, 0.9)', fontWeight: 300 }}>
                  Your intelligent assistant for hydroponic growing. Ask me anything about nutrient solutions, 
                  plant care, system setup, or troubleshooting!
                </Typography>                <Box 
                  sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                    gap: 2,
                    maxWidth: 600 
                  }}
                >                  <Card 
                    sx={{ 
                      height: '100%', 
                      cursor: 'pointer',
                      background: 'rgba(52, 152, 219, 0.1)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(52, 152, 219, 0.2)',
                      borderRadius: 3,
                      '&:hover': {
                        background: 'rgba(52, 152, 219, 0.2)',
                        border: '1px solid rgba(52, 152, 219, 0.4)',
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 32px rgba(52, 152, 219, 0.3)'
                      },
                      transition: 'all 0.3s ease'
                    }} 
                    onClick={() => setInputMessage('What nutrients does lettuce need?')}
                  >
                    <CardContent sx={{ textAlign: 'center' }}>
                      <ZapIcon sx={{ fontSize: 40, mb: 1, color: '#3498db' }} />
                      <Typography variant="h6" gutterBottom sx={{ color: '#ffffff', fontWeight: 500 }}>
                        Nutrients
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                        Learn about optimal nutrient solutions
                      </Typography>
                    </CardContent>
                  </Card>                  <Card 
                    sx={{ 
                      height: '100%', 
                      cursor: 'pointer',
                      background: 'rgba(155, 89, 182, 0.1)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(155, 89, 182, 0.2)',
                      borderRadius: 3,
                      '&:hover': {
                        background: 'rgba(155, 89, 182, 0.2)',
                        border: '1px solid rgba(155, 89, 182, 0.4)',
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 32px rgba(155, 89, 182, 0.3)'
                      },
                      transition: 'all 0.3s ease'
                    }} 
                    onClick={() => setInputMessage('How do I set up a DWC system?')}
                  >
                    <CardContent sx={{ textAlign: 'center' }}>
                      <SettingsIcon sx={{ fontSize: 40, mb: 1, color: '#9b59b6' }} />
                      <Typography variant="h6" gutterBottom sx={{ color: '#ffffff', fontWeight: 500 }}>
                        Setup
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                        Get help with system configuration
                      </Typography>
                    </CardContent>
                  </Card>                  <Card 
                    sx={{ 
                      height: '100%', 
                      cursor: 'pointer',
                      background: 'rgba(231, 76, 60, 0.1)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(231, 76, 60, 0.2)',
                      borderRadius: 3,
                      '&:hover': {
                        background: 'rgba(231, 76, 60, 0.2)',
                        border: '1px solid rgba(231, 76, 60, 0.4)',
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 32px rgba(231, 76, 60, 0.3)'
                      },
                      transition: 'all 0.3s ease'
                    }} 
                    onClick={() => setInputMessage('My plants have yellow leaves, what should I do?')}
                  >
                    <CardContent sx={{ textAlign: 'center' }}>
                      <StarIcon sx={{ fontSize: 40, mb: 1, color: '#e74c3c' }} />
                      <Typography variant="h6" gutterBottom sx={{ color: '#ffffff', fontWeight: 500 }}>
                        Troubleshooting
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
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
                    >                      <Avatar                        sx={{
                          bgcolor: message.role === 'user' 
                            ? 'transparent' 
                            : 'transparent',
                          background: message.role === 'user'
                            ? 'linear-gradient(45deg, #3498db, #9b59b6)'
                            : 'linear-gradient(45deg, #34495e, #2c3e50)',
                          boxShadow: message.role === 'user'
                            ? '0 4px 20px rgba(52, 152, 219, 0.3)'
                            : '0 4px 20px rgba(52, 73, 94, 0.3)',
                        }}
                      >
                        {message.role === 'user' ? <UserIcon sx={{ color: '#ffffff' }} /> : <BotIcon sx={{ color: '#ffffff' }} />}
                      </Avatar>                      <Card                        sx={{
                          maxWidth: '70%',
                          background: message.role === 'user'
                            ? 'rgba(52, 152, 219, 0.15)'
                            : 'rgba(255, 255, 255, 0.08)',
                          backdropFilter: 'blur(20px)',
                          border: message.role === 'user'
                            ? '1px solid rgba(52, 152, 219, 0.3)'
                            : '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: 3,
                          color: '#ffffff',
                          boxShadow: message.role === 'user'
                            ? '0 4px 20px rgba(52, 152, 219, 0.2)'
                            : '0 4px 20px rgba(0, 0, 0, 0.2)',
                        }}
                      ><CardContent>
                          <MarkdownRenderer 
                            content={message.content} 
                            isUserMessage={message.role === 'user'}
                          />
                            {message.metadata?.contextUsed && (
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.15)' }}>
                              <Chip
                                icon={<FileTextIcon />}
                                label={message.metadata.fromKnowledgeBase 
                                  ? `From Hydroponics Knowledge Base (${message.metadata.sourceCategories})`
                                  : `Used ${message.metadata.sourcesCount} knowledge sources`}
                                size="small"
                                variant="outlined"
                                sx={{ 
                                  color: 'rgba(255, 255, 255, 0.8)',
                                  borderColor: 'rgba(255, 255, 255, 0.2)',
                                  backgroundColor: message.metadata.fromKnowledgeBase ? 'rgba(76, 175, 80, 0.1)' : 'transparent'
                                }}
                              />
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Box>
                  </Fade>
                ))}                  {isLoading && (
                  <Zoom in>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>                      <Avatar                        sx={{
                          background: 'linear-gradient(45deg, #34495e, #2c3e50)',
                          border: '1px solid rgba(52, 152, 219, 0.3)',
                          boxShadow: '0 4px 20px rgba(52, 73, 94, 0.3)',
                          animation: 'breathe 2s ease-in-out infinite',
                          '@keyframes breathe': {
                            '0%, 100%': { transform: 'scale(1)' },
                            '50%': { transform: 'scale(1.05)' }
                          }
                        }}
                      >
                        <BotIcon sx={{ color: '#ffffff' }} />
                      </Avatar>                      <Card sx={{
                        background: `
                          rgba(255, 255, 255, 0.08),
                          linear-gradient(45deg, rgba(52, 152, 219, 0.1), rgba(155, 89, 182, 0.1))
                        `,
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(52, 152, 219, 0.2)',
                        borderRadius: 3,
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                        position: 'relative',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'linear-gradient(45deg, transparent 30%, rgba(52, 152, 219, 0.1) 50%, transparent 70%)',
                          animation: 'shimmer 2s ease-in-out infinite',
                          '@keyframes shimmer': {
                            '0%': { transform: 'translateX(-100%)' },
                            '100%': { transform: 'translateX(100%)' }
                          }
                        }
                      }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ position: 'relative' }}>
                              <CircularProgress 
                                size={20} 
                                sx={{ 
                                  color: '#3498db',
                                  '& .MuiCircularProgress-circle': {
                                    strokeLinecap: 'round',
                                  }
                                }} 
                              />
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  border: '2px solid rgba(52, 152, 219, 0.2)',
                                }}
                              />
                            </Box>
                            <Typography variant="body2" sx={{ 
                              color: '#ffffff',
                              fontWeight: 500,
                              animation: 'typing 1.5s ease-in-out infinite',
                              '@keyframes typing': {
                                '0%, 60%': { opacity: 1 },
                                '61%, 100%': { opacity: 0.6 }
                              }
                            }}>
                              AI is thinking...
                            </Typography>
                            <Box sx={{ 
                              display: 'flex', 
                              gap: 0.5,
                              ml: 1
                            }}>
                              {[0, 1, 2].map((i) => (
                                <Box
                                  key={i}
                                  sx={{
                                    width: 4,
                                    height: 4,
                                    borderRadius: '50%',
                                    backgroundColor: '#3498db',
                                    animation: `bounce 1.4s ease-in-out infinite ${i * 0.2}s`,
                                    '@keyframes bounce': {
                                      '0%, 80%, 100%': { transform: 'scale(0.8)', opacity: 0.5 },
                                      '40%': { transform: 'scale(1.2)', opacity: 1 }
                                    }
                                  }}
                                />
                              ))}
                            </Box>
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
        </Box>        {/* Input Area */}
        <Paper 
          elevation={0}          sx={{ 
            p: 3, 
            borderRadius: 0,
            background: `
              linear-gradient(135deg, rgba(22, 33, 62, 0.95) 0%, rgba(26, 26, 46, 0.95) 100%),
              radial-gradient(circle at 50% 50%, rgba(52, 152, 219, 0.1) 0%, transparent 50%)
            `,
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(52, 152, 219, 0.3)',
            boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.3)',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '1px',
              background: 'linear-gradient(90deg, transparent 0%, #3498db 20%, #9b59b6 50%, #e74c3c 80%, transparent 100%)',
              animation: 'shimmer 3s ease-in-out infinite',
              '@keyframes shimmer': {
                '0%': { opacity: 0.3 },
                '50%': { opacity: 1 },
                '100%': { opacity: 0.3 }
              }
            }
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
                variant="outlined"                sx={{                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    background: `
                      rgba(255, 255, 255, 0.08),
                      linear-gradient(45deg, rgba(52, 152, 219, 0.05), rgba(155, 89, 182, 0.05))
                    `,
                    backdropFilter: 'blur(15px)',
                    color: '#ffffff',
                    border: '1px solid rgba(52, 152, 219, 0.2)',
                    transition: 'all 0.3s ease',
                    '& fieldset': {
                      borderColor: 'rgba(52, 152, 219, 0.2)',
                    },
                    '&:hover': {
                      background: `
                        rgba(255, 255, 255, 0.12),
                        linear-gradient(45deg, rgba(52, 152, 219, 0.08), rgba(155, 89, 182, 0.08))
                      `,
                      transform: 'translateY(-1px)',
                      boxShadow: '0 8px 25px rgba(52, 152, 219, 0.2)',
                      '& fieldset': {
                        borderColor: 'rgba(52, 152, 219, 0.4)',
                      }
                    },
                    '&.Mui-focused': {
                      background: `
                        rgba(255, 255, 255, 0.15),
                        linear-gradient(45deg, rgba(52, 152, 219, 0.1), rgba(155, 89, 182, 0.1))
                      `,
                      transform: 'translateY(-2px)',
                      boxShadow: '0 12px 35px rgba(52, 152, 219, 0.3)',
                      '& fieldset': {
                        borderColor: 'rgba(52, 152, 219, 0.6)',
                      }
                    },
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: 'rgba(255, 255, 255, 0.6)',
                    opacity: 1,
                  },
                }}
                InputProps={{
                  endAdornment: inputMessage.length > 0 && (
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                      {inputMessage.length}/4000
                    </Typography>
                  ),
                }}
              />
                <Tooltip title="Send message">
                <Fab
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading}                  sx={{
                    background: !inputMessage.trim() 
                      ? 'rgba(255, 255, 255, 0.08)' 
                      : 'linear-gradient(45deg, #3498db, #9b59b6)',
                    color: '#ffffff',
                    border: '1px solid rgba(52, 152, 219, 0.3)',
                    boxShadow: !inputMessage.trim() 
                      ? 'none' 
                      : '0 8px 25px rgba(52, 152, 219, 0.4)',
                    '&:hover': {
                      background: !inputMessage.trim()
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'linear-gradient(45deg, #2980b9, #8e44ad)',
                      transform: !inputMessage.trim() ? 'none' : 'scale(1.05) translateY(-2px)',
                      boxShadow: !inputMessage.trim() 
                        ? 'none' 
                        : '0 12px 35px rgba(52, 152, 219, 0.5)',
                    },
                    '&:disabled': {
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'rgba(255, 255, 255, 0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                    },
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: '50%',
                      background: inputMessage.trim() 
                        ? 'linear-gradient(45deg, rgba(52, 152, 219, 0.3), rgba(155, 89, 182, 0.3))'
                        : 'none',
                      opacity: 0,
                      animation: inputMessage.trim() ? 'pulse 2s infinite' : 'none',
                      '@keyframes pulse': {
                        '0%': { opacity: 0, transform: 'scale(1)' },
                        '50%': { opacity: 0.5, transform: 'scale(1.1)' },
                        '100%': { opacity: 0, transform: 'scale(1.2)' }
                      }
                    }
                  }}
                >
                  {isLoading ? (
                    <CircularProgress 
                      size={24} 
                      sx={{ 
                        color: 'rgba(255, 255, 255, 0.8)',
                        '& .MuiCircularProgress-circle': {
                          animation: 'loading 1.4s ease-in-out infinite both',
                          '@keyframes loading': {
                            '0%': { strokeDasharray: '1px, 200px', strokeDashoffset: 0 },
                            '50%': { strokeDasharray: '100px, 200px', strokeDashoffset: '-15px' },
                            '100%': { strokeDasharray: '100px, 200px', strokeDashoffset: '-125px' }
                          }
                        }
                      }} 
                    />
                  ) : (
                    <SendIcon sx={{ 
                      transform: inputMessage.trim() ? 'rotate(-45deg)' : 'none',
                      transition: 'transform 0.3s ease'
                    }} />
                  )}
                </Fab>
              </Tooltip>
            </Box>
          </Container>
        </Paper>
      </Box>      {/* Settings Dialog */}      <Dialog 
        open={showSettings} 
        onClose={() => setShowSettings(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            background: `
              linear-gradient(145deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%),
              radial-gradient(circle at 50% 0%, rgba(52, 152, 219, 0.1) 0%, transparent 70%)
            `,
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(52, 152, 219, 0.3)',
            borderRadius: 3,
            color: '#ffffff',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: 'linear-gradient(90deg, #3498db 0%, #9b59b6 50%, #e74c3c 100%)',
              borderRadius: '3px 3px 0 0'
            }
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SettingsIcon sx={{ color: '#ffffff' }} />
            <Typography variant="h6" sx={{ color: '#ffffff' }}>AI Configuration</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Provider</InputLabel>
              <Select
                value={llmConfig.provider}
                label="Provider"
                onChange={(e) => setLLMConfig(prev => ({ ...prev, provider: e.target.value as any }))}
                sx={{
                  color: '#ffffff',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                  },
                }}                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: 'rgba(45, 45, 45, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        '& .MuiMenuItem-root': {
                          color: '#ffffff',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          },
                        },
                      },
                    },
                  }}
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
              sx={{
                '& .MuiInputLabel-root': {
                  color: 'rgba(255, 255, 255, 0.7)',
                },
                '& .MuiOutlinedInput-root': {
                  color: '#ffffff',
                  '& fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: 'rgba(255, 255, 255, 0.5)',
                  },
                },
              }}
            />
            
            <Box>
              <Typography gutterBottom sx={{ color: '#ffffff' }}>Temperature: {llmConfig.temperature}</Typography>
              <Slider
                value={llmConfig.temperature}
                onChange={(_, value) => setLLMConfig(prev => ({ ...prev, temperature: value as number }))}
                step={0.1}
                marks
                min={0}
                max={2}
                valueLabelDisplay="auto"
                sx={{
                  color: 'rgba(255, 255, 255, 0.8)',
                  '& .MuiSlider-thumb': {
                    backgroundColor: '#ffffff',
                  },
                  '& .MuiSlider-track': {
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  },
                  '& .MuiSlider-rail': {
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  },
                }}
              />
            </Box>
            
            <FormControlLabel
              control={
                <Switch
                  checked={useRAG}
                  onChange={(e) => setUseRAG(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#ffffff',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: 'rgba(255, 255, 255, 0.5)',
                    },
                    '& .MuiSwitch-track': {
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    },
                  }}
                />
              }
              label={<Typography sx={{ color: '#ffffff' }}>Enable RAG (Knowledge Base)</Typography>}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)} sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Close</Button>
        </DialogActions>
      </Dialog>      {/* Documents Dialog */}      <Dialog 
        open={showDocuments} 
        onClose={() => setShowDocuments(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            background: `
              linear-gradient(145deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%),
              radial-gradient(circle at 50% 0%, rgba(52, 152, 219, 0.1) 0%, transparent 70%)
            `,
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(52, 152, 219, 0.3)',
            borderRadius: 3,
            color: '#ffffff',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: 'linear-gradient(90deg, #3498db 0%, #9b59b6 50%, #e74c3c 100%)',
              borderRadius: '3px 3px 0 0'
            }
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FileTextIcon sx={{ color: '#ffffff' }} />
              <Typography variant="h6" sx={{ color: '#ffffff' }}>Knowledge Base ({documents.length})</Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  background: 'rgba(255, 255, 255, 0.05)',
                }
              }}
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </Button>
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
          />          {deleteMessage && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ 
                color: deleteMessage.includes('success') ? '#4caf50' : '#f44336'
              }}>
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
            {documents.map((doc) => (              <Card 
                key={doc.id}
                sx={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.08)',
                  }
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    {doc.fileType === 'pdf' && <PdfIcon sx={{ color: '#f44336' }} />}
                    {doc.fileType === 'txt' && <TxtIcon sx={{ color: '#2196f3' }} />}
                    {(doc.fileType === 'doc' || doc.fileType === 'docx') && <DocIcon sx={{ color: '#2196f3' }} />}
                    <Typography variant="subtitle2" noWrap sx={{ flexGrow: 1, color: '#ffffff' }}>
                      {doc.title}
                    </Typography>
                    <Tooltip title="Delete document">
                      <IconButton 
                        size="small" 
                        onClick={() => handleDeleteDocument(doc.id, doc.fileName)}
                        sx={{
                          color: 'rgba(255, 255, 255, 0.6)',
                          '&:hover': {
                            color: '#f44336',
                            background: 'rgba(244, 67, 54, 0.1)'
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                    {formatFileSize(doc.fileSize)}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
          {documents.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>              <FileTextIcon sx={{ fontSize: 48, color: 'rgba(255, 255, 255, 0.4)', mb: 2 }} />
              <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                No documents uploaded yet
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                Upload PDF, TXT, DOC, or MD files to enhance AI responses
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDocuments(false)} sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
