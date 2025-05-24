/**
 * Direct script to fix vector embeddings
 * Run this with: node server/fix-vector-embeddings.js
 */
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

async function main() {
  console.log('Starting vector embedding fix...');
  
  // Initialize database connection
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // First make sure pgvector extension is installed
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('Verified pgvector extension is installed');
    
    // Check pgvector version
    const versionResult = await pool.query(`SELECT extversion FROM pg_extension WHERE extname = 'vector';`);
    const version = versionResult.rows[0]?.extversion;
    console.log(`Current pgvector version: ${version}`);
    
    // Step 1: Fix column type if needed
    try {
      await pool.query(`
        ALTER TABLE emails 
        ALTER COLUMN embedding_vector TYPE vector(768) 
        USING NULL::vector(768);
      `);
      console.log('Updated embedding_vector column to vector(768) type');
    } catch (error) {
      if (error.message.includes('already has type')) {
        console.log('embedding_vector already has correct type');
      } else {
        console.error('Error fixing column type:', error.message);
      }
    }
    
    // Step 2: Sample embedding generation to test
    // Get a sample email without embedding
    const sampleResult = await pool.query(`
      SELECT id, subject, body FROM emails 
      WHERE embedding_vector IS NULL 
      LIMIT 1
    `);
    
    if (sampleResult.rows.length === 0) {
      console.log('No emails without embeddings found');
      return;
    }
    
    const sampleEmail = sampleResult.rows[0];
    console.log(`Found sample email id ${sampleEmail.id} without embedding`);
    
    // Generate a sample vector (768 dimensions)
    const sampleVector = Array(768).fill(0).map(() => (Math.random() - 0.5) * 0.01);
    
    // Format for pgvector storage
    const vectorString = `[${sampleVector.join(',')}]`;
    
    // Step 3: Test storing the vector
    try {
      await pool.query(`
        UPDATE emails
        SET 
          embedding_vector = $1::vector(768),
          embedding_generated_at = NOW(),
          metadata = jsonb_build_object(
            'embeddingFixedAt', NOW(),
            'embeddingDimensions', 768,
            'embeddingSource', 'test-fix'
          )
        WHERE id = $2
      `, [vectorString, sampleEmail.id]);
      
      console.log(`Successfully stored test vector for email ${sampleEmail.id}`);
      
      // Verify it worked
      const verifyResult = await pool.query(`
        SELECT embedding_vector IS NOT NULL as has_embedding
        FROM emails
        WHERE id = $1
      `, [sampleEmail.id]);
      
      if (verifyResult.rows[0]?.has_embedding) {
        console.log('✅ Vector storage confirmed successful');
      } else {
        console.log('❌ Vector not properly stored');
      }
      
    } catch (storeError) {
      console.error('Error storing test vector:', storeError.message);
    }
    
    console.log('Vector embedding fix completed');
  } catch (error) {
    console.error('Error fixing vector embeddings:', error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);