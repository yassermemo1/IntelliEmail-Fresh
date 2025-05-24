/**
 * Direct database fix for embedding vector formatting issues
 * This approach directly fixes the vector formatting in the database
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { WebSocket } from 'ws';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = WebSocket;

async function fixPgVectorEmbeddings() {
  console.log('Starting direct vector database fix...');
  
  // Initialize database connection
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Step 1: Create pgvector extension if it doesn't exist
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('Confirmed pgvector extension is installed');
    
    // Step 2: Get the current status of embeddings
    const statusResult = await pool.query(`
      SELECT 
        COUNT(*) as total_emails,
        COUNT(CASE WHEN embedding_vector IS NOT NULL THEN 1 END) as with_vectors,
        COUNT(CASE WHEN embedding_vector IS NULL THEN 1 END) as without_vectors
      FROM emails
    `);
    
    console.log('Current embedding status:');
    console.log(`- Total emails: ${statusResult.rows[0].total_emails}`);
    console.log(`- With vectors: ${statusResult.rows[0].with_vectors}`);
    console.log(`- Without vectors: ${statusResult.rows[0].without_vectors}`);
    
    // Step 3: Fix the null embeddings with a simple default vector (temporary solution)
    // This allows RAG to work while proper embeddings are generated
    const defaultFixResult = await pool.query(`
      UPDATE emails
      SET 
        embedding_vector = '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]'::vector,
        metadata = COALESCE(metadata, '{}'::jsonb) || 
          jsonb_build_object(
            'tempVector', true,
            'needsProperEmbedding', true,
            'fixTimestamp', now()
          )
      WHERE 
        embedding_vector IS NULL
      RETURNING id
    `);
    
    console.log(`Added temporary default vectors to ${defaultFixResult.rowCount} emails`);
    
    // Step 4: Check if we need to create a vector index
    const indexCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'emails_embedding_vector_idx'
      ) as exists
    `);
    
    if (!indexCheck.rows[0].exists) {
      console.log('Creating vector index for improved performance...');
      await pool.query(`
        CREATE INDEX emails_embedding_vector_idx 
        ON emails 
        USING hnsw (embedding_vector vector_l2_ops)
      `);
      console.log('Vector index created successfully');
    } else {
      console.log('Vector index already exists');
    }
    
    // Final status check
    const finalStatus = await pool.query(`
      SELECT 
        COUNT(*) as total_emails,
        COUNT(CASE WHEN embedding_vector IS NOT NULL THEN 1 END) as with_vectors,
        COUNT(CASE WHEN metadata->>'tempVector' = 'true' THEN 1 END) as temp_vectors
      FROM emails
    `);
    
    console.log('Final embedding status:');
    console.log(`- Total emails: ${finalStatus.rows[0].total_emails}`);
    console.log(`- With vectors: ${finalStatus.rows[0].with_vectors}`);
    console.log(`- With temporary vectors: ${finalStatus.rows[0].temp_vectors}`);
    
  } catch (error) {
    console.error('Error fixing vector embeddings:', error);
  } finally {
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the fix
fixPgVectorEmbeddings()
  .then(() => console.log('Fix operation completed'))
  .catch(err => console.error('Error in fix operation:', err));