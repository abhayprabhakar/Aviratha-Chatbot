'use client'

import React from 'react'
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
  useTheme
} from '@mui/material'

interface MarkdownRendererProps {
  content: string
  isUserMessage?: boolean
}

export default function MarkdownRenderer({ content, isUserMessage = false }: MarkdownRendererProps) {
  const theme = useTheme()

  const components = {
    // Headings
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

    // Paragraphs
    p: ({ children }: any) => (
      <Typography variant="body1" paragraph sx={{ mb: 1 }}>
        {children}
      </Typography>
    ),

    // Lists
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

    // Code blocks
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '')
      const language = match ? match[1] : ''

      if (!inline && language) {
        return (
          <Paper 
            elevation={1}            sx={{ 
              my: 2, 
              overflow: 'hidden',
              backgroundColor: isUserMessage ? 'rgba(255,255,255,0.08)' : '#f8f9fa'
            }}
          >
            <Box
              component="pre"              sx={{
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
          component="code"          sx={{
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
    },    // Blockquotes
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
    ),    // Links
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

    // Tables
    table: ({ children }: any) => (
      <TableContainer component={Paper} sx={{ my: 2, maxWidth: '100%' }}>
        <Table size="small">
          {children}
        </Table>
      </TableContainer>
    ),
    thead: ({ children }: any) => <TableHead>{children}</TableHead>,
    tbody: ({ children }: any) => <TableBody>{children}</TableBody>,
    tr: ({ children }: any) => <TableRow>{children}</TableRow>,    th: ({ children }: any) => (
      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f8f9fa' }}>
        {children}
      </TableCell>
    ),
    td: ({ children }: any) => <TableCell>{children}</TableCell>,

    // Horizontal rule
    hr: () => <Divider sx={{ my: 2 }} />,

    // Strong/Bold
    strong: ({ children }: any) => (
      <Typography component="strong" sx={{ fontWeight: 'bold' }}>
        {children}
      </Typography>
    ),

    // Emphasis/Italic
    em: ({ children }: any) => (
      <Typography component="em" sx={{ fontStyle: 'italic' }}>
        {children}
      </Typography>
    ),

    // Delete/Strikethrough
    del: ({ children }: any) => (
      <Typography component="del" sx={{ textDecoration: 'line-through' }}>
        {children}
      </Typography>
    ),
  }

  return (
    <Box sx={{ width: '100%', '& > :first-of-type': { mt: 0 }, '& > :last-child': { mb: 0 } }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </Box>
  )
}
