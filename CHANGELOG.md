# Changelog

## [1.1.0] - 2025-06-19

### 🌿 Enhanced Plant Identification Features

This update significantly improves the plant identification capabilities by making the system more responsive to user queries and enhancing the visual presentation.

### 🔧 Changes Made

#### 1. Plant Identification UI Improvements
- **Added image preview**: Created a clipboard-style preview when uploading plant images
- **Custom prompts support**: Users can now ask specific questions when uploading plant images
- **Improved image display**: Plant images now display with proper sizing in the conversation
- **Styled upload button**: Matched the plant upload button styling with the send button for UI consistency
- **Added image removal**: Users can now remove selected images before sending

#### 2. Plant Identification Backend
- **Custom query handling**: The system now responds directly to user questions about plant images
- **Optimized image storage**: Plant images are now saved to the public directory with unique filenames
- **Enhanced metadata**: Added structured storage of plant data and images for follow-up questions
- **Intelligent follow-up questions**: System suggests context-aware follow-up questions that avoid duplicating user queries

#### 3. Response Generation System
- **Context-aware responses**: Added a specialized endpoint for plant-related follow-up questions
- **Direct query handling**: System examines user queries to provide targeted information about plant health, identification, or hydroponics
- **Technical implementation**: Uses Plant.id API data to generate custom responses based on specific user questions
- **Data preservation**: Stores complete plant analysis for detailed follow-up questions while showing concise initial responses

### 🔍 How to Use Plant Identification

1. **Upload plant images**
   - Click the camera icon in the chat input area
   - An image preview will appear above the text input
   - Add an optional custom message or question about the plant
   - Click send to process the image

2. **Ask specific questions with your upload**
   - "What are the issues in this plant image?"
   - "Can you identify this plant?"
   - "Is this plant suitable for hydroponics?"
   - Or send without text for a general assessment

3. **Follow up on plant identification**
   - Choose from suggested follow-up questions
   - Ask custom questions about the identified plant
   - The system maintains context about your plant throughout the conversation

4. **Image management**
   - Remove unwanted images before sending using the X button
   - Upload a new image to replace the current selection
   - Images are automatically cleared after sending

### 🔧 Technical Implementation Details

- **Image Storage**: Plant images are stored in `/public/uploaded-plants/` with UUID-based filenames
- **Metadata Structure**: Messages include `type` ('plant_upload', 'plant_identification', 'plant_followup') and detailed plant data
- **API Integration**: Uses Plant.id API with Gemini 2.0 Flash for intelligent response generation
- **Response Customization**: Analyzes user queries using NLP techniques to determine question intent
- **Image Processing**: Images are optimized for display while preserving original data for analysis
- **Query Routing**: Special routing for plant-related questions to provide consistent context





## [1.0.0] - 2025-06-14

### 🌟 Major Change: Knowledge Base Only Mode

The chatbot has been reconfigured to exclusively use a pre-loaded knowledge base instead of allowing user-uploaded documents. This ensures consistent, curated information quality.

### 🔧 Changes Made

#### 1. UI Changes
- **Disabled document uploads**: Removed the ability for users to upload their own documents
- **Modified UI**: Changed upload button to an informational icon indicating knowledge base usage
- **Added visual indicators**: Now clearly shows when answers come from the knowledge base

#### 2. API Changes
- **Modified `/api/upload` endpoint**: Disabled user document uploads
- **Updated chat API routes**: Prioritizes knowledge base documents for all queries
- **Added administrative session**: Created knowledge-base-admin session for managing documents

#### 3. Knowledge Base System
- **Created structured knowledge base directory**:
  - `knowledge-base/basic-concepts/`
  - `knowledge-base/growing-conditions/`
  - `knowledge-base/plant-care/`
  - `knowledge-base/troubleshooting/`
  - `knowledge-base/faqs/`
- **Created import script**: Added automated knowledge base import functionality
- **Added cleanup script**: Tool to remove any non-knowledge-base documents

#### 4. Documentation
- **Created CHANGELOG.md**: This document to track system modifications

### 📋 Setup and Usage Instructions

#### Initial Setup

1. **Install dependencies**
   ```bash
   npm install
   pip install -r requirements.txt
   ```

2. **Set up environment variables**
   Create a `.env.local` file:
   ```
   # Database
   DATABASE_URL="file:./prisma/dev.db"

   # AI Provider (at least one required)
   GEMINI_API_KEY="your-gemini-api-key"
   # OPENAI_API_KEY="your-openai-api-key"
   # ANTHROPIC_API_KEY="your-anthropic-api-key"

   # Security
   JWT_SECRET="generate-a-random-string-at-least-32-characters"

   # File settings
   MAX_FILE_SIZE="10485760"  # 10MB default
   ALLOWED_FILE_TYPES="pdf,txt,docx,doc,md"

   # Flask backend
   FLASK_PORT="5000"
   ```

3. **Initialize the database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

#### Knowledge Base Management

1. **Create knowledge base structure**
   ```bash
   mkdir -p knowledge-base/basic-concepts knowledge-base/growing-conditions knowledge-base/plant-care knowledge-base/troubleshooting knowledge-base/faqs
   ```

2. **Add your content files**
   - Add `.txt`, `.pdf`, or `.md` files to appropriate category folders
   - Keep file sizes reasonable (under 20,000 bytes recommended per file)
   - Use descriptive filenames (e.g., `nutrient-deficiencies.txt`)

3. **Import knowledge base**
   ```bash
   npx tsx scripts/import-knowledge-base.ts
   ```
   
4. **Clean up non-knowledge base documents** (if needed)
   ```bash
   npx tsx scripts/cleanup-user-documents.ts
   ```

#### Running the Application

1. **Start the Flask backend**
   ```bash
   python flask_app_clean.py
   ```

2. **In a separate terminal, start the Next.js frontend**
   ```bash
   npm run dev
   ```

3. **Access the application**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

### 🔍 How to Use

1. **Ask questions related to hydroponics**
   - The chatbot will search the knowledge base for relevant information
   - Answers from the knowledge base will be clearly marked
   - If the answer isn't in the knowledge base, it will disclose that it's providing general knowledge

2. **Knowledge source indicator**
   - Green indicator: Answer comes directly from hydroponics knowledge base
   - Gray indicator: Answer includes some knowledge base information 
   - Disclaimer text: When information isn't available in knowledge base

3. **View knowledge base documents**
   - Click the document icon to see available knowledge base documents
   - These documents cannot be modified through the UI

### 🛠️ Troubleshooting

If you encounter issues:

1. **Database reset**
   ```bash
   npx prisma db push --force-reset
   ```

2. **Reimport knowledge base**
   ```bash
   npx tsx scripts/import-knowledge-base.ts
   ```

3. **Check logs**
   - Flask backend logs in console
   - Next.js frontend logs in console
   - Database issues: Check Prisma errors

### 📈 Future Improvements

- Add administrative UI for knowledge base management
- Implement version control for knowledge base documents
- Add analytics for question topics and knowledge base coverage
- Improve handling of PDF files with proper chunking