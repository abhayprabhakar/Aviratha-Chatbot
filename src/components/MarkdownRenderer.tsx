'use client'

import React, { useMemo, memo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import {
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link,
  Divider,
  Button,
  CircularProgress,
  useTheme
} from '@mui/material'
import { Summarize, ExpandMore } from '@mui/icons-material'

interface MarkdownRendererProps {
  content: string
  isUserMessage?: boolean
  isAnimating?: boolean
  messageId?: string
  conversationId?: string
}

// Move components creation outside to prevent recreation on every render
const createMarkdownComponents = (isUserMessage: boolean, theme: any) => ({
  h1: ({ children }: any) => (
    <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mt: 2, mb: 1 }}>
      {children}
    </Typography>
  ),
  h2: ({ children }: any) => (
    <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mt: 2, mb: 1 }}>
      {children}
    </Typography>
  ),
  h3: ({ children }: any) => (
    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', mt: 1.5, mb: 1 }}>
      {children}
    </Typography>
  ),
  h4: ({ children }: any) => (
    <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 1.5, mb: 0.5 }}>
      {children}
    </Typography>
  ),
  h5: ({ children }: any) => (
    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', mt: 1, mb: 0.5 }}>
      {children}
    </Typography>
  ),
  h6: ({ children }: any) => (
    <Typography variant="body1" gutterBottom sx={{ fontWeight: 'bold', mt: 1, mb: 0.5 }}>
      {children}
    </Typography>
  ),
  p: ({ children }: any) => (
    <Typography variant="body1" paragraph sx={{ mb: 1 }}>
      {children}
    </Typography>
  ),
  ul: ({ children }: any) => (
    <Box component="ul" sx={{ pl: 2, mb: 2 }}>
      {children}
    </Box>
  ),
  ol: ({ children }: any) => (
    <Box component="ol" sx={{ pl: 2, mb: 2 }}>
      {children}
    </Box>
  ),
  li: ({ children }: any) => (
    <Typography component="li" variant="body1" sx={{ mb: 0.5 }}>
      {children}
    </Typography>
  ),
  code: ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '')
    const language = match ? match[1] : ''

    if (!inline && language) {
      return (
        <Paper 
          elevation={1}
          sx={{ 
            my: 2, 
            overflow: 'hidden',
            backgroundColor: isUserMessage ? 'rgba(255,255,255,0.08)' : '#f8f9fa'
          }}
        >
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              backgroundColor: isUserMessage ? 'rgba(255,255,255,0.08)' : '#f8f9fa',
              color: theme.palette.text.primary,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
            {...props}
          >
            <code>{String(children).replace(/\n$/, '')}</code>
          </Box>
        </Paper>
      )
    }

    return (
      <Typography
        component="code"
        sx={{
          backgroundColor: isUserMessage ? 'rgba(255,255,255,0.15)' : '#f1f3f4',
          color: isUserMessage ? 'inherit' : 'text.primary',
          px: 0.5,
          py: 0.25,
          borderRadius: 0.5,
          fontFamily: 'monospace',
          fontSize: '0.875em',
        }}
        {...props}
      >
        {children}
      </Typography>
    )
  },
  blockquote: ({ children }: any) => (
    <Paper
      elevation={0}
      sx={{
        borderLeft: 4,
        borderColor: isUserMessage ? 'rgba(255,255,255,0.6)' : '#8e9aaf',
        backgroundColor: isUserMessage ? 'rgba(255,255,255,0.08)' : '#f8f9fa',
        pl: 2,
        py: 1,
        my: 2,
        fontStyle: 'italic',
      }}
    >
      {children}
    </Paper>
  ),
  a: ({ href, children }: any) => (
    <Link 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      sx={{ 
        color: isUserMessage ? 'rgba(255,255,255,0.9)' : '#667eea',
        textDecoration: 'underline',
        '&:hover': {
          textDecoration: 'none',
          color: isUserMessage ? 'white' : '#5a6fd8',
        }
      }}
    >
      {children}
    </Link>
  ),
  table: ({ children }: any) => (
    <TableContainer component={Paper} sx={{ my: 2, maxWidth: '100%' }}>
      <Table size="small">
        {children}
      </Table>
    </TableContainer>
  ),
  thead: ({ children }: any) => <TableHead>{children}</TableHead>,
  tbody: ({ children }: any) => <TableBody>{children}</TableBody>,
  tr: ({ children }: any) => <TableRow>{children}</TableRow>,
  th: ({ children }: any) => (
    <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
      {children}
    </TableCell>
  ),
  td: ({ children }: any) => <TableCell>{children}</TableCell>,
  hr: () => <Divider sx={{ my: 2 }} />,
  strong: ({ children }: any) => (
    <Typography component="strong" sx={{ fontWeight: 'bold' }}>
      {children}
    </Typography>
  ),
  em: ({ children }: any) => (
    <Typography component="em" sx={{ fontStyle: 'italic' }}>
      {children}
    </Typography>
  ),
  del: ({ children }: any) => (
    <Typography component="del" sx={{ textDecoration: 'line-through' }}>
      {children}
    </Typography>
  ),
})

