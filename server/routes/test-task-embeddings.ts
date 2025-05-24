import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { log } from '../vite';
import { db } from '../db';
import { tasks } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

const router = Router();

/**
 * Test endpoint to create a task and verify its embedding is generated
 */
router.post('/create-with-embedding', async (req: Request, res: Response) => {
  try {
    // Create a test task
    const testTask = {
      userId: req.session.user?.id || 1,
      title: req.body.title || 'Test Task with Embedding',
      description: req.body.description || 'This is a test task to verify the embedding generation pipeline is working correctly.',
      priority: 'medium',
      isCompleted: false,
      needsReview: false
    };
    
    log('Creating test task to verify embedding generation pipeline');
    
    // Create task in the database
    const newTask = await storage.createTask(testTask);
    
    // Wait a moment for the asynchronous embedding generation to complete
    setTimeout(async () => {
      try {
        // Check if the embedding was generated
        const result = await db.execute(sql`
          SELECT 
            id, 
            title, 
            embedding_vector IS NOT NULL AS has_embedding,
            array_length(embedding_vector::real[], 1) AS embedding_dimensions 
          FROM tasks 
          WHERE id = ${newTask.id}
        `);
        
        const taskWithEmbedding = result.rows[0];
        
        if (taskWithEmbedding) {
          // Send the result with embedding information
          res.json({
            success: true,
            task: newTask,
            embedding_verification: taskWithEmbedding
          });
        } else {
          res.json({
            success: true,
            task: newTask,
            embedding_verification: {
              has_embedding: false,
              message: 'Task created but embedding verification failed'
            }
          });
        }
      } catch (error) {
        log(`Error checking embedding: ${error.message}`, 'error');
        res.json({
          success: true,
          task: newTask,
          embedding_verification: {
            has_embedding: 'unknown',
            error: error.message
          }
        });
      }
    }, 2000); // Wait 2 seconds for embedding generation
  } catch (error) {
    log(`Error in test task creation: ${error.message}`, 'error');
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create test task',
      details: error.message
    });
  }
});

/**
 * Check embeddings for existing tasks
 */
router.get('/verify-embeddings', async (req: Request, res: Response) => {
  try {
    // Get tasks with embedding verification
    const result = await db.execute(sql`
      SELECT 
        id, 
        title, 
        embedding_vector IS NOT NULL AS has_embedding,
        array_length(embedding_vector::real[], 1) AS embedding_dimensions 
      FROM tasks 
      ORDER BY id DESC
      LIMIT 10
    `);
    
    res.json({
      success: true,
      tasks_with_embeddings: result.rows
    });
  } catch (error) {
    log(`Error verifying embeddings: ${error.message}`, 'error');
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify task embeddings',
      details: error.message
    });
  }
});

/**
 * Regenerate embeddings for specified tasks or all tasks
 */
router.post('/regenerate-embeddings', async (req: Request, res: Response) => {
  try {
    // Import the task embedding service
    const { taskEmbeddingService } = await import('../services');
    
    const taskIds = req.body.taskIds || [];
    const regenerateAll = req.body.regenerateAll === true;
    
    if (!regenerateAll && (!taskIds || taskIds.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'You must provide taskIds or set regenerateAll to true'
      });
    }
    
    if (regenerateAll) {
      // Process all tasks that need embeddings
      const stats = await taskEmbeddingService.generateEmbeddingsForTasks(100);
      
      return res.json({
        success: true,
        message: 'Started regenerating embeddings for all tasks',
        stats
      });
    } else {
      // Process only specified task IDs
      const results = [];
      
      for (const taskId of taskIds) {
        const success = await taskEmbeddingService.generateEmbeddingForTask(taskId);
        results.push({
          taskId,
          success
        });
      }
      
      return res.json({
        success: true,
        message: 'Regenerated embeddings for specified tasks',
        results
      });
    }
  } catch (error) {
    log(`Error regenerating embeddings: ${error.message}`, 'error');
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate embeddings',
      details: error.message
    });
  }
});

export default router;