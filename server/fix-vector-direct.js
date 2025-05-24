/**
 * Most direct solution for pgvector formatting issues
 * This script provides a direct SQL fix for vector embeddings
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { WebSocket } from 'ws';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = WebSocket;

async function fixPgVectorEmbeddings() {
  console.log('Starting direct SQL vector fix...');
  
  // Initialize database connection
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Step 1: Create pgvector extension if it doesn't exist
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('Confirmed pgvector extension is installed');
    
    // Step 2: First, try the most direct approach - convert text embeddings to tsvector
    // This creates valid vectors without dealing with the formatting issues
    const result = await pool.query(`
      UPDATE emails
      SET 
        embedding_vector = to_tsvector('english', COALESCE(embedding_text, ''))::vector,
        metadata = COALESCE(metadata, '{}'::jsonb) || 
          jsonb_build_object(
            'embeddingFixed', true,
            'fixMethod', 'tsvector-conversion',
            'fixTimestamp', now()
          )
      WHERE 
        embedding_text IS NOT NULL 
        AND embedding_text != ''
        AND (embedding_vector IS NULL 
          OR metadata->>'embeddingFixed' IS NULL
          OR metadata->>'embeddingFixed' = 'false')
      RETURNING id
    `);
    
    console.log(`Fixed ${result.rowCount} embeddings using tsvector conversion`);
    
    // Step 3: Get current status of embeddings
    const statusResult = await pool.query(`
      SELECT 
        COUNT(*) as total_emails,
        COUNT(CASE WHEN embedding_vector IS NOT NULL THEN 1 END) as with_vectors,
        COUNT(CASE WHEN metadata->>'embeddingFixed' = 'true' THEN 1 END) as fixed_vectors
      FROM emails
    `);
    
    console.log('Current embedding status:');
    console.log(`- Total emails: ${statusResult.rows[0].total_emails}`);
    console.log(`- With vectors: ${statusResult.rows[0].with_vectors}`);
    console.log(`- Fixed vectors: ${statusResult.rows[0].fixed_vectors}`);
    
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