import { Router, Request, Response } from "express";
import { feedbackService } from "../services/feedbackService";
import { tasks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";

const router = Router();

/**
 * Log feedback from HITL review
 * This is called when a user approves, rejects, or modifies a task during review
 */
router.post('/hitl-review', async (req: Request, res: Response) => {
  try {
    const { userId, taskId, action, originalTask, correctedTask } = req.body;
    
    if (!userId || !taskId || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate action type
    if (!['approved', 'rejected', 'modified'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action type' });
    }
    
    const result = await feedbackService.logHitlReviewAction(
      userId,
      taskId,
      action as any,
      originalTask || {},
      correctedTask
    );
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error logging HITL review:', error);
    return res.status(500).json({ error: 'Failed to log HITL review' });
  }
});

/**
 * Log user interaction with a task (edit, priority change, due date change, etc.)
 */
router.post('/task-interaction', async (req: Request, res: Response) => {
  try {
    const { userId, taskId, interactionType, previousValue, newValue } = req.body;
    
    if (!userId || !taskId || !interactionType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await feedbackService.logTaskModification(
      userId,
      taskId,
      interactionType,
      previousValue || {},
      newValue || {}
    );
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error logging task interaction:', error);
    return res.status(500).json({ error: 'Failed to log task interaction' });
  }
});

/**
 * Log task lifecycle events (completion, deletion)
 */
router.post('/task-lifecycle', async (req: Request, res: Response) => {
  try {
    const { userId, taskId, eventType, previousState } = req.body;
    
    if (!userId || !taskId || !eventType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate event type
    if (!['completed', 'deleted'].includes(eventType)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }
    
    const result = await feedbackService.logTaskLifecycleEvent(
      userId,
      taskId,
      eventType as any,
      previousState || {}
    );
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error logging task lifecycle event:', error);
    return res.status(500).json({ error: 'Failed to log task lifecycle event' });
  }
});

/**
 * Get feedback and interactions for a specific task
 */
router.get('/task/:taskId', async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }
    
    const result = await feedbackService.getTaskFeedbackAndInteractions(taskId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error retrieving task feedback:', error);
    return res.status(500).json({ error: 'Failed to retrieve task feedback' });
  }
});

/**
 * Get feedback for a specific user
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const feedback = await feedbackService.getUserFeedback(userId, limit);
    const interactions = await feedbackService.getUserTaskInteractions(userId, limit);
    
    return res.status(200).json({
      feedback,
      interactions
    });
  } catch (error) {
    console.error('Error retrieving user feedback:', error);
    return res.status(500).json({ error: 'Failed to retrieve user feedback' });
  }
});

export default router;