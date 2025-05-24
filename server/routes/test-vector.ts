/**
 * Test routes for verifying vector embedding functionality
 */
import { Router, Request, Response } from "express";
import { db } from "../db";
import { emails } from "@shared/schema";
import { sql } from "drizzle-orm";

const router = Router();

/**
 * Generate a test embedding vector for an email
 */
router.post('/generate-test-embedding/:emailId', async (req: Request, res: Response) => {
  try {
    const emailId = parseInt(req.params.emailId);
    
    // Generate a simple test embedding vector (768 dimensions)
    const testEmbedding = Array(768).fill(0).map((_, i) => (Math.sin(i * 0.1) + 1) / 2);
    const vectorString = `[${testEmbedding.join(',')}]`;
    
    // Update the email with the test embedding
    await db.execute(sql`
      UPDATE emails
      SET 
        embedding_vector = ${vectorString}::vector,
        embedding_generated_at = NOW(),
        metadata = jsonb_build_object(
          'embeddingGenerated', true,
          'embeddingDate', ${new Date().toISOString()},
          'embeddingSource', 'test',
          'embeddingDimensions', 768
        )
      WHERE id = ${emailId}
    `);
    
    return res.json({
      success: true,
      message: `Test embedding generated for email ${emailId}`,
      dimensions: 768
    });
  } catch (error) {
    console.error('Error generating test embedding:', error);
    return res.status(500).json({
      success: false,
      message: 'Error generating test embedding',
      error: error.message
    });
  }
});

/**
 * Verify embedding vector storage for an email
 */
