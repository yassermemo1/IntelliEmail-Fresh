import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { insertTaskSchema } from '@shared/schema';
import { z } from 'zod';
import { log } from '../vite';
import { taskEmbeddingService } from '../services/taskEmbeddingService';

const router = Router();

/**
 * Get all tasks
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract query parameters
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const search = req.query.search as string | undefined;
    const priority = req.query.priority as string | undefined;

    // If search query is provided, use search function
    if (search) {
      const searchTasks = await storage.searchTasks(userId, search);
      
      // Apply priority filter if needed
      let filteredTasks = searchTasks;
      if (priority && priority !== 'all') {
        filteredTasks = searchTasks.filter(task => task.priority === priority);
      }
      
      return res.json(filteredTasks);
    }
    
    // If priority filter is provided without search
    if (priority && priority !== 'all') {
      const tasksByPriority = await storage.getTasksByPriority(userId, priority);
      return res.json(tasksByPriority);
    }

    // Get tasks for user (default)
    const tasks = await storage.getTasks(userId, limit, offset);
    return res.json(tasks);
  } catch (error) {
    log(`Error getting tasks: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to get tasks' });
  }
});

/**
 * Get tasks requiring review
 */
router.get('/review', async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get tasks requiring review
    const tasks = await storage.getTasksRequiringReview(userId);
    return res.json(tasks);
  } catch (error) {
    log(`Error getting tasks requiring review: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to get tasks requiring review' });
  }
});

/**
 * Get a single task by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id);
    
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }
    
    const task = await storage.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    return res.json(task);
  } catch (error) {
    log(`Error getting task: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to get task' });
  }
});

/**
 * Create a new task
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate request body
    const insertTaskInput = insertTaskSchema.extend({
      userId: z.number()
    }).safeParse({
      ...req.body,
      userId
    });

    if (!insertTaskInput.success) {
      return res.status(400).json({ 
        error: 'Invalid task data',
        details: insertTaskInput.error 
      });
    }

    // Create task
    const newTask = await storage.createTask(insertTaskInput.data);
    
    // Generate embedding for the task (don't await to not block the response)
    taskEmbeddingService.generateEmbeddingForTask(newTask.id)
      .then(success => {
        if (success) {
          log(`Successfully generated embedding for new task ${newTask.id}`);
        } else {
          log(`Failed to generate embedding for new task ${newTask.id}`, 'warn');
        }
      })
      .catch(error => {
        log(`Error generating embedding for new task ${newTask.id}: ${error.message}`, 'error');
      });
    
    return res.status(201).json(newTask);
  } catch (error) {
    log(`Error creating task: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * Update a task
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id);
    
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }
    
    // Get the task to check ownership
    const existingTask = await storage.getTask(taskId);
    
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Make sure the user owns the task
    const userId = req.session.user?.id;
    if (!userId || existingTask.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Update the task
    const updatedTask = await storage.updateTask(taskId, req.body);
    
    // If title or description was updated, regenerate the embedding
    if (req.body.title || req.body.description) {
      // Don't await to not block the response
      taskEmbeddingService.generateEmbeddingForTask(taskId)
        .then(success => {
          if (success) {
            log(`Successfully regenerated embedding for updated task ${taskId}`);
          } else {
            log(`Failed to regenerate embedding for updated task ${taskId}`, 'warn');
          }
        })
        .catch(error => {
          log(`Error regenerating embedding for updated task ${taskId}: ${error.message}`, 'error');
        });
    }
    
    return res.json(updatedTask);
  } catch (error) {
    log(`Error updating task: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * Delete a task
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id);
    
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }
    
    // Get the task to check ownership
    const existingTask = await storage.getTask(taskId);
    
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Make sure the user owns the task
    const userId = req.session.user?.id;
    if (!userId || existingTask.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Delete the task
    const deleted = await storage.deleteTask(taskId);
    
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete task' });
    }
    
    return res.json({ success: true });
  } catch (error) {
    log(`Error deleting task: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to delete task' });
  }
});

/**
 * Generate embeddings for tasks without them
 */
router.post('/generate-embeddings', async (req: Request, res: Response) => {
  try {
    const { limit = 100 } = req.body;
    
    // Start the embedding generation process
    const result = await taskEmbeddingService.generateEmbeddingsForTasks(limit);
    
    return res.json({
      success: true,
      stats: result,
      message: `Task embedding generation completed: ${result.processed} processed, ${result.successful} successful, ${result.failed} failed`
    });
  } catch (error) {
    log(`Error generating task embeddings: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to generate task embeddings' });
  }
});

/**
 * Extract tasks from emails using AI with configurable options
 */
router.post('/extract-from-emails', async (req: Request, res: Response) => {
  try {
    const { 
      limit = 100,
      daysBack = null,
      unprocessedOnly = true,
      modelOverride = null
    } = req.body;
    
    // Import the email task processing function
    const { processRecentEmails } = require('../processEmailTasks');
    
    // Process emails to extract tasks with the provided options
    const result = await processRecentEmails({
      limit: parseInt(limit),
      daysBack: daysBack ? parseInt(daysBack) : null,
      unprocessedOnly: !!unprocessedOnly,
      modelOverride: modelOverride || null
    });
    
    log(`Task extraction complete: Processed ${result.processed} emails, created ${result.taskCount} tasks`);
    
    return res.json({
      success: true,
      data: {
        processed: result.processed,
        taskCount: result.taskCount
      }
    });
  } catch (error) {
    log(`Error extracting tasks from emails: ${error.message}`, 'error');
    return res.status(500).json({ 
      success: false,
      message: 'Failed to extract tasks from emails'
    });
  }
});

export default router;