/**
 * Routes for fixing embedding vector issues
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { emails } from '@shared/schema';
import { AiService } from '../services/aiService';

const router = Router();
const aiService = new AiService();

/**
 * Test endpoint to verify embedding generation and storage works properly
 */
router.post('/test-embedding', async (req: Request, res: Response) => {
  try {
    // Step 1: Find an email to test with
    const [sampleEmail] = await db
      .select()
      .from(emails)
      .where(sql`embedding_vector IS NULL`)
      .limit(1);
    
    if (!sampleEmail) {
      return res.json({
        success: false,
        message: 'No emails without embeddings found'
      });
    }
    
    console.log(`Testing embedding for email id ${sampleEmail.id}`);
    
    // Step 2: Generate a sample text for embedding
    const textToEmbed = `Subject: ${sampleEmail.subject || ""}\n\nBody: ${sampleEmail.body || ""}`;
    
    // Step 3: Generate embedding with our service
    const embedding = await aiService.generateEmbedding(textToEmbed);
    
    if (!Array.isArray(embedding)) {
      return res.json({
        success: false,
        message: 'Embedding generation failed - not an array',
        type: typeof embedding
      });
    }
    
    console.log(`Generated embedding with ${embedding.length} dimensions`);
    
    // Step 4: Ensure embedding has exactly 768 dimensions
    let finalEmbedding = [...embedding];
    
    if (embedding.length !== 768) {
      console.log(`Adjusting embedding dimensions from ${embedding.length} to 768`);
      
      if (finalEmbedding.length < 768) {
        // Pad with zeros
        while (finalEmbedding.length < 768) {
          finalEmbedding.push(0);
        }
      } else {
        // Truncate
        finalEmbedding.length = 768;
      }
    }
    
    // Step 5: Store embedding in database using proper pgvector format
    const vectorString = `[${finalEmbedding.join(',')}]`;
    
    try {
      const dateString = new Date().toISOString();
      const emailId = sampleEmail.id;
      
      // Use a direct SQL string to avoid parameter type issues
      const updateSQL = `
        UPDATE emails
        SET 
          embedding_vector = '${vectorString}'::vector(768),
          embedding_generated_at = NOW(),
          metadata = jsonb_build_object(
            'embeddingGenerated', true,
            'embeddingDate', '${dateString}',
            'embeddingSource', 'fix-test',
            'dimensions', 768
          )
        WHERE id = ${emailId}
      `;
      
      await db.execute(sql.raw(updateSQL));
      
      console.log(`Successfully stored embedding for email ${sampleEmail.id}`);
      
      // Step 6: Verify embedding was stored
      const [verifiedEmail] = await db
        .select({
          id: emails.id,
          hasEmbedding: sql<boolean>`embedding_vector IS NOT NULL`
        })
        .from(emails)
        .where(sql`id = ${sampleEmail.id}`);
      
      return res.json({
        success: true,
        emailId: sampleEmail.id,
        embeddingDimensions: finalEmbedding.length,
        embeddingStored: verifiedEmail?.hasEmbedding,
        embeddingFormat: 'pgvector(768)'
      });
    } catch (storeError: any) {
      console.error(`Error storing embedding: ${storeError.message}`);
      return res.status(500).json({
        success: false,
        message: 'Error storing embedding in database',
        error: storeError.message
      });
    }
  } catch (error: any) {
    console.error(`Error in test-embedding endpoint: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error testing embedding generation',
      error: error.message
    });
  }
});

/**
 * Attempt to fix all embeddings to ensure proper format
 */
router.post('/fix-all-embeddings', async (req: Request, res: Response) => {
  try {
    // First update column type if needed
    await db.execute(sql`
      ALTER TABLE emails
      ALTER COLUMN embedding_vector TYPE vector(768)
      USING NULL::vector(768)
    `).catch((error) => {
      // Ignore errors if column already has correct type
      console.log(`Column type update result: ${error.message}`);
    });
    
    // Start process to regenerate embeddings for all emails without them
    const status = await aiService.getEmbeddingStatus();
    
    // Trigger background process to generate embeddings
    setTimeout(async () => {
      try {
        const processedCount = await aiService.updateEmailEmbeddings(100);
        console.log(`Background job processed ${processedCount} emails`);
      } catch (error) {
        console.error('Error in background embedding generation:', error);
      }
    }, 100);
    
    return res.json({
      success: true,
      message: 'Started fixing all embeddings',
      status
    });
  } catch (error: any) {
    console.error(`Error fixing all embeddings: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Error fixing all embeddings',
      error: error.message
    });
  }
});

export default router;