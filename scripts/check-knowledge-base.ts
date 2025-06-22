import { prisma } from '../src/lib/prisma';

async function checkKnowledgeBase() {
  try {
    console.log('Checking knowledge base documents...');
    
    // Count all documents
    const totalDocs = await prisma.document.count();
    console.log(`Total documents: ${totalDocs}`);
    
    // Count knowledge base documents
    const kbDocs = await prisma.document.count({
      where: { uploadedBy: 'knowledge-base-admin' }
    });
    console.log(`Knowledge base documents: ${kbDocs}`);
    
    // Get knowledge base documents by category
    const docs = await prisma.document.findMany({
      where: { uploadedBy: 'knowledge-base-admin' },
      select: {
        id: true,
        title: true,
        fileName: true,
        fileType: true,
        fileSize: true
      }
    });
    
    // Group by category from title (category - filename)
    const categories: { [category: string]: typeof docs } = {};
    for (const doc of docs) {
      const category = doc.title.split(' - ')[0];
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(doc);
    }
    
    console.log('\nKnowledge base documents by category:');
    for (const [category, docs] of Object.entries(categories)) {
      console.log(`- ${category}: ${docs.length} documents`);
    }
    
    // Check embeddings/chunks
    const totalChunks = await prisma.documentChunk.count();
    console.log(`\nTotal document chunks: ${totalChunks}`);
    
    // Sample documents
    console.log('\nSample knowledge base documents:');
    for (const doc of docs.slice(0, 5)) {
      console.log(`- ${doc.title} (${doc.fileName}, ${doc.fileSize} bytes)`);
    }
    
  } catch (error) {
    console.error('Error checking knowledge base:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check function
checkKnowledgeBase()
  .then(() => {
    console.log('\nCheck completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Check failed:', error);
    process.exit(1);
  });