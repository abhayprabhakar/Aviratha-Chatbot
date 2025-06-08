# Hydroponics RAG Chatbot

A sophisticated Next.js-powered chatbot with Retrieval-Augmented Generation (RAG) capabilities designed for hydroponics knowledge management. This application allows both clients and maintainers to upload documents and interact with an AI assistant that has access to a comprehensive knowledge base.

## 🚀 Features

### Core Functionality
- **Multi-LLM Support**: Integrate with OpenAI, Google Gemini, Anthropic Claude, and Ollama
- **RAG Implementation**: Upload and query documents for enhanced AI responses
- **Dual File Management**: Separate upload capabilities for clients and maintainers
- **Session Management**: Persistent conversations with memory across sessions
- **Real-time Chat Interface**: Modern, responsive chat UI with message history

### Document Processing
- **Multiple File Types**: Support for PDF, TXT, DOCX, DOC, and Markdown files
- **Vector Embeddings**: Automatic text chunking and embedding generation
- **Semantic Search**: Find relevant document context for user queries
- **File Security**: Size limits, type validation, and secure file handling

### User Experience
- **Conversation Management**: Create, view, and manage multiple chat sessions
- **Document Library**: View uploaded documents with metadata
- **Settings Panel**: Configure LLM providers, models, and parameters
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🛠 Technology Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes with Edge Runtime
- **Database**: Prisma ORM with SQLite (development) / PostgreSQL (production)
- **Vector Processing**: OpenAI Embeddings API with cosine similarity search
- **File Processing**: PDF parsing, DOCX extraction, text processing
- **Authentication**: JWT-based session management

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
   Copy the `.env` file and configure your API keys:
   ```bash
   # Database
   DATABASE_URL="file:./dev.db"

   # LLM API Keys (add at least one)
   OPENAI_API_KEY="your-openai-api-key"
   GEMINI_API_KEY="your-gemini-api-key"
   ANTHROPIC_API_KEY="your-anthropic-api-key"
   OLLAMA_BASE_URL="http://localhost:11434"

   # Optional: Pinecone for production vector storage
   PINECONE_API_KEY="your-pinecone-api-key"
   PINECONE_ENVIRONMENT="your-pinecone-environment"
   PINECONE_INDEX_NAME="your-pinecone-index"

   # Security
   JWT_SECRET="your-super-secret-jwt-key"

   # File Upload Settings
   MAX_FILE_SIZE="10485760"  # 10MB
   ALLOWED_FILE_TYPES="pdf,txt,docx,doc,md"
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

## 🔧 Configuration

### LLM Providers Setup

#### OpenAI
- Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
- Add to `OPENAI_API_KEY` in `.env`
- Supported models: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`

#### Google Gemini
- Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Add to `GEMINI_API_KEY` in `.env`
- Supported models: `gemini-pro`, `gemini-pro-vision`

#### Anthropic Claude
- Get your API key from [Anthropic Console](https://console.anthropic.com/)
- Add to `ANTHROPIC_API_KEY` in `.env`
- Supported models: `claude-3-opus-20240229`, `claude-3-sonnet-20240229`, `claude-3-haiku-20240307`

#### Ollama (Local)
- Install [Ollama](https://ollama.com/) locally
- Pull models: `ollama pull llama2` or `ollama pull mistral`
- Ensure Ollama is running on `http://localhost:11434`

### Vector Database Setup

For production, consider using Pinecone for better performance:
1. Create a Pinecone account and index
2. Add Pinecone credentials to `.env`
3. Update vector service to use Pinecone instead of local storage

## 📁 Project Structure

```
src/
├── app/
│   ├── api/                 # API routes
│   │   ├── chat/           # Chat endpoint
│   │   ├── conversations/  # Conversation management
│   │   ├── session/        # Session management
│   │   └── upload/         # File upload handling
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx           # Main page
├── components/
│   └── ChatInterface.tsx   # Main chat component
├── lib/
│   ├── file-processing.ts  # Document processing
│   ├── llm.ts             # LLM service integration
│   ├── prisma.ts          # Database connection
│   ├── session.ts         # Session management
│   ├── utils.ts           # Utility functions
│   └── vector.ts          # Vector/embedding service
└── prisma/
    └── schema.prisma       # Database schema
```

## 🔒 Security Features

- **File Validation**: Type checking and size limits for uploads
- **Session Management**: JWT-based authentication with expiration
- **Input Sanitization**: Protection against XSS and injection attacks
- **Rate Limiting**: API endpoint protection (configurable)
- **Environment Isolation**: Secure API key management

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
3. Update `DATABASE_URL` to use PostgreSQL for production
4. Deploy with automatic CI/CD

### Docker
```dockerfile
# Example Dockerfile structure
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables for Production
- Use PostgreSQL instead of SQLite
- Set secure JWT secrets
- Configure proper CORS settings
- Enable rate limiting
- Set up proper logging and monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 API Documentation

### Endpoints

- `POST /api/session` - Create new session
- `GET /api/session` - Validate session
- `POST /api/chat` - Send chat message
- `GET /api/conversations` - Get conversations
- `POST /api/conversations` - Create conversation
- `PUT /api/conversations` - Update conversation
- `DELETE /api/conversations` - Delete conversation
- `POST /api/upload` - Upload document
- `GET /api/upload` - Get documents
- `DELETE /api/upload` - Delete document

### Request/Response Examples

```typescript
// Chat API Example
POST /api/chat
{
  "message": "What is hydroponics?",
  "conversationId": "optional-conversation-id",
  "llmConfig": {
    "provider": "openai",
    "model": "gpt-3.5-turbo",
    "temperature": 0.7,
    "maxTokens": 2000
  },
  "useRAG": true
}
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Ensure Prisma is properly configured
   - Run `npx prisma generate` and `npx prisma db push`

2. **LLM API Errors**
   - Verify API keys are correct and have sufficient credits
   - Check rate limits and model availability

3. **File Upload Issues**
   - Verify file size limits and allowed types
   - Check upload directory permissions

4. **Vector Search Not Working**
   - Ensure OpenAI API key is set for embeddings
   - Verify documents have been processed and embedded

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- OpenAI for GPT models and embeddings API
- Prisma for the excellent ORM
- Tailwind CSS for beautiful styling
- All the open-source contributors who made this possible
