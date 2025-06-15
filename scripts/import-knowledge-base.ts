import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';
import { createVectorService } from '../src/lib/vector-multi';

const KNOWLEDGE_BASE_DIR = path.join(process.cwd(), 'knowledge-base');
const ADMIN_SESSION_ID = 'knowledge-base-admin';
const vectorService = createVectorService();

// Maximum number of chunks to process per file
const MAX_CHUNKS_PER_FILE = 100;
// Maximum content size (20,000 bytes is safe for Gemini's 36,000 byte limit)
const MAX_CONTENT_SIZE = 20000;

async function importKnowledgeBase() {
  console.log('Starting knowledge base import...');

  // Create admin session if it doesn't exist
  const existingSession = await prisma.session.findUnique({
    where: { sessionId: ADMIN_SESSION_ID }
  });

  if (!existingSession) {
    console.log('Creating admin session...');
    await prisma.session.create({
      data: {
        sessionId: ADMIN_SESSION_ID,
        isAdmin: true
      }
    });
  }

  // Process each folder in knowledge base
  try {
    const categories = fs.readdirSync(KNOWLEDGE_BASE_DIR);
    
    for (const category of categories) {
      const categoryPath = path.join(KNOWLEDGE_BASE_DIR, category);
      
      // Skip if not a directory
      if (!fs.statSync(categoryPath).isDirectory()) continue;
      
      console.log(`Processing category: ${category}`);
      
      // Process each file in the category
      const files = fs.readdirSync(categoryPath);
      for (const file of files) {
        const filePath = path.join(categoryPath, file);
        const fileStats = fs.statSync(filePath);
        
        // Skip if not a file
        if (!fileStats.isFile()) continue;
        
        const fileExt = path.extname(file).toLowerCase();
        
        // Check if file type is supported
        if (!['.txt', '.pdf', '.md'].includes(fileExt)) {
          console.log(`Skipping unsupported file type: ${file}`);
          continue;
        }
        
        try {
          console.log(`Processing file: ${file}`);
          
          // Read file content
          let content = fs.readFileSync(filePath, 'utf-8');
          
          // Limit content size if it's too large for embedding
          if (content.length > MAX_CONTENT_SIZE) {
            console.warn(`⚠️ File ${file} content is too large (${content.length} bytes). Truncating to ${MAX_CONTENT_SIZE} bytes.`);
            content = content.substring(0, MAX_CONTENT_SIZE);
          }
          
          const title = `${category} - ${path.basename(file, fileExt)}`.replace(/-/g, ' ');
          
          // Create document in database
          const document = await prisma.document.create({
            data: {
              title: title,
              content: content,
              fileName: file,
              fileType: fileExt.substring(1), // Remove the dot
              fileSize: fileStats.size,
              uploadedBy: ADMIN_SESSION_ID,
              isPublic: true, // Make all knowledge base files public
            }
          });
          
          // Split content into chunks for embedding
          const chunks = vectorService.splitTextIntoChunks(content);
          
          // Limit number of chunks to avoid overwhelming the embedding service
          const chunksToProcess = chunks.slice(0, MAX_CHUNKS_PER_FILE);
          console.log(`Created ${chunks.length} chunks for ${file}, processing ${chunksToProcess.length}`);
          
          if (chunks.length > MAX_CHUNKS_PER_FILE) {
            console.warn(`⚠️ File has too many chunks (${chunks.length}). Processing only the first ${MAX_CHUNKS_PER_FILE}.`);
          }
          
          // Create embeddings
          await vectorService.createDocumentEmbeddings(document.id, chunksToProcess);
          console.log(`Created embeddings for ${file}`);
          
        } catch (error) {
          console.error(`Error processing file ${file}:`, error);
        }
      }
    }
    
    console.log('Knowledge base import completed successfully!');
    
  } catch (error) {
    console.error('Error importing knowledge base:', error);
  }
}

// Run the import function
importKnowledgeBase()
  .then(() => {
    console.log('Import script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Import script failed:', error);
    process.exit(1);
  });