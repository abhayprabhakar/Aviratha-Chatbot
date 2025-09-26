# 🌱 Hydroponics RAG Chatbot

A **production-ready** Next.js-powered chatbot with advanced Retrieval-Augmented Generation (RAG) capabilities designed for hydroponics knowledge management. This application provides intelligent, context-aware responses by combining multiple AI providers with a robust document management system.

## ✨ Key Highlights

- 🎯 **Production Ready**: Clean codebase, successful builds, comprehensive error handling
- 🤖 **Multi-LLM Support**: OpenAI GPT, Google Gemini, Anthropic Claude, Ollama with fallback options
- 📚 **Advanced RAG**: Intelligent document processing with semantic search and context injection
- 🔐 **Secure Architecture**: JWT-based sessions, input validation, rate limiting
- 🎨 **Modern UI**: Material-UI v7 with responsive design and smooth animations
- 📱 **Mobile-First**: Optimized for all devices with touch-friendly interface

## 🚀 Features

### 🧠 Intelligent Chat System
- **Multi-Provider AI**: Switch between OpenAI, Gemini, Claude, and Ollama seamlessly
- **Context-Aware Responses**: RAG system provides relevant document context
- **Streaming Responses**: Real-time message generation for better UX
- **Conversation Persistence**: Complete chat history with session management
- **Smart Memory**: Maintains context across conversation sessions

### 📄 Advanced Document Management
- **Multi-Format Support**: PDF, TXT, DOCX, DOC, and Markdown files
- **Intelligent Processing**: Automatic text extraction, chunking, and embedding
- **Vector Search**: Semantic similarity search with multiple embedding providers
- **Knowledge Base UI**: Easy document upload, viewing, and deletion
- **Admin Panel**: Separate management interface for maintainers

### 🔧 Multi-Provider Embedding Support
- **OpenAI**: `text-embedding-ada-002`, `text-embedding-3-small/large`
- **Google Gemini**: `text-embedding-004` with free tier
- **Hugging Face**: Multiple open-source models
- **Cohere**: High-quality commercial embeddings
- **Ollama**: Local embedding models for privacy
- **Fallback System**: Automatic provider switching on failure

### 🎨 User Experience
- **Dual User System**: Regular users and admin privileges
- **Responsive Design**: Beautiful Material-UI interface that works everywhere
- **Real-time Feedback**: Loading states, error handling, success notifications
- **File Management**: Drag-and-drop uploads with progress indicators
- **Settings Panel**: Configure providers, models, and parameters easily

## 🛠 Technology Stack

- **Frontend**: Next.js 15 with App Router, React 18, TypeScript, Material-UI v7
- **Styling**: Tailwind CSS with custom animations and responsive design
- **Backend**: Next.js API Routes with Edge Runtime + Flask backend for document processing
- **Database**: Prisma ORM with SQLite (development) / PostgreSQL (production)
- **AI Integration**: OpenAI, Google Gemini, Anthropic Claude, Ollama APIs
- **Vector Storage**: Multiple providers (Pinecone, local embeddings) with fallback
- **Authentication**: JWT-based secure session management
- **File Processing**: Advanced text extraction and chunking algorithms

## 🔧 Configuration HOW TO GET API KEYS

#### 🟢 Google Gemini (Recommended - Free Tier)
- Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
- Add to `GEMINI_API_KEY` in `.env`

