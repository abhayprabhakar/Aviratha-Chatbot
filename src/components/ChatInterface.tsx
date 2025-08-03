'use client'
import NoSSR from './NoSSR'
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
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
  ListItem,
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
  Stack,
} from '@mui/material'
import Grid from '@mui/material/Grid';
import { debounce } from 'lodash' // You'll need to install lodash: npm install lodash @types/lodash

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
import { CameraAlt as CameraIcon, FileUpload as FileUploadIcon } from '@mui/icons-material'
import MarkdownRenderer from './MarkdownRenderer'
import AnimatedMessage from './AnimatedMessage'
import { Clear as ClearIcon } from '@mui/icons-material';

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

interface PlantIdentificationState {
  isIdentifying: boolean;
  error?: string;
}

interface UploadPreview {
  file: File;
  previewUrl: string;
}

const defaultLLMConfig: LLMConfig = {
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  temperature: 0.7,
  maxTokens: 2000
}

// Replace the existing MessageItem component with this updated version:
const MessageItem = memo(function MessageItem({ 
  message, 
  index, 
  typedMessages, 
  historyMessageIds, 
  handleMessageTypingComplete,
  theme,
  setCurrentSourceInfo,
  setSourceDialogOpen
}: {
  message: Message;
  index: number;
  typedMessages: Set<string>;
  historyMessageIds: Set<string>;
  handleMessageTypingComplete: (id: string) => void;
  theme: any;
  setCurrentSourceInfo: (info: any) => void;
  setSourceDialogOpen: (open: boolean) => void;
}) {
  return (
    <Fade in timeout={300} style={{ transitionDelay: `${index * 100}ms` }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
          alignItems: 'flex-start',
          gap: 2,
        }}
      >
        <Avatar                        
          sx={{
            bgcolor: message.role === 'user' ? 'primary.main' : 'secondary.main',
            background: message.role === 'user' 
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : 'linear-gradient(135deg, #a8a8a8 0%, #7b7b7b 100%)',
          }}
        >
          {message.role === 'user' ? <UserIcon /> : <BotIcon />}
        </Avatar>
        
        <Card                        
          sx={{
            maxWidth: '70%',
            background: message.role === 'user'
              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              : theme.palette.background.paper,
            color: message.role === 'user' ? 'white' : 'text.primary',
          }}
        >  
          <CardContent>
            {/* Display uploaded plant images if available */}
            {message.role === 'user' && message.metadata?.type === 'plant_upload' && message.metadata.uploadedImages && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mb: 2 }}>
                {message.metadata.uploadedImages.map((imagePath: string, i: number) => (
                  <Box 
                    key={i}
                    component="img"
                    src={imagePath}
                    alt="Uploaded plant"
                    sx={{
                      width: '100%',
                      maxHeight: 300,
                      objectFit: 'contain',
                      borderRadius: 2,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      mb: i < message.metadata.uploadedImages.length - 1 ? 1 : 0
                    }}
                  />
                ))}
              </Box>
            )}
            
            <AnimatedMessage
              content={message.content}
              isUserMessage={message.role === 'user'}
              isComplete={typedMessages.has(message.id)}
              isHistoryMessage={historyMessageIds.has(message.id)}
              onComplete={() => handleMessageTypingComplete(message.id)}
            />

            {/* Display image reference in assistant responses if relevant */}
            {message.role === 'assistant' && 
            message.metadata?.type === 'plant_identification' && 
            message.metadata.plantData?.uploadedImages && (
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', mb: 1 }}>
                  Analyzed plant image:
                </Typography>
                {message.metadata.plantData.uploadedImages.map((imagePath: string, i: number) => (
                  <Box 
                    key={i}
                    component="img"
                    src={imagePath}
                    alt="Identified plant"
                    sx={{
                      maxWidth: '80%',
                      maxHeight: 200,
                      objectFit: 'contain',
                      borderRadius: 2,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      opacity: 0.9,
                    }}
                  />
                ))}
              </Box>
            )}
            
            {message.metadata?.contextUsed && (
              <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Chip
                  icon={<FileTextIcon />}
                  label={message.metadata.fromKnowledgeBase 
                    ? `From Hydroponics Knowledge Base (${
                        message.metadata.sourceCategories 
                          ? message.metadata.sourceCategories.split(',')[0] + 
                            (message.metadata.sourceCategories.includes(',') ? ' & more' : '')
                          : 'general knowledge'
                      })`
                    : `Used ${message.metadata.sourcesCount || '?'} knowledge sources`
                  }
                  size="small"
                  color={message.metadata.fromKnowledgeBase ? "success" : "default"}
                  variant="outlined"
                  onClick={() => {
                    console.log("Knowledge source metadata:", message.metadata);
                    setCurrentSourceInfo(message.metadata);
                    setSourceDialogOpen(true);
                  }}
                  clickable
                  sx={{ 
                    color: message.role === 'user' ? 'white' : 'text.secondary',
                    borderColor: message.role === 'user' ? 'white' : 'divider',
                    cursor: 'pointer'
                  }}
                />
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Fade>
  )
})

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

  const [plantIdState, setPlantIdState] = useState<PlantIdentificationState>({
    isIdentifying: false
  })
  const [imagePreview, setImagePreview] = useState<UploadPreview | null>(null);
  const plantImageInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Add this to your state declarations
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [currentSourceInfo, setCurrentSourceInfo] = useState<any>(null);
  const [sending, setSending] = useState(false);  const [typedMessages, setTypedMessages] = useState<Set<string>>(new Set());
  // Track which messages were loaded from history (don't animate these)
  const [historyMessageIds, setHistoryMessageIds] = useState<Set<string>>(new Set())
  
  // Memoize the message completion handler
  const handleMessageTypingComplete = useCallback((messageId: string) => {
    setTypedMessages(prev => {
      const newSet = new Set(prev);
      newSet.add(messageId);
      return newSet;
    });
  }, []);

  // Memoize sorted messages to prevent re-sorting on every render
  const sortedMessages = useMemo(() => 
    messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [messages]
  )
  
  // Debounce the input change to reduce re-renders
  const debouncedSetInputMessage = useMemo(
    () => debounce((value: string) => {
      setInputMessage(value)
    }, 100),
    []
  )

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

  const exportConversation = () => {
    if (messages.length === 0) {
      alert('No messages to export');
      return;
    }

    // Create export data
    const exportData = {
      title: currentConversationId ? `Hydroponics Chat - ${new Date().toLocaleDateString()}` : 'Hydroponics Chat',
      exportDate: new Date().toISOString(),
      messageCount: messages.length,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt,
        hasPlantImage: msg.metadata?.type === 'plant_upload' || msg.metadata?.type === 'plant_identification'
      }))
    };

    // Convert to formatted text
    const exportText = `Hydroponics AI Chat Export
  Generated: ${new Date().toLocaleString()}
  Messages: ${messages.length}

  ${'-'.repeat(50)}

  ${messages.map(msg => {
      const timestamp = new Date(msg.createdAt).toLocaleString();
      const role = msg.role === 'user' ? 'You' : 'AI Assistant';
      const plantIndicator = msg.metadata?.type === 'plant_upload' || msg.metadata?.type === 'plant_identification' ? ' 🌱' : '';
      
      return `[${timestamp}] ${role}${plantIndicator}:\n${msg.content}\n`;
    }).join('\n')}

  ${'-'.repeat(50)}
  Exported from Hydroponics AI Assistant`;

    // Create and download file
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hydroponics-chat-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
    if (!token) return;
    try {
      const response = await fetch(`/api/conversations?id=${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        console.log("Loading conversation data:", data.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          metadata: msg.metadata
        })));
        
        // Mark ALL messages from loaded conversations as history (no animations)
        // This applies to both regular and plant.id messages from past conversations
        const historyIds = new Set<string>(
          data.messages.map((msg: any) => msg.id)
        );
        
        console.log(`Marking all ${historyIds.size} messages as history (no animation for past conversations)`);
        
        setHistoryMessageIds(historyIds);
        
        // Set all messages from past conversations as already typed
        setTypedMessages(prev => {
          const newSet = new Set(prev);
          data.messages.forEach((msg: any) => {
            newSet.add(msg.id);
          });
          return newSet;
        });
        
        setMessages(data.messages);
        setCurrentConversationId(conversationId);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
    }
  }

  // Update the sendMessage function to handle image uploads
  const sendMessage = async () => {
    // Don't send empty messages unless there's an image
    if ((!inputMessage.trim() && !imagePreview) || isLoading || !token) return;

    // Get user message (or use default if empty with image)
    const userMessage = inputMessage.trim() || (imagePreview ? "I've uploaded a plant image for identification and health assessment." : "");
    
    // Clear input field
    setInputMessage('');
    
    // Add temporary message to UI
    const tempMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMessage]);
    setIsLoading(true);
    
    // Store image preview before clearing it (in case we need to reference it in the try/catch)
    const currentImagePreview = imagePreview;
    
    // Clear image preview immediately after sending
    if (imagePreview) {
      removeImagePreview();
    }

    try {
      // If we had an image, upload it for plant identification
      if (currentImagePreview) {
        const formData = new FormData();
        
        // Add the file
        formData.append('files', currentImagePreview.file);
        
        // Add the user's message
        formData.append('userMessage', userMessage);
        
        // Add conversation ID if available
        if (currentConversationId) {
          formData.append('conversationId', currentConversationId);
        }
        
        // Upload and identify the plant
        const response = await fetch('/api/plant/identify', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        const data = await response.json();        if (data.success) {
          // Update conversation ID
          setCurrentConversationId(data.conversationId);
          
          // Instead of just reloading the conversation (which would mark everything as history),
          // We'll load it but keep track of the Plant.id message so it can animate
          const response = await fetch(`/api/conversations?id=${data.conversationId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          const convData = await response.json();
          
          if (convData.success) {
            // Find the plant identification message
            const plantMessage = convData.messages.find((msg: any) => 
              msg.metadata?.type === 'plant_identification'
            );
            
            // Set all messages
            setMessages(convData.messages);
            
            // Mark all messages EXCEPT the plant ID message as history
            if (plantMessage) {
              console.log('Ensuring Plant.id message will animate:', plantMessage.id);              setHistoryMessageIds(new Set(
                convData.messages
                  .filter((msg: any) => msg.id !== plantMessage.id)
                  .map((msg: any) => msg.id)
              ));
            } else {              // No plant message found, mark all as history
              setHistoryMessageIds(new Set(
                convData.messages.map((msg: any) => msg.id)
              ));
            }
          }
          
          // Still update the conversation list
          loadConversations(token);
        }else {
          console.error('Plant identification error:', data.error);
          // Show error in chat
          const errorId = (Date.now() + 1).toString();
          const errorMessage: Message = {
            id: errorId,
            role: 'assistant',
            content: `Sorry, I couldn't identify the plant. Error: ${data.error || 'Unknown error'}`,
            metadata: {
              type: 'plant_error'
            },
            createdAt: new Date().toISOString()
          };
            // Make sure this error message animates by NOT adding it to historyMessageIds
          setMessages(prev => [...prev, errorMessage]);
        }
      } else {
        // Regular chat message (no image)
        // Check if this is following a plant identification
        const hasRecentPlantIdentification = messages.some(
          msg => msg.metadata?.type === 'plant_identification' && 
          // Only consider recent messages (last 5)
          messages.indexOf(msg) > messages.length - 6
        );
        
        // If this is a plant follow-up question, use the specialized endpoint
        if (hasRecentPlantIdentification && currentConversationId) {
          const response = await fetch('/api/chat/plant-followup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              message: userMessage,
              conversationId: currentConversationId
            })
          });
          
          const data = await response.json();          if (data.success) {
            // Generate a unique ID for the message
            const messageId = (Date.now() + 1).toString();
            
            const assistantMessage: Message = {
              id: messageId,
              role: 'assistant',
              content: data.response,
              metadata: {
                type: 'plant_followup',
                timestamp: new Date().toISOString()
              },
              createdAt: new Date().toISOString()
            };
            
            // Add plant followup message without marking it as history to ensure animation
            setMessages(prev => [...prev.slice(0, -1), tempMessage, assistantMessage]);
            return;
          }
        }
        
        // Use regular chat endpoint
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
            useRAG: true
          })
        });

        const data = await response.json();
        if (data.success) {          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.response,
            metadata: {
              contextUsed: data.contextUsed,
              sourcesCount: data.sourcesCount,
              sourceCategories: data.sourceCategories,
              fromKnowledgeBase: data.fromKnowledgeBase
            },
            createdAt: new Date().toISOString()
          };
            // Add new messages without marking them as history to ensure they animate
          console.log('Adding new assistant message with ID:', assistantMessage.id, '- Not marking as history');
          setMessages(prev => [...prev.slice(0, -1), tempMessage, assistantMessage]);
          setCurrentConversationId(data.conversationId);
          loadConversations(token);
        }
      }
    } catch (error) {
      console.error('Message send error:', error);
    } finally {
      setIsLoading(false);
    }
  };
  const createNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    // Reset history message tracking for new conversations
    setHistoryMessageIds(new Set());
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

  const handlePlantImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    // Only take the first file (we're limiting to one image per message)
    const file = event.target.files[0];
    
    // Create a preview URL for the image
    const previewUrl = URL.createObjectURL(file);
    
    // Set the preview in state
    setImagePreview({
      file,
      previewUrl
    });
    
    // Reset the file input for future uploads
    if (plantImageInputRef.current) {
      plantImageInputRef.current.value = '';
    }
  };

  // Add this new function to remove the image preview
  const removeImagePreview = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview.previewUrl);
      setImagePreview(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
        <NoSSR fallback={
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          backgroundColor: '#0a0a0a',
          color: '#ffffff'
        }}
      >
        <CircularProgress />
      </Box>
    }>
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
              startIcon={<FileUploadIcon />}
              onClick={exportConversation}
              disabled={messages.length === 0}
              sx={{ justifyContent: 'flex-start' }}
            >
              Export Chat
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
          
          {/* Branding */}
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ 
                fontSize: '0.7rem',
                opacity: 0.7,
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
                  color: 'primary.main',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
                {sortedMessages.map((message, index) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    index={index}
                    typedMessages={typedMessages}
                    historyMessageIds={historyMessageIds}
                    handleMessageTypingComplete={handleMessageTypingComplete}
                    theme={theme}
                    setCurrentSourceInfo={setCurrentSourceInfo}
                    setSourceDialogOpen={setSourceDialogOpen}
                  />
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

        <input
          type="file"
          accept="image/*"
          multiple
          ref={plantImageInputRef}
          onChange={handlePlantImageUpload}
          style={{ display: 'none' }}
        />

        {/* Input Area */}
        <Paper 
          elevation={8}          
          sx={{ 
            p: 3, 
            borderRadius: 0,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
            backdropFilter: 'blur(10px)',
            borderTop: 1,
            borderColor: 'divider'
          }}
        >
          <Container maxWidth="md">
            {/* Add image preview above the input box */}
            {imagePreview && (
              <Box sx={{ 
                mb: 2, 
                position: 'relative',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <Paper 
                  elevation={3} 
                  sx={{ 
                    p: 1, 
                    borderRadius: 2,
                    width: 'fit-content',
                    maxWidth: '100%',
                    position: 'relative'
                  }}
                >
                  <IconButton 
                    size="small"
                    onClick={removeImagePreview}
                    sx={{ 
                      position: 'absolute', 
                      top: -10, 
                      right: -10, 
                      bgcolor: 'background.paper',
                      boxShadow: 1,
                      '&:hover': {
                        bgcolor: 'error.light',
                        color: 'white'
                      }
                    }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                  <Box 
                    component="img"
                    src={imagePreview.previewUrl}
                    alt="Plant to identify"
                    sx={{
                      maxWidth: '100%',
                      maxHeight: 150,
                      borderRadius: 1,
                      display: 'block'
                    }}
                  />
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      display: 'block', 
                      textAlign: 'center',
                      mt: 0.5,
                      color: 'text.secondary'
                    }}
                  >
                    Plant image ready to identify
                  </Typography>
                </Paper>
              </Box>
            )}

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
                placeholder={imagePreview ? "Add a message about your plant (optional)..." : "Ask me about hydroponics..."}
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

              <Tooltip title="Upload plant image for identification">
                <Fab
                  color="primary"
                  onClick={() => plantImageInputRef.current?.click()}
                  disabled={isLoading || !!imagePreview}
                  sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                      transform: 'scale(1.05)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  <CameraIcon />
                </Fab>
              </Tooltip>
              
              <Tooltip title={imagePreview ? "Send image for identification" : "Send message"}>
                <Fab
                  color="primary"
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() && !imagePreview || isLoading}
                  sx={{
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

      {/* Source Info Dialog */}
      <Dialog
        open={sourceDialogOpen}
        onClose={() => setSourceDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FileTextIcon />
            <Typography variant="h6">Knowledge Source Details</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {currentSourceInfo && (
            <Stack spacing={3} sx={{ mt: 1 }}>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Source Information
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="body2">
                        <strong>Source Type:</strong> {currentSourceInfo.fromKnowledgeBase 
                          ? "Hydroponics Knowledge Base" 
                          : "User Documents"}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">
                        <strong>Number of Sources:</strong> {currentSourceInfo.sourcesCount || "Unknown"}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">
                        <strong>Categories:</strong>{" "}
                        {currentSourceInfo.sourceCategories
                          ? currentSourceInfo.sourceCategories.split(', ').map((cat: string, index: number) => (
                              <Chip 
                                key={`cat-${index}`}
                                label={cat} 
                                size="small" 
                                color="success" 
                                variant="outlined"
                                sx={{ mr: 0.5, mt: 0.5 }} 
                              />
                            ))
                          : "General Knowledge"}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Box>
              
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  How Knowledge Base Works
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  The AI assistant combines information from relevant knowledge sources to provide accurate answers.
                  When you ask a question, our system:
                </Typography>
                <List dense sx={{ listStyleType: 'decimal', pl: 4 }}>
                  <ListItem sx={{ display: 'list-item' }}>
                    <Typography variant="body2">Searches the knowledge base for relevant information</Typography>
                  </ListItem>
                  <ListItem sx={{ display: 'list-item' }}>
                    <Typography variant="body2">Retrieves the most relevant sections from documents</Typography>
                  </ListItem>
                  <ListItem sx={{ display: 'list-item' }}>
                    <Typography variant="body2">Provides answers based on this knowledge</Typography>
                  </ListItem>
                </List>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSourceDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  </NoSSR>
  )
}
