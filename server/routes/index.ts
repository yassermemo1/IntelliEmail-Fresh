import { Router } from 'express';
import { extractTasksFromEmails } from './task-extraction';

const router = Router();

// Register task extraction route directly
router.post('/tasks/extract-from-emails', extractTasksFromEmails);

export default router;