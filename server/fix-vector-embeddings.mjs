/**
 * Direct script to fix vector embeddings
 * Run this with: node server/fix-vector-embeddings.mjs
 */
import { Pool } from '@neondatabase/serverless';
import { OpenAI } from 'openai';
import * as ws from 'ws';
// No need for dotenv as we're in a Replit environment

// Environment variables already loaded in Replit

// Configure neon to use WebSocket
import { neonConfig } from '@neondatabase/serverless';
neonConfig.webSocketConstructor = ws.WebSocket;

// Initialize database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
  try {
    console.log('Starting vector database fix process...');
    
    // Step 1: Ensure pgvector extension is installed
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('Verified pgvector extension is installed');
    
    // Step 2: Find a test email to process
    const { rows: testEmails } = await pool.query(
      `SELECT id, subject FROM emails WHERE embedding_vector IS NULL LIMIT 1`
    );
    
    if (testEmails.length === 0) {
      console.log('No emails found without embeddings');
      return;
    }
    
    const testEmail = testEmails[0];
    console.log(`Found test email ID ${testEmail.id}: "${testEmail.subject}"`);
    
    // Step 3: Get the email content
    const { rows: emailContent } = await pool.query(
      `SELECT id, subject, body FROM emails WHERE id = $1`,
      [testEmail.id]
    );
    
    if (emailContent.length === 0) {
      console.log('Email content not found');
      return;
    }
    
    const email = emailContent[0];
    const textToEmbed = `Subject: ${email.subject || ""}\n\nBody: ${
      (email.body || "").length > 8000 
        ? (email.body || "").substring(0, 8000) + "... [content truncated]" 
        : (email.body || "")
    }`;
    
    // Step 4: Generate embedding using OpenAI
    console.log('Generating test embedding with OpenAI...');
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: textToEmbed,
    });
    
    const embedding = embeddingResponse.data[0].embedding;
    console.log(`Generated embedding with ${embedding.length} dimensions`);
    
    // Step 5: Format the embedding for pgvector
    const vectorString = `[${embedding.join(',')}]`;
    console.log(`Vector string format: ${vectorString.substring(0, 30)}...`);
    
    // Step 6: Update the database with properly formatted vector
    console.log('Storing properly formatted vector embedding...');
    await pool.query(
      `UPDATE emails 
       SET embedding_vector = $1::vector,
           metadata = jsonb_build_object(
             'embeddingGenerated', true,
             'embeddingDate', $2,
             'embeddingDimensions', $3,
             'embeddingFixed', true
           )
       WHERE id = $4`,
      [vectorString, new Date().toISOString(), embedding.length, email.id]
    );
    
    console.log(`Successfully updated embedding for email ${email.id}`);
    
    // Step 7: Verify the updated embedding
    const { rows: updated } = await pool.query(
      `SELECT id, metadata FROM emails WHERE id = $1 AND embedding_vector IS NOT NULL`,
      [email.id]
    );
    
    if (updated.length > 0) {
      console.log('Verification successful! Vector embedding is now properly stored.');
      console.log(`Email metadata: ${JSON.stringify(updated[0].metadata)}`);
      console.log('\nThe implementation has been fixed. You can now run:');
      console.log('  curl -X POST http://localhost:5000/api/ai/process-all-remaining -H "Content-Type: application/json" -d \'{"batchSize": 50}\'');
      console.log('to process the remaining emails with embeddings.');
    } else {
      console.log('Verification failed. The embedding was not properly stored.');
    }
    
  } catch (error) {
    console.error('Error in fix process:', error);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Run the script
main().catch(console.error);