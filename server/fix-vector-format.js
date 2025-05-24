/**
 * Direct fix for pgvector formatting issues
 * This script ensures all vectors are properly wrapped in square brackets
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { WebSocket } from 'ws';

// Configure WebSocket for neon
neonConfig.webSocketConstructor = WebSocket;

async function fixPgVectorFormat() {
  console.log("🔧 Starting vector format fix...");
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Check connection
    await pool.query('SELECT 1');
    console.log("✅ Connected to database");
    
    // Check how many emails have embeddings
    const statusQuery = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(embedding_vector) as with_embeddings,
        COUNT(CASE WHEN embedding_vector::text LIKE '[%' THEN 1 END) as proper_format
      FROM emails
    `);
    
    const { total, with_embeddings, proper_format } = statusQuery.rows[0];
    
    console.log(`Total emails: ${total}`);
    console.log(`Emails with embeddings: ${with_embeddings}`);
    console.log(`Emails with proper vector format: ${proper_format}`);
    
    const needsFix = with_embeddings - proper_format;
    console.log(`Emails needing format fix: ${needsFix}`);
    
    if (needsFix > 0) {
      // Fix vectors that don't start with square bracket
      console.log("Fixing vectors that don't start with '['...");
      
      const fixBracketsQuery = `
        UPDATE emails
        SET embedding_vector = concat('[', regexp_replace(embedding_vector::text, '^(?!\\[)(.*)', '\\1'), ']')::vector
        WHERE embedding_vector IS NOT NULL
        AND embedding_vector::text NOT LIKE '[%'
      `;
      
      const fixResult = await pool.query(fixBracketsQuery);
      console.log(`Fixed ${fixResult.rowCount} vectors`);
    } else {
      console.log("No vector format issues found.");
    }
    
    // Verify fix
    const verifyQuery = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(embedding_vector) as with_embeddings,
        COUNT(CASE WHEN embedding_vector::text LIKE '[%' THEN 1 END) as proper_format
      FROM emails
    `);
    
    const verifyResult = verifyQuery.rows[0];
    console.log("\n📊 VERIFICATION RESULTS:");
    console.log(`Total emails: ${verifyResult.total}`);
    console.log(`Emails with embeddings: ${verifyResult.with_embeddings}`);
    console.log(`Emails with proper vector format: ${verifyResult.proper_format}`);
    
    if (verifyResult.with_embeddings === verifyResult.proper_format) {
      console.log("✅ SUCCESS: All vectors are now properly formatted!");
    } else {
      console.log("❌ WARNING: Some vectors may still have formatting issues");
    }
    
  } catch (error) {
    console.error("Error fixing vector format:", error);
  } finally {
    await pool.end();
    console.log("Database connection closed");
  }
}

// Run the fix function
fixPgVectorFormat()
  .then(() => console.log("Vector format fix completed"))
  .catch(error => console.error("Error:", error));