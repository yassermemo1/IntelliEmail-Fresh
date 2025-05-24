/**
 * Test endpoints for verifying functionality
 * These endpoints are designed for testing purposes only
 */

import { Router, Request, Response } from 'express';
import { aiModelService } from '../services/aiModelService';
import { aiService } from '../services/aiService';
import { pool, db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * Test AI settings GET endpoint
 */
router.get('/ai-settings', async (req: Request, res: Response) => {
  try {
    // For demo purposes, use user ID 1
    const userId = 1;
    const settings = await aiModelService.getAiSettings(userId);
    
    res.json({
      success: true,
      data: settings,
      message: 'AI settings retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting AI settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting AI settings',
      error: error.message
    });
  }
});

/**
 * Test AI settings update endpoint
 */
router.post('/ai-settings', async (req: Request, res: Response) => {
  try {
    // For demo purposes, use user ID 1
    const userId = 1;
    
    // Use a fixed set of settings for testing
    const newSettings = {
      selectedProvider: 'openai',
      selectedModelId: 'gpt-4o',
      ollamaEndpoint: 'http://localhost:11434',
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      anthropicApiKey: '',
      perplexityApiKey: '',
      autoExtractTasks: true
    };
    
    const updatedSettings = await aiModelService.updateAiSettings(userId, newSettings);
    
    res.json({
      success: true,
      data: updatedSettings,
      message: 'AI settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating AI settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating AI settings',
      error: error.message
    });
  }
});

/**
 * Test vector embedding functionality
 */
router.get('/vector-test', async (req: Request, res: Response) => {
  try {
    const testText = 'This is a test embedding generation for vector database verification';
    let embedding: number[] = [];
    
    try {
      // Generate a test embedding
      embedding = await aiService.generateEmbedding(testText);
      
      res.json({
        success: true,
        embedding_size: embedding.length,
        embedding_sample: embedding.slice(0, 10),
        message: 'Test embedding generated successfully'
      });
    } catch (embeddingError) {
      res.status(500).json({
        success: false,
        message: 'Error generating test embedding',
        error: embeddingError.message
      });
    }
  } catch (error) {
    console.error('Error in vector test:', error);
    res.status(500).json({
      success: false,
      message: 'Error in vector test',
      error: error.message
    });
  }
});

/**
 * Get overall system status
 */
router.get('/system-status', async (req: Request, res: Response) => {
  try {
    // Check database connectivity
    const dbCheck = await pool.query('SELECT 1 as connected');
    
    // Get email count
    const emailCount = await db
      .select({ count: sql`count(*)` })
      .from(sql`emails`);
    
    // Get embedding stats
    const embeddings = await db
      .select({
        total: sql`count(*)`,
        with_embeddings: sql`count(case when embedding_vector is not null then 1 end)`,
        percent_complete: sql`(count(case when embedding_vector is not null then 1 end) * 100.0 / count(*))`
      })
      .from(sql`emails`);
    
    // Get task count
    const taskCount = await db
      .select({ count: sql`count(*)` })
      .from(sql`tasks`);
    
    res.json({
      success: true,
      database: {
        connected: dbCheck.rows[0].connected === 1,
      },
      data: {
        emails: parseInt(emailCount[0]?.count?.toString() || '0'),
        tasks: parseInt(taskCount[0]?.count?.toString() || '0'),
        embeddings: {
          total: parseInt(embeddings[0]?.total?.toString() || '0'),
          with_embeddings: parseInt(embeddings[0]?.with_embeddings?.toString() || '0'),
          percent_complete: parseFloat(embeddings[0]?.percent_complete?.toString() || '0').toFixed(2)
        }
      },
      message: 'System status retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting system status:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting system status',
      error: error.message
    });
  }
});

export default router;