const MarkdownRenderer = memo(function MarkdownRenderer({ 
  content, 
  isUserMessage = false, 
  isAnimating = false,
  messageId,
  conversationId
}: MarkdownRendererProps) {
  const theme = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)

  // Memoize components to prevent recreation on every render
  const components = useMemo(() => 
    createMarkdownComponents(isUserMessage, theme), 
    [isUserMessage, theme.palette.mode]
  )

  // Only show summarize button for assistant messages that are complete and long enough
  const shouldShowSummarizeButton = useMemo(() => {
    return !isUserMessage && 
           !isAnimating && 
           content && 
           content.length > 300 && // Only show for longer messages
           !content.includes('I\'m specialized in hydroponics') // Don't show for rejection messages
  }, [isUserMessage, isAnimating, content])

  // Handle summarization
  const handleSummarize = async () => {
    if (!summary) {
      setIsLoading(true)
      try {
        const token = localStorage.getItem('sessionToken')
        const response = await fetch('/api/chat/summarize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            content,
            conversationId,
            messageId
          })
        })

        const data = await response.json()
        
        if (data.success) {
          setSummary(data.summary)
          setShowSummary(true)
        } else {
          console.error('Summarization failed:', data.error)
        }
      } catch (error) {
        console.error('Summarization error:', error)
      } finally {
        setIsLoading(false)
      }
    } else {
      // Toggle between summary and full content
      setShowSummary(!showSummary)
    }
  }

  // Memoize content processing
  const displayContent = useMemo(() => {
    if (showSummary && summary) {
      return summary
    }
    return content || '\u00A0'
  }, [content, summary, showSummary])

  // Memoize the full content for placeholder
  const fullContent = useMemo(() => content || '\u00A0', [content])

  return (
    <Box
      sx={{ 
        width: '100%',
        minHeight: isUserMessage ? '40px' : '100px',
        position: 'relative',
        opacity: 1,
        backgroundColor: isUserMessage ? 'inherit' : theme.palette.mode === 'dark' ? 'rgba(40, 40, 40, 0.95)' : 'rgba(245, 245, 245, 0.95)',
        borderRadius: '8px',
        boxShadow: isUserMessage ? 'none' : '0 1px 2px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease-in-out',
        '& > :first-of-type': { mt: 0 }, 
        '& > :last-child': { mb: 0 },
        padding: '8px',
        backdropFilter: !isUserMessage ? 'blur(5px)' : 'none',
        animation: isAnimating && !isUserMessage ? 
          `${theme.palette.mode === 'dark' ? 'pulseAnimationDark' : 'pulseAnimationLight'} 2s infinite ease-in-out` : 
          'none',
        '@keyframes pulseAnimationLight': {
          '0%': { boxShadow: '0 1px 2px rgba(0,0,0,0.1)' },
          '50%': { boxShadow: '0 1px 8px rgba(102, 126, 234, 0.3)' },
          '100%': { boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }
        },
        '@keyframes pulseAnimationDark': {
          '0%': { boxShadow: '0 1px 2px rgba(0,0,0,0.2)' },
          '50%': { boxShadow: '0 1px 8px rgba(132, 156, 224, 0.4)' },
          '100%': { boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }
        }
      }}
      className="message-container"
    >
      {!isUserMessage && (
        <Box 
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            visibility: 'hidden', 
            opacity: 0,
            pointerEvents: 'none',
            height: 'auto', 
            overflow: 'hidden',
            zIndex: -1,
            padding: '8px',
            width: '100%',
          }}
          aria-hidden="true"
          className="message-placeholder"
        >
          <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkBreaks]} 
            components={components}
          >
            {fullContent}
          </ReactMarkdown>
        </Box>
      )}
      
      <Box
        sx={{
          position: !isUserMessage ? 'relative' : 'static',
          width: '100%',
          height: '100%',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <Box sx={{ flexGrow: 1, width: '100%' }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={components}
          >
            {displayContent}
          </ReactMarkdown>
        </Box>
        
        {/* Summarize/Expand Button */}
        {shouldShowSummarizeButton && (
          <Box sx={{ mt: 1, alignSelf: 'flex-end' }}>
            <Button
              size="small"
              variant="outlined"
              onClick={handleSummarize}
              disabled={isLoading}
              startIcon={
                isLoading ? (
                  <CircularProgress size={16} />
                ) : showSummary ? (
                  <ExpandMore />
                ) : (
                  <Summarize />
                )
              }
              sx={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                minHeight: 'auto',
                borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                '&:hover': {
                  borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                }
              }}
            >
              {isLoading ? 'Summarizing...' : showSummary ? 'Show Full' : 'Summarize'}
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  )
})

export default MarkdownRenderer