# Deployment Guide

This guide covers deploying the Hydroponics RAG Chatbot to various platforms.

## Environment Variables

Before deploying, ensure all required environment variables are set:

```bash
# Database
DATABASE_URL="file:./dev.db"  # For production, use PostgreSQL

# OpenAI
OPENAI_API_KEY="your-openai-api-key"

# Google Gemini
GOOGLE_AI_API_KEY="your-gemini-api-key"

# Anthropic Claude
ANTHROPIC_API_KEY="your-claude-api-key"

# Ollama (local LLM)
OLLAMA_BASE_URL="http://localhost:11434"

# Pinecone (optional - for production vector storage)
PINECONE_API_KEY="your-pinecone-api-key"
PINECONE_ENVIRONMENT="your-pinecone-environment"
PINECONE_INDEX_NAME="hydroponics-chatbot"

# Application settings
JWT_SECRET="your-jwt-secret-key"
MAX_FILE_SIZE="10485760"  # 10MB
ALLOWED_FILE_TYPES="pdf,txt,docx,doc,md"
UPLOAD_RATE_LIMIT="5"  # uploads per minute
CHAT_RATE_LIMIT="20"   # messages per minute

# Next.js
NEXTAUTH_URL="http://localhost:3000"  # Update for production
NEXTAUTH_SECRET="your-nextauth-secret"
```

## Vercel Deployment

### 1. Prepare for Vercel

Update `next.config.ts` for Vercel compatibility:

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/**/*.wasm', './node_modules/**/*.node']
    }
  },
  // Enable edge runtime for better performance
  experimental: {
    runtime: 'nodejs'
  }
}

module.exports = nextConfig
```

### 2. Database Setup for Production

For production, use PostgreSQL. Update your environment variables:

```bash
# Replace SQLite with PostgreSQL
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
```

### 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### 4. Configure Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add all required environment variables

## Railway Deployment

### 1. Install Railway CLI

```bash
npm install -g @railway/cli
```

### 2. Login and Deploy

```bash
# Login to Railway
railway login

# Initialize project
railway init

# Add PostgreSQL database
railway add postgresql

# Deploy
railway up
```

### 3. Configure Environment Variables

```bash
# Set environment variables
railway variables set OPENAI_API_KEY=your-key
railway variables set GOOGLE_AI_API_KEY=your-key
# ... add other variables
```

## Docker Deployment

### 1. Create Dockerfile

```dockerfile
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 2. Create docker-compose.yml

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/chatbot
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - db
    volumes:
      - ./uploads:/app/uploads

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=chatbot
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

### 3. Build and Run

```bash
# Build and run
docker-compose up --build

# Run in background
docker-compose up -d
```

## AWS Deployment (EC2 + RDS)

### 1. Setup RDS PostgreSQL Database

1. Create RDS PostgreSQL instance
2. Configure security groups
3. Note connection details

### 2. Setup EC2 Instance

```bash
# Update system
sudo yum update -y

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Clone and setup application
git clone your-repo
cd hydroponics-chatbot
npm install
npm run build

# Setup environment variables
echo "DATABASE_URL=your-postgres-url" > .env
echo "OPENAI_API_KEY=your-key" >> .env
# ... add other variables

# Run database migrations
npx prisma db push

# Start application with PM2
pm2 start npm --name "chatbot" -- start
pm2 startup
pm2 save
```

### 3. Setup Nginx (optional)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Production Considerations

### 1. Database Optimization

- Use connection pooling
- Set up database backups
- Monitor database performance

### 2. File Storage

For production, consider using cloud storage:
- AWS S3
- Google Cloud Storage
- Azure Blob Storage

### 3. Monitoring and Logging

Set up monitoring with:
- Vercel Analytics
- Sentry for error tracking
- DataDog or New Relic for performance monitoring

### 4. Security

- Enable HTTPS
- Set up proper CORS policies
- Implement proper authentication
- Regular security updates

### 5. Scaling

- Use Redis for session storage
- Implement database read replicas
- Use CDN for static assets
- Consider microservices architecture for high traffic

## Environment-Specific Configurations

### Development
```bash
NODE_ENV=development
DATABASE_URL="file:./dev.db"
```

### Staging
```bash
NODE_ENV=staging
DATABASE_URL="postgresql://staging-db-url"
```

### Production
```bash
NODE_ENV=production
DATABASE_URL="postgresql://production-db-url"
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Check DATABASE_URL format
   - Verify database is accessible
   - Check firewall settings

2. **File Upload Issues**
   - Verify upload directory permissions
   - Check file size limits
   - Ensure proper file validation

3. **API Rate Limiting**
   - Monitor API usage
   - Implement proper error handling
   - Set up alerts for rate limit hits

4. **Memory Issues**
   - Monitor memory usage
   - Optimize file processing
   - Implement cleanup routines

### Health Check Endpoint

Add a health check endpoint for monitoring:

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Database connection failed'
      },
      { status: 503 }
    )
  }
}
```