router.get('/verify-embedding/:emailId', async (req: Request, res: Response) => {
  try {
    const emailId = parseInt(req.params.emailId);
    
    // Get the email with its embedding
    const result = await db.execute(sql`
      SELECT 
        id, 
        subject,
        array_length(embedding_vector::real[], 1) AS vector_dimensions,
        embedding_generated_at,
        metadata
      FROM emails
      WHERE id = ${emailId}
    `);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No email found with ID ${emailId}`
      });
    }
    
    return res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error verifying embedding:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying embedding',
      error: error.message
    });
  }
});

/**
 * Test a similarity search with a random vector
 */
router.post('/test-similarity-search', async (req: Request, res: Response) => {
  try {
    // Generate a random test vector (768 dimensions)
    const testVector = Array(768).fill(0).map(() => Math.random());
    const vectorString = `[${testVector.join(',')}]`;
    
    // Perform a similarity search
    const result = await db.execute(sql`
      SELECT 
        id,
        subject,
        embedding_vector <=> ${vectorString}::vector(768) AS cosine_distance,
        1 - (embedding_vector <=> ${vectorString}::vector(768)) AS cosine_similarity
      FROM emails
      WHERE embedding_vector IS NOT NULL 
      ORDER BY cosine_distance ASC
      LIMIT 5
    `);
    
    return res.json({
      success: true,
      results: result.rows
    });
  } catch (error) {
    console.error('Error performing similarity search:', error);
    return res.status(500).json({
      success: false,
      message: 'Error performing similarity search',
      error: error.message
    });
  }
});

/**
 * Get embedding stats
 */
router.get('/embedding-stats', async (req: Request, res: Response) => {
  try {
    // Get stats about embeddings in a way that works with the pgvector
    // This is safer as it avoids directly comparing vectors when they might have dimension inconsistencies
    const result = await db.execute(sql.raw(`
      SELECT 
        count(*) AS total_emails,
        count(CASE WHEN embedding_vector IS NOT NULL THEN 1 END) AS emails_with_embeddings,
        count(CASE WHEN embedding_vector IS NULL THEN 1 END) AS emails_without_embeddings,
        count(CASE WHEN metadata->>'embeddingGenerated' = 'true' THEN 1 END) AS with_embedding_metadata
      FROM emails
    `));
    
    // Get the most recent embeddings for verification
    const recentEmbeddings = await db.execute(sql.raw(`
      SELECT id, subject, embedding_generated_at,
        pg_column_size(embedding_vector) as vector_size_bytes,
        length(embedding_vector::text) as vector_text_length,
        metadata->>'embeddingSource' as source,
        metadata->>'embeddingDimensions' as dimensions
      FROM emails
      WHERE embedding_vector IS NOT NULL
      ORDER BY embedding_generated_at DESC NULLS LAST
      LIMIT 3
    `));
    
    return res.json({
      success: true,
      stats: result.rows[0],
      recentEmbeddings: recentEmbeddings.rows
    });
  } catch (error) {
    console.error('Error getting embedding stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting embedding stats',
      error: error.message
    });
  }
});

/**
 * Trigger embedding updates for a batch of emails
 */
router.post('/trigger-embedding-update', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string || '10');
  const { aiService } = require('../services');
  
  console.log(`Manually triggering embedding update for up to ${limit} emails`);
  try {
    const processedCount = await aiService.updateEmailEmbeddings(limit);
    
    res.json({
      success: true,
      processedCount,
      message: `Successfully processed ${processedCount} email embeddings`
    });
  } catch (error) {
    console.error('Error updating embeddings:', error);
    res.status(500).json({ 
      success: false, 
      error: (error as any).message 
    });
  }
});

/**
 * Verify the full RAG pipeline by processing a specific email through the complete chain:
 * 1. Generate embedding for the email
 * 2. Store properly in database
 * 3. Use embedding for semantic search
 * 4. Return full diagnostic information
 */
router.post('/verify-rag-pipeline/:emailId', async (req: Request, res: Response) => {
  try {
    const emailId = parseInt(req.params.emailId);
    const { aiService } = require('../services');
    
    // Step 1: Get the email
    const email = await db.execute(sql.raw(`
      SELECT * FROM emails WHERE id = ${emailId}
    `)).then(result => result.rows?.[0]);
    
    if (!email) {
      return res.status(404).json({
        success: false,
        message: `Email with ID ${emailId} not found`
      });
    }
    
    // Step 2: Generate and store embedding
    console.log(`Generating embedding for email ${emailId}`);
    
    // Create text to embed
    const bodyLength = (email.body || "").length;
    const textToEmbed = `Subject: ${email.subject || ""}\n\nBody: ${
      bodyLength > 20000 ? (email.body || "").substring(0, 20000) + "... [content truncated]" : (email.body || "")
    }`;
    
    // Step 3: Generate embedding
    console.log(`Generating embeddings for text length: ${textToEmbed.length}`);
    const embedding = await aiService.generateEmbedding(textToEmbed);
    
    console.log(`Generated embedding with ${embedding.length} dimensions`);
    
    // Step 4: Store embedding using a safe method
    const vectorString = `[${embedding.join(',')}]`;
    const dateString = new Date().toISOString();
    
    // Use raw SQL to ensure proper vector storage
    await db.execute(sql.raw(`
      UPDATE emails
      SET 
        embedding_vector = '${vectorString}'::vector(768),
        embedding_generated_at = NOW(),
        metadata = jsonb_build_object(
          'embeddingGenerated', true,
          'embeddingDate', '${dateString}',
          'embeddingTruncated', ${bodyLength > 20000},
          'embeddingDimensions', ${embedding.length},
          'embeddingSource', 'verification-test',
          'embeddingPadded', ${embedding.length != 768}
        )
      WHERE id = ${emailId}
    `));
    
    // Step 5: Verify storage by retrieving it back
    const verificationResult = await db.execute(sql.raw(`
      SELECT 
        id, subject, embedding_generated_at,
        pg_column_size(embedding_vector) as vector_size_bytes,
        length(embedding_vector::text) as vector_text_length,
        metadata
      FROM emails
      WHERE id = ${emailId}
    `)).then(result => result.rows?.[0]);
    
    // Step 6: Test semantic search with this embedding
    const similarEmailsResult = await db.execute(sql.raw(`
      SELECT 
        id, subject,
        embedding_vector <=> '${vectorString}'::vector(768) AS similarity_distance
      FROM emails
      WHERE embedding_vector IS NOT NULL 
        AND id != ${emailId}
      ORDER BY similarity_distance ASC
      LIMIT 5
    `)).then(result => result.rows);
    
    return res.json({
      success: true,
      message: "RAG pipeline verification complete",
      email: {
        id: email.id,
        subject: email.subject,
        bodyLength: bodyLength
      },
      embedding: {
        dimensions: embedding.length,
        firstFewValues: embedding.slice(0, 5),
        lastFewValues: embedding.slice(-5)
      },
      storage: verificationResult,
      similarEmails: similarEmailsResult
    });
    
  } catch (error) {
    console.error('Error during RAG pipeline verification:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying RAG pipeline',
      error: (error as any).message
    });
  }
});

export default router;