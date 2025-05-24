import { Router, Request, Response } from "express";
import { adaptationLearningService } from "../services/adaptationLearningService";
import { log } from "../vite";

const router = Router();

/**
 * Initialize the Adaptive Learning System
 * This creates the necessary tables if they don't exist
 */
router.post('/initialize', async (req: Request, res: Response) => {
  try {
    const result = await adaptationLearningService.initialize();
    return res.status(200).json({ success: result });
  } catch (error) {
    log(`Error initializing Adaptive Learning System: ${error.message}`, "error");
    return res.status(500).json({ error: 'Failed to initialize Adaptive Learning System' });
  }
});

/**
 * Process feedback for a user to update their adaptation profile
 */
router.post('/process-feedback/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const result = await adaptationLearningService.processUserFeedback(userId);
    return res.status(200).json(result);
  } catch (error) {
    log(`Error processing user feedback: ${error.message}`, "error");
    return res.status(500).json({ error: 'Failed to process user feedback' });
  }
});

/**
 * Get suggested rules for a user
 */
router.get('/suggested-rules/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const rules = await adaptationLearningService.getSuggestedRules(userId);
    return res.status(200).json(rules);
  } catch (error) {
    log(`Error getting suggested rules: ${error.message}`, "error");
    return res.status(500).json({ error: 'Failed to get suggested rules' });
  }
});

/**
 * Update rule status (accept or decline)
 */
router.put('/rule/:ruleId', async (req: Request, res: Response) => {
  try {
    const ruleId = parseInt(req.params.ruleId);
    const { status } = req.body;
    
    if (isNaN(ruleId)) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }
    
    if (!status || !['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "accepted" or "declined"' });
    }
    
    const result = await adaptationLearningService.updateRuleStatus(ruleId, status);
    return res.status(200).json({ success: result });
  } catch (error) {
    log(`Error updating rule status: ${error.message}`, "error");
    return res.status(500).json({ error: 'Failed to update rule status' });
  }
});

/**
 * Reset user adaptation profile
 */
router.post('/reset-profile/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const result = await adaptationLearningService.resetUserProfile(userId);
    return res.status(200).json({ success: result });
  } catch (error) {
    log(`Error resetting user profile: ${error.message}`, "error");
    return res.status(500).json({ error: 'Failed to reset user profile' });
  }
});

export default router;