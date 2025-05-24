const express = require('express');
const router = express.Router();
const { Pool } = require('@neondatabase/serverless');
const OpenAI = require('openai');

// Setup db connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Setup OpenAI connection
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Test endpoint to verify and fix vector embeddings
 */
router.post('/test-embedding', async (req, res) => {
  try {
    // Create a test email and try to generate an embedding
    const text = "This is a test email for embedding generation";
    console.log("Generating test embedding...");
    
    // Generate embedding using OpenAI
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    
    const embedding = response.data[0].embedding;
    console.log(`Generated embedding with ${embedding.length} dimensions`);
    
    // Format embedding for pgvector
    const vectorString = `[${embedding.join(',')}]`;
    console.log(`Embedding formatted as string. First 20 chars: ${vectorString.substring(0, 20)}...`);
    
    // First, ensure pgvector extension is installed
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    
    // Get a sample email ID to update
    const sampleResult = await pool.query(
      `SELECT id FROM emails WHERE embedding_vector IS NULL LIMIT 1`
    );
    
    if (sampleResult.rows.length === 0) {
      return res.json({
        success: true,
        message: "No emails found without embeddings",
        embedding: embedding
      });
    }
    
    const sampleId = sampleResult.rows[0].id;
    console.log(`Using sample email ID: ${sampleId}`);
    
    // Update the sample email with the test embedding
    await pool.query(
      `UPDATE emails 
       SET embedding_vector = $1::vector,
           metadata = jsonb_build_object(
             'embeddingGenerated', true,
             'embeddingDate', $2,
             'embeddingDimensions', $3,
             'testEmbedding', true
           )
       WHERE id = $4`,
      [vectorString, new Date().toISOString(), embedding.length, sampleId]
    );
    
    return res.json({
      success: true,
      message: `Successfully updated email ${sampleId} with test embedding`,
      embeddingLength: embedding.length,
      emailId: sampleId
    });
    
  } catch (error) {
    console.error('Error in test-embedding:', error);
    return res.status(500).json({
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;