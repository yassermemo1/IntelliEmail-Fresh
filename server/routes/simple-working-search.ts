import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

/**
 * Simple, working search endpoints that bypass all routing conflicts
 */

// Search tasks - direct database query
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string;
    console.log(`🔍 SIMPLE TASK SEARCH: "${query}"`);
    
    if (!query || query.length < 2) {
      return res.json([]);
    }
    
    const searchPattern = `%${query}%`;
    const result = await pool.query(`
      SELECT id, title, description, priority, status, due_date as "dueDate", created_at as "createdAt"
      FROM tasks 
      WHERE user_id = 1
      AND (title ILIKE $1 OR description ILIKE $1)
      ORDER BY created_at DESC 
      LIMIT 20
    `, [searchPattern]);
    
    console.log(`✅ FOUND ${result.rows.length} tasks for "${query}"`);
    return res.json(result.rows);
  } catch (error) {
    console.error('❌ Task search error:', error);
    return res.json([]);
  }
});

// Search emails - direct database query
router.get('/emails', async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string;
    console.log(`🔍 SIMPLE EMAIL SEARCH: "${query}"`);
    
    if (!query || query.length < 2) {
      return res.json([]);
    }
    
    const searchPattern = `%${query}%`;
    const result = await pool.query(`
      SELECT e.id, e.subject, e.sender, e.timestamp as "date"
      FROM emails e
      JOIN email_accounts ea ON e.account_id = ea.id
      WHERE ea.user_id = 1
      AND (e.subject ILIKE $1 OR e.sender ILIKE $1 OR e.body ILIKE $1)
      ORDER BY e.timestamp DESC 
      LIMIT 20
    `, [searchPattern]);
    
    console.log(`✅ FOUND ${result.rows.length} emails for "${query}"`);
    return res.json(result.rows);
  } catch (error) {
    console.error('❌ Email search error:', error);
    return res.json([]);
  }
});

export default router;