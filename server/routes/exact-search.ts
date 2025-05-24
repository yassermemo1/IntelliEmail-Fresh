/**
 * Super Clean Direct Search API
 * 
 * A direct approach that ensures we're searching correctly
 * with proper error handling and clean format
 */

import express, { Request, Response } from 'express';
import { pool } from '../db';  
import { log } from '../vite';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session.user?.id || 1;
    
    // Get query parameter
    const query = req.query.q as string;
    
    if (!query || query.length < 2) {
      return res.json({
        emails: [],
        tasks: [],
        totalResults: 0
      });
    }
    
    log(`Exact Search API called with query: ${query}`, 'search');
    
    // Create pattern for LIKE search
    const pattern = `%${query}%`;
    
    // Query for emails
    const emailQuery = `
      SELECT 
        e.id, 
        e.subject, 
        e.sender, 
        CASE 
          WHEN e.body IS NULL THEN '' 
          WHEN LENGTH(e.body) > 150 THEN SUBSTRING(e.body, 1, 147) || '...' 
          ELSE e.body 
        END as body,
        e.timestamp as "receivedDate"
      FROM emails e
      JOIN email_accounts ea ON e.account_id = ea.id
      WHERE ea.user_id = $1
      AND (
        LOWER(e.subject) LIKE LOWER($2) OR
        LOWER(e.sender) LIKE LOWER($2) OR
        LOWER(e.body) LIKE LOWER($2)
      )
      ORDER BY e.timestamp DESC
      LIMIT 20
    `;
    
    // Query for tasks
    const taskQuery = `
      SELECT 
        id, 
        title, 
        description, 
        priority, 
        status, 
        due_date as "dueDate", 
        created_at as "createdAt"
      FROM tasks
      WHERE user_id = $1
      AND (
        LOWER(title) LIKE LOWER($2) OR
        LOWER(description) LIKE LOWER($2)
      )
      ORDER BY created_at DESC
      LIMIT 20
    `;
    
    // Execute both queries
    const [emailResult, taskResult] = await Promise.all([
      pool.query(emailQuery, [userId, pattern]),
      pool.query(taskQuery, [userId, pattern])
    ]);
    
    // Log what we found
    log(`Search for "${query}" found ${emailResult.rowCount} emails and ${taskResult.rowCount} tasks`, 'search');
    
    // Return results
    return res.json({
      emails: emailResult.rows || [],
      tasks: taskResult.rows || [],
      totalResults: (emailResult.rowCount || 0) + (taskResult.rowCount || 0)
    });
    
  } catch (error: any) {
    console.error('Search error:', error);
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