# Copilot Instructions for RAG Chatbot

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

This is a Next.js TypeScript project for a RAG (Retrieval-Augmented Generation) chatbot with the following key features:

## Project Architecture
- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS, and App Router
- **Backend**: Next.js API routes with edge runtime support
- **Database**: Prisma ORM with SQLite for development (PostgreSQL for production)
- **Vector Storage**: Pinecone or local vector embeddings
- **File Processing**: Support for PDF, TXT, DOCX, and other document formats

## Key Features
1. **Multi-LLM Support**: Integration with OpenAI, Gemini, Ollama, and Claude APIs
2. **RAG Implementation**: Document upload, embedding generation, and semantic search
3. **Dual File Management**: Client file uploads and maintainer knowledge base
4. **Session Management**: Persistent conversations with memory
5. **Real-time Chat**: WebSocket or Server-Sent Events for live messaging

## Code Patterns
- Use TypeScript strict mode for all components
- Implement proper error handling and loading states
- Use React Server Components where possible
- Implement proper API rate limiting and validation
- Follow Next.js 15 best practices for App Router
- Use Tailwind CSS for responsive design
- Implement proper file upload security measures

## Security Considerations
- Validate all file uploads and implement size limits
- Sanitize user inputs and prevent XSS attacks
- Implement proper API key management with environment variables
- Use rate limiting for API endpoints
- Implement proper authentication and authorization

## Performance Optimization
- Use streaming for LLM responses
- Implement proper caching strategies
- Optimize image and file handling
- Use React Suspense for better UX
