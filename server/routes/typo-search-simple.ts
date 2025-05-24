/**
 * Simple Typo-Tolerant Search API
 * 
 * This route provides a simplified approach to search that can handle
 * misspellings like "intersting" instead of "interesting" through SQL ILIKE patterns
 */

import express, { Request, Response } from 'express';
import { db } from '../db';
import { log } from '../vite';
import { sql } from 'drizzle-orm';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Get user ID from session (fallback to 1 for testing)
    const userId = req.session.user?.id || 1;
    
    // Get query from request
    const query = req.query.q as string;
    
    if (!query || query.length < 2) {
      return res.json({
        success: true,
        query,
        emails: [],
        tasks: [],
        totalResults: 0
      });
    }
    
    // Log search attempt
    log(`Typo-tolerant search: "${query}"`, 'search');
    
    // Create basic pattern for ILIKE search with wildcard
    const pattern = `%${query}%`;
    
    // Run direct SQL queries for maximum reliability
    const emailResults = await db.execute(sql`
      SELECT e.id, e.subject, e.sender, e.body, e.received_date as "receivedDate"
      FROM emails e
      JOIN email_accounts ea ON e.account_id = ea.id
      WHERE ea.user_id = ${userId}
      AND (
        e.subject ILIKE ${pattern}
        OR e.sender ILIKE ${pattern}
        OR e.body ILIKE ${pattern}
      )
      ORDER BY e.received_date DESC
      LIMIT 20
    `);
    
    // Get tasks with typo tolerance
    const taskResults = await db.execute(sql`
      SELECT id, title, description, priority, status, due_date as "dueDate", created_at as "createdAt"
      FROM tasks
      WHERE user_id = ${userId}
      AND (
        title ILIKE ${pattern}
        OR description ILIKE ${pattern}
      )
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    // Return formatted results
    return res.json({
      success: true,
      query,
      emails: emailResults,
      tasks: taskResults,
      totalResults: emailResults.length + taskResults.length
    });
    
  } catch (error: any) {
    log(`Error in typo search: ${error.message}`, 'error');
    return res.status(500).json({
      success: false,
      error: 'Search failed'
    });
  }
});

export default router;