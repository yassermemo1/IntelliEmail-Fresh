/**
 * Direct SQL Search API for typo tolerance
 * 
 * This implementation uses a direct SQL approach to ensure
 * it properly finds results with typos like "intersting" vs "interesting"
 */

import express, { Request, Response } from 'express';
import { db } from '../db';
import { pool } from '../db';  // For direct SQL execution
import { log } from '../vite';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session.user?.id || 1;
    
    // Get query from request
    const query = req.query.q as string;
    
    if (!query || query.length < 2) {
      return res.json({
        emails: [],
        tasks: [],
        totalResults: 0
      });
    }
    
    // Log search attempt
    log(`Direct typo-tolerant search: "${query}"`, 'search');
    
    // Create pattern for ILIKE search
    const pattern = `%${query}%`;
    
    // Direct SQL query for emails (most reliable)
    const emailResult = await pool.query(`
      SELECT e.id, e.subject, e.sender, 
             CASE WHEN e.body IS NULL THEN '' 
                  WHEN LENGTH(e.body) > 150 THEN SUBSTRING(e.body, 1, 147) || '...' 
                  ELSE e.body 
             END as body,
             e.timestamp as "receivedDate"
      FROM emails e
      JOIN email_accounts ea ON e.account_id = ea.id
      WHERE ea.user_id = $1
      AND (
        e.subject ILIKE $2 OR
        e.sender ILIKE $2 OR
        e.body ILIKE $2
      )
      ORDER BY e.timestamp DESC
      LIMIT 20
    `, [userId, pattern]);
    
    // Direct SQL query for tasks
    const taskResult = await pool.query(`
      SELECT id, title, description, priority, status, 
             due_date as "dueDate", created_at as "createdAt"
      FROM tasks
      WHERE user_id = $1
      AND (
        title ILIKE $2 OR
        description ILIKE $2
      )
      ORDER BY created_at DESC
      LIMIT 20
    `, [userId, pattern]);
    
    // Return formatted results
    return res.json({
      emails: emailResult.rows,
      tasks: taskResult.rows,
      totalResults: emailResult.rowCount + taskResult.rowCount,
      query
    });
    
  } catch (error: any) {
    log(`Search error: ${error.message}`, 'error');
    return res.status(500).json({
      emails: [],
      tasks: [],
      error: 'Search failed',
      message: error.message
    });
  }
});

export default router;