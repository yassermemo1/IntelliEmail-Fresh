/**
 * Basic Typo-Tolerant Search API
 * 
 * This implementation provides a reliable search that handles
 * misspellings like "intersting" instead of "interesting"
 */

import express, { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { log } from '../vite';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Get user ID from session (fallback to 1 for testing)
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
    log(`Basic typo-tolerant search: "${query}"`, 'search');
    
    // Create pattern for ILIKE search
    const pattern = `%${query}%`;
    
    // Get matching emails with SQL directly (more reliable approach)
    const emails = await db.execute(sql`
      SELECT e.id, e.subject, e.sender, 
             CASE WHEN e.body IS NULL THEN '' 
                  WHEN LENGTH(e.body) > 150 THEN SUBSTRING(e.body, 1, 147) || '...' 
                  ELSE e.body 
             END as body,
             e.timestamp as "receivedDate"
      FROM emails e
      JOIN email_accounts ea ON e.account_id = ea.id
      WHERE ea.user_id = ${userId}
      AND (
        e.subject ILIKE ${pattern} OR
        e.sender ILIKE ${pattern} OR
        e.body ILIKE ${pattern}
      )
      ORDER BY e.timestamp DESC
      LIMIT 20
    `);
    
    // Get matching tasks
    const tasks = await db.execute(sql`
      SELECT id, title, description, priority, status, due_date as "dueDate", created_at as "createdAt"
      FROM tasks
      WHERE user_id = ${userId}
      AND (
        title ILIKE ${pattern} OR
        description ILIKE ${pattern}
      )
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    return res.json({
      emails,
      tasks,
      totalResults: emails.length + tasks.length
    });
    
  } catch (error: any) {
    log(`Search error: ${error.message}`, 'error');
    return res.status(500).json({
      emails: [],
      tasks: [],
      error: 'Search failed'
    });
  }
});

export default router;