#### 🟢 Plant ID API KEY (Recommended - Free Tier)
- Go to the website [Plant ID](https://plant.id/)
- Sign in through your google account
- Then go to this website [API KEY Website](https://admin.kindwise.com/)
- Login through the same email in the website
- Click on CREATE NEW API KEY
- Select "plant.id - Plant species identification and health assessment." option
- Give a name for your api key
- assign MAX credits then create 
- copy the api key
- Add `PLANTID_API_KEY` in `.env`


## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd hydroponics-chatbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```bash
   # Database
   DATABASE_URL="file:./prisma/dev.db"

   # Primary LLM API Keys
   GEMINI_API_KEY="your-gemini-api-key"      

   PLANTID_API_KEY="your-plant-id-api-key"

   # Security & Configuration
   JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
   MAX_FILE_SIZE="10485760"  # 10MB default
   ALLOWED_FILE_TYPES="pdf,txt,docx,doc,md"
   
   # Flask Backend (automatically configured)
   FLASK_PORT="5000"
   ```

4. **Initialize the database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Embedding Providers Configuration

The application supports multiple embedding providers with automatic fallback:

1. **Primary**: OpenAI (if configured)
2. **Alternative**: Gemini `text-embedding-004` (free tier)
3. **Open Source**: Hugging Face models
4. **Local**: Ollama embedding models
5. **Fallback**: Basic local embeddings for development

Visit `/embedding-providers` in the application to test and configure providers.

### Vector Database Setup

For production, consider using Pinecone for better performance:
1. Create a Pinecone account and index
2. Add Pinecone credentials to `.env`
3. Update vector service to use Pinecone instead of local storage

## 📁 Project Structure

```
src/
├── app/
│   ├── api/                    # API routes
│   │   ├── chat/              # Chat endpoint with streaming
│   │   ├── conversations/     # Conversation management
│   │   ├── session/           # JWT session handling
│   │   ├── upload/            # File upload & document management
│   │   ├── admin/             # Admin-only endpoints
│   │   └── embedding-providers/ # Provider configuration
│   ├── admin/                 # Admin panel interface
│   ├── embedding-providers/   # Provider testing interface
│   ├── globals.css           # Global styles with animations
│   ├── layout.tsx            # Root layout with providers
│   └── page.tsx              # Main chat interface
├── components/
│   ├── ChatInterface.tsx     # Main chat component with RAG
│   ├── MarkdownRenderer.tsx  # Advanced message rendering
│   ├── AdminPanel.tsx        # Admin management interface
│   └── ThemeProvider.tsx     # Material-UI theme configuration
├── lib/
│   ├── llm.ts               # Multi-provider LLM integration
│   ├── vector-multi.ts      # Multi-provider vector service
│   ├── file-processing-simple.ts # Document processing
│   ├── session.ts           # Session management service
│   ├── prisma.ts           # Database connection
│   ├── rate-limit.ts       # API rate limiting
│   └── utils.ts            # Utility functions
├── prisma/
│   ├── schema.prisma       # Database schema with relations
│   └── dev.db             # SQLite development database
├── flask_app_clean.py      # Flask backend for document processing
└── uploads/                # File storage directory
    └── admin/             # Admin uploaded documents
```

## 🔒 Security & Production Features

### Security Implementation
- **JWT Authentication**: Secure session management with 7-day expiration
- **Input Validation**: Comprehensive file type and size validation
- **XSS Protection**: Input sanitization and safe rendering
- **Rate Limiting**: Configurable API endpoint protection
- **CORS Security**: Proper cross-origin request handling
- **Environment Isolation**: Secure API key management with fallbacks

### Production Readiness
- ✅ **Clean Build**: Zero compilation errors, optimized for production
- ✅ **Error Handling**: Comprehensive error boundaries and user feedback
- ✅ **Performance**: Streaming responses, caching, and optimized bundle
- ✅ **Monitoring**: Detailed logging and error tracking
- ✅ **Scalability**: Multi-provider fallbacks and horizontal scaling ready
- ✅ **Testing**: Production-ready codebase with proper validation

### Quality Assurance
- **TypeScript Strict Mode**: Full type safety across the application
- **ESLint Configuration**: Code quality and consistency enforcement
- **Material-UI v7**: Modern, accessible component library
- **Responsive Design**: Mobile-first approach with touch optimization
- **Progressive Enhancement**: Works with JavaScript disabled for core features

## 🚀 Deployment

### Vercel (Recommended)
1. Fork/clone this repository to your GitHub
2. Connect repository to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard:
   ```bash
   DATABASE_URL="postgresql://user:password@host:port/database"
   GEMINI_API_KEY="your-gemini-key"  # or other LLM providers
   JWT_SECRET="secure-random-32-char-string"
   # Add other provider keys as needed
   ```
4. Deploy with automatic CI/CD pipeline

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port and start
EXPOSE 3000
CMD ["npm", "start"]
```

### Traditional Hosting
```bash
# Build for production
npm run build

# Start production server
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start npm --name "hydroponics-chatbot" -- start
```

### Environment Variables for Production
```bash
# Use PostgreSQL for better performance
DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Secure JWT secret (32+ characters)
JWT_SECRET="your-super-secure-random-jwt-secret-key"

# Configure at least one LLM provider
GEMINI_API_KEY="your-gemini-api-key"  # Recommended for free tier

# Optional: Production vector storage
PINECONE_API_KEY="your-pinecone-key"
PINECONE_ENVIRONMENT="your-environment"
PINECONE_INDEX_NAME="your-index-name"

# Security settings
MAX_FILE_SIZE="10485760"  # 10MB
ALLOWED_FILE_TYPES="pdf,txt,docx,doc,md"

# Performance tuning
NODE_ENV="production"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 API Documentation

### Core Endpoints

#### Session Management
- `POST /api/session` - Create/validate session
- `GET /api/session` - Get current session info

#### Chat & Conversations
- `POST /api/chat` - Send message with RAG context
- `POST /api/chat/stream` - Streaming chat responses
- `GET /api/conversations` - Get user conversations
- `POST /api/conversations` - Create new conversation
- `PUT /api/conversations` - Update conversation title
- `DELETE /api/conversations` - Delete conversation

#### Document Management
- `POST /api/upload` - Upload documents with processing
- `GET /api/upload` - Get user's documents
- `DELETE /api/upload?id={docId}` - Delete specific document

#### Admin Endpoints
- `GET /api/admin/documents` - Get all documents (admin only)
- `POST /api/admin/upload` - Upload to global knowledge base

#### Provider Configuration
- `GET /api/embedding-providers` - Get provider status
- `POST /api/embedding-providers` - Test embedding providers

### Request/Response Examples

#### Chat with RAG
```typescript
POST /api/chat
Content-Type: application/json
Authorization: Bearer {jwt-token}

{
  "message": "What nutrients does lettuce need in hydroponics?",
  "conversationId": "optional-conversation-id",
  "llmConfig": {
    "provider": "gemini",
    "model": "gemini-pro",
    "temperature": 0.7,
    "maxTokens": 2000
  },
  "useRAG": true
}

// Response
{
  "response": "Based on your uploaded documents, lettuce requires...",
  "metadata": {
    "contextUsed": true,
    "sourcesCount": 3,
    "sources": [
      {
        "title": "Hydroponic Lettuce Guide",
        "similarity": 0.85,
        "chunk": "Lettuce requires nitrogen (N), phosphorus (P)..."
      }
    ]
  },
  "conversationId": "created-or-existing-id"
}
```

#### Document Upload
```typescript
POST /api/upload
Content-Type: multipart/form-data
Authorization: Bearer {jwt-token}

FormData:
- file: [PDF/TXT/DOCX file]
- title: "Optional custom title"

// Response
{
  "success": true,
  "document": {
    "id": "doc-id",
    "title": "Processed Document Title",
    "fileName": "original-file.pdf",
    "fileSize": 1024000,
    "fileType": "pdf",
    "chunksProcessed": 15,
    "embeddingsGenerated": true
  }
}
```

## 🐛 Troubleshooting

### Common Issues & Solutions

#### 1. **Build/Compilation Errors**
```bash
# Clear Next.js cache
rm -rf .next
npm run build

# Reset dependencies
rm -rf node_modules package-lock.json
npm install

# Database issues
npx prisma generate
npx prisma db push
```

#### 2. **LLM Provider Issues**
- **API Key Errors**: Verify keys in `.env.local` and check quotas
- **Rate Limits**: Configure multiple providers for automatic fallback
- **Model Unavailable**: Check provider documentation for supported models
- **Connection Issues**: Test providers at `/embedding-providers` page

#### 3. **File Upload Problems**
```bash
# Check upload directory permissions
mkdir -p uploads/admin
chmod 755 uploads

# Verify file size limits
MAX_FILE_SIZE=10485760  # 10MB default

# Supported file types
ALLOWED_FILE_TYPES="pdf,txt,docx,doc,md"
```

#### 4. **Vector Search Not Working**
- Ensure at least one embedding provider is configured
- Check that documents have been processed successfully
- Verify vector database connection (Pinecone/local)
- Test embedding generation at `/embedding-providers`

#### 5. **Session/Authentication Issues**
```bash
# Generate secure JWT secret (32+ characters)
JWT_SECRET="$(openssl rand -base64 32)"

# Clear browser storage and cookies
# Check token expiration (7-day default)
```

#### 6. **Database Connection Errors**
```bash
# SQLite (development)
DATABASE_URL="file:./dev.db"

# PostgreSQL (production)
DATABASE_URL="postgresql://user:password@host:5432/database"

# Reset database
npx prisma db push --force-reset
```

### Getting Help

1. **Check the logs**: Review browser console and server logs
2. **Test providers**: Use `/embedding-providers` to verify API connections
3. **Admin panel**: Access `/admin` for system status and document management
4. **Health check**: Visit `/api/health` for system status
5. **GitHub Issues**: Report bugs with detailed error messages and environment info

### Performance Optimization

- **Use multiple providers** for redundancy and load balancing
- **Configure Pinecone** for production vector storage
- **Enable caching** for frequently accessed documents
- **Use CDN** for static assets in production
- **Monitor API usage** to optimize costs and performance

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Next.js Team** - For the incredible React framework and App Router
- **Google** - For Gemini API with generous free tier
- **OpenAI** - For GPT models and embedding APIs
- **Anthropic** - For Claude's advanced reasoning capabilities
- **Material-UI Team** - For the beautiful, accessible component library
- **Prisma** - For the excellent TypeScript-first ORM
- **Vercel** - For seamless deployment and hosting platform
- **Ollama Team** - For making local AI accessible and easy
- **Open Source Community** - For all the amazing libraries and tools

## 📈 Project Status

- ✅ **Production Ready**: Clean, tested, and deployed successfully
- ✅ **Multi-Provider**: Full LLM and embedding provider support
- ✅ **Secure**: Comprehensive security implementation
- ✅ **Scalable**: Architecture designed for growth
- ✅ **Maintainable**: Well-documented, TypeScript codebase
- ✅ **User-Friendly**: Intuitive interface with great UX

---

**Built with ❤️ for the hydroponics community**

For questions, feature requests, or contributions, please open an issue on GitHub.
