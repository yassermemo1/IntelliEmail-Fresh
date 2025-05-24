import { Router, Request, Response } from 'express';
import { db } from "../db";
import { sql } from "drizzle-orm";
import { AiService } from "../services/aiService";
import { EmailChainService } from "../services/emailChainService";
import { emails } from "@shared/schema";

const router = Router();

/**
 * Test endpoints for embedding generation and vector operations
 */

/**
 * Test endpoint for embedding generation with different providers
 * Useful for verifying the embedding dimensions and format
 */
router.post('/generate-embedding', async (req: Request, res: Response) => {
  try {
    const { text = "This is a test sentence for embedding generation.", provider } = req.body;
    const aiService = new AiService();
    
    // Set the provider for this test if specified (openai or ollama)
    const originalProvider = process.env.EMBEDDING_PROVIDER;
    if (provider) {
      process.env.EMBEDDING_PROVIDER = provider;
    }
    
    console.log(`Generating test embedding for text (${text.length} chars) with provider: ${process.env.EMBEDDING_PROVIDER || 'openai'}`);
    
    const startTime = Date.now();
    const embedding = await aiService.generateEmbedding(text);
    const duration = Date.now() - startTime;
    
    // Restore original provider setting
    if (provider) {
      process.env.EMBEDDING_PROVIDER = originalProvider;
    }
    
    res.json({
      success: true,
      provider: process.env.EMBEDDING_PROVIDER || 'openai',
      dimensionCount: embedding.length,
      sampleValues: embedding.slice(0, 5), // Just show first 5 values
      duration: `${duration}ms`,
      text: text.length > 100 ? `${text.substring(0, 100)}...` : text
    });
  } catch (error) {
    console.error("Error in embedding generation test:", error);
    res.status(500).json({ 
      error: "Embedding generation test failed", 
      message: error.message 
    });
  }
});

/**
 * Verify embedding vectors in the database
 * Returns information about vector dimensions and properties
 */
router.get('/vector-stats', async (req: Request, res: Response) => {
  try {
    // Get counts of emails with and without embeddings
    const counts = await db.execute(sql`
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE embedding_vector IS NOT NULL) AS with_embedding,
        COUNT(*) FILTER (WHERE embedding_vector IS NULL) AS without_embedding
      FROM emails
    `);
    
    // Get dimension stats for a sample email with embedding
    let dimensionInfo = null;
    const sampleEmail = await db.execute(sql`
      SELECT id, subject FROM emails 
      WHERE embedding_vector IS NOT NULL 
      LIMIT 1
    `);
    
    const sample = Array.isArray(sampleEmail) && sampleEmail.length > 0 
      ? sampleEmail[0] 
      : (sampleEmail?.rows && sampleEmail.rows.length > 0 ? sampleEmail.rows[0] : null);
    
    if (sample) {
      const vectorDimension = await db.execute(sql`
        SELECT array_length(embedding_vector::real[], 1) AS dimension
        FROM emails WHERE id = ${sample.id}
      `);
      
      const dimension = Array.isArray(vectorDimension) && vectorDimension.length > 0 
        ? vectorDimension[0] 
        : (vectorDimension?.rows && vectorDimension.rows.length > 0 ? vectorDimension.rows[0] : null);
      
      dimensionInfo = {
        sampleEmailId: sample.id,
        sampleSubject: sample.subject,
        dimension: dimension?.dimension
      };
    }
    
    const countData = Array.isArray(counts) && counts.length > 0 
      ? counts[0] 
      : (counts?.rows && counts.rows.length > 0 ? counts.rows[0] : { total: 0, with_embedding: 0, without_embedding: 0 });
    
    res.json({
      counts: {
        total: parseInt(countData.total || '0'),
        withEmbedding: parseInt(countData.with_embedding || '0'),
        withoutEmbedding: parseInt(countData.without_embedding || '0'),
        percentage: countData.total > 0 
          ? Math.round((parseInt(countData.with_embedding || '0') / parseInt(countData.total || '1')) * 100) 
          : 0
      },
      vectorInfo: dimensionInfo
    });
  } catch (error) {
    console.error("Error getting vector stats:", error);
    res.status(500).json({ error: "Failed to retrieve vector statistics" });
  }
});

/**
 * Test vector similarity search for a specific email
 */
router.get('/vector-similarity/:emailId', async (req: Request, res: Response) => {
  try {
    const emailId = parseInt(req.params.emailId, 10);
    if (isNaN(emailId)) {
      return res.status(400).json({ error: "Invalid email ID" });
    }
    
    // Get email data
    const emailData = await db.execute(sql`
      SELECT id, subject, sender, embedding_vector IS NOT NULL as has_embedding
      FROM emails WHERE id = ${emailId}
    `);
    
    const email = Array.isArray(emailData) && emailData.length > 0 
      ? emailData[0] 
      : (emailData?.rows && emailData.rows.length > 0 ? emailData.rows[0] : null);
    
    if (!email) {
      return res.status(404).json({ error: "Email not found" });
    }
    
    if (!email.has_embedding) {
      return res.status(400).json({ 
        error: "Email has no embedding vector",
        emailInfo: {
          id: email.id,
          subject: email.subject,
          sender: email.sender
        }
      });
    }
    
    // Get vector dimension
    const dimensionQuery = await db.execute(sql`
      SELECT array_length(embedding_vector::real[], 1) AS dimension
      FROM emails WHERE id = ${emailId}
    `);
    
    const dimension = Array.isArray(dimensionQuery) && dimensionQuery.length > 0 
      ? dimensionQuery[0] 
      : (dimensionQuery?.rows && dimensionQuery.rows.length > 0 ? dimensionQuery.rows[0] : null);
    
    // Get related emails using EmailChainService
    const emailChainService = new EmailChainService();
    const relatedEmails = await emailChainService.findRelatedEmails(emailId, undefined, 5);
    
    // Get raw similarity using vector operations
    const rawSimilarityQuery = await db.execute(sql`
      WITH source_email AS (
        SELECT embedding_vector FROM emails WHERE id = ${emailId}
      )
      SELECT 
        e.id, 
        e.subject,
        (1 - (e.embedding_vector <=> (SELECT embedding_vector FROM source_email))) AS similarity_score
      FROM emails e, source_email
      WHERE e.id != ${emailId} AND e.embedding_vector IS NOT NULL
      ORDER BY similarity_score DESC
      LIMIT 5
    `);
    
    const rawSimilarity = Array.isArray(rawSimilarityQuery) 
      ? rawSimilarityQuery 
      : (rawSimilarityQuery?.rows || []);
    
    res.json({
      sourceEmail: {
        id: email.id,
        subject: email.subject,
        sender: email.sender,
        vectorDimension: dimension?.dimension
      },
      relatedEmails: relatedEmails.map(e => ({
        id: e.id,
        subject: e.subject,
        relationshipType: e.relation_type,
        similarityScore: e.similarity_score
      })),
      rawVectorSimilarity: rawSimilarity.map(e => ({
        id: e.id,
        subject: e.subject,
        similarityScore: Math.round(parseFloat(e.similarity_score) * 100)
      }))
    });
  } catch (error) {
    console.error("Error in vector similarity test:", error);
    res.status(500).json({ 
      error: "Vector similarity test failed", 
      message: error.message 
    });
  }
});

export default router;