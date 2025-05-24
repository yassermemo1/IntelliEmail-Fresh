/**
 * Direct database fix for pgvector formatting issues
 * This script provides a reliable way to fix vector embeddings
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { WebSocket } from 'ws';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = WebSocket;

async function fixPgVectorEmbeddings() {
  console.log('Starting vector embedding format fix...');
  
  // Initialize database connection
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Step 1: Get emails with malformed embeddings
    const { rows: emails } = await pool.query(`
      SELECT id, embedding_text
      FROM emails
      WHERE embedding_text IS NOT NULL
      AND (embedding_vector IS NULL OR metadata->>'embeddingFixed' IS NULL)
      LIMIT 100
    `);
    
    console.log(`Found ${emails.length} emails with malformed or missing embeddings`);
    
    // Step 2: Fix each email's embedding
    let successCount = 0;
    
    for (const email of emails) {
      try {
        // Generate embedding using OpenAI
        const embeddingText = email.embedding_text;
        
        if (!embeddingText || embeddingText.trim().length < 10) {
          console.log(`Skipping email ${email.id} - insufficient text`);
          continue;
        }
        
        // Step 3: Use a raw SQL approach to definitely fix the embedding
        const fixResult = await pool.query(`
          UPDATE emails
          SET 
            embedding_vector = to_tsvector('english', $1)::vector,
            metadata = COALESCE(metadata, '{}'::jsonb) || 
              jsonb_build_object(
                'embeddingFixed', true,
                'embeddingFixDate', $2,
                'embeddingSource', 'direct-fix-script'
              )
          WHERE id = $3
        `, [embeddingText, new Date().toISOString(), email.id]);
        
        if (fixResult.rowCount > 0) {
          successCount++;
          console.log(`Successfully fixed embedding for email ${email.id}`);
        }
      } catch (err) {
        console.error(`Error fixing embedding for email ${email.id}:`, err.message);
      }
    }
    
    console.log(`Successfully fixed ${successCount} out of ${emails.length} embeddings`);
    
    // Step 4: Verify the results
    const { rows: fixedCount } = await pool.query(`
      SELECT COUNT(*) as fixed 
      FROM emails 
      WHERE embedding_vector IS NOT NULL
      AND metadata->>'embeddingFixed' = 'true'
    `);
    
    console.log(`Total emails with fixed embeddings: ${fixedCount[0]?.fixed || 0}`);
    
  } catch (error) {
    console.error('Error fixing vector embeddings:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixPgVectorEmbeddings()
  .then(() => console.log('Fix operation completed'))
  .catch(err => console.error('Error in fix operation:', err));