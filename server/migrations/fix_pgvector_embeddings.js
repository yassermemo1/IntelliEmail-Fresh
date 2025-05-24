/**
 * Direct script to fix vector embeddings format
 * This uses a direct database connection to ensure vector embeddings are properly formatted
 */
const { Pool } = require('@neondatabase/serverless');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Starting vector embedding format fix...');
    
    // First, ensure pgvector extension exists
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS vector;
    `);
    
    console.log('Vector extension verified');
    
    // Fix embedding format issues by getting embedding sample
    const sampleResult = await pool.query(`
      SELECT id FROM emails 
      WHERE embedding_vector IS NULL 
      LIMIT 1
    `);
    
    if (sampleResult.rows.length === 0) {
      console.log('No emails without embeddings found');
      return;
    }
    
    const sampleId = sampleResult.rows[0].id;
    console.log(`Found email ${sampleId} without embedding`);
    
    // Get OpenAI embedding for this email
    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Get the email content
    const emailResult = await pool.query(`
      SELECT id, subject, body FROM emails WHERE id = $1
    `, [sampleId]);
    
    if (emailResult.rows.length === 0) {
      console.log('Email not found');
      return;
    }
    
    const email = emailResult.rows[0];
    const content = `Subject: ${email.subject || ""}\n\nBody: ${email.body || ""}`;
    
    // Generate embedding
    console.log('Generating embedding via OpenAI...');
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: content.substring(0, 8000), // Truncate to avoid token limits
    });
    
    const embedding = embeddingResponse.data[0].embedding;
    console.log(`Generated embedding with ${embedding.length} dimensions`);
    
    // Insert properly formatted embedding
    const vectorString = `[${embedding.join(',')}]`;
    
    await pool.query(`
      UPDATE emails
      SET embedding_vector = $1::vector,
          metadata = jsonb_build_object(
            'embeddingGenerated', true,
            'embeddingDate', $2,
            'embeddingDimensions', $3,
            'embeddingFixed', true
          )
      WHERE id = $4
    `, [vectorString, new Date().toISOString(), embedding.length, sampleId]);
    
    console.log(`Successfully updated embedding for email ${sampleId}`);
    console.log('Vector embedding fix complete');
    
  } catch (error) {
    console.error('Error fixing vector embeddings:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };