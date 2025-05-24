/**
 * Advanced Search implementation that supports filters
 * Correctly handles subject, from, to, and other filter criteria
 */

import express, { Request, Response } from 'express';
import { pool } from '../db';
import { log } from '../vite';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session.user?.id || 1;
    
    // Get main query and filters from request
    const query = req.query.q as string || "";
    
    // Extract filter values
    const subjectFilter = req.query.subject as string || "";
    const fromFilter = req.query.from as string || "";
    const toFilter = req.query.to as string || "";
    const ccFilter = req.query.cc as string || "";
    const hasAttachment = req.query.attachment === "true";
    const afterDate = req.query.after as string || "";
    const beforeDate = req.query.before as string || "";
    const priority = req.query.priority as string || "";
    const readStatus = req.query.read as string || "";
    const category = req.query.category as string || "";
    
    // Check if this is a wildcard search with filters only
    const isWildcardSearch = query === "*";
    
    // Build SQL conditions
    let conditions = [];
    let params = [userId];
    let paramIndex = 2; // Start from $2 since $1 is userId
    
    // Main search query (unless it's a wildcard)
    if (!isWildcardSearch && query.length >= 2) {
      conditions.push(`(
        LOWER(e.subject) LIKE LOWER($${paramIndex}) OR
        LOWER(e.sender) LIKE LOWER($${paramIndex}) OR
        LOWER(e.body) LIKE LOWER($${paramIndex})
      )`);
      params.push(`%${query}%`);
      paramIndex++;
    }
    
    // Add filters as conditions
    if (subjectFilter) {
      conditions.push(`LOWER(e.subject) LIKE LOWER($${paramIndex})`);
      params.push(`%${subjectFilter}%`);
      paramIndex++;
    }
    
    if (fromFilter) {
      conditions.push(`LOWER(e.sender) LIKE LOWER($${paramIndex})`);
      params.push(`%${fromFilter}%`);
      paramIndex++;
    }
    
    if (toFilter) {
      conditions.push(`LOWER(e.to) LIKE LOWER($${paramIndex})`);
      params.push(`%${toFilter}%`);
      paramIndex++;
    }
    
    if (ccFilter) {
      conditions.push(`LOWER(e.cc) LIKE LOWER($${paramIndex})`);
      params.push(`%${ccFilter}%`);
      paramIndex++;
    }
    
    if (hasAttachment) {
      conditions.push(`e.has_attachments = TRUE`);
    }
    
    if (afterDate) {
      conditions.push(`e.timestamp >= $${paramIndex}::date`);
      params.push(afterDate);
      paramIndex++;
    }
    
    if (beforeDate) {
      conditions.push(`e.timestamp <= $${paramIndex}::date`);
      params.push(beforeDate);
      paramIndex++;
    }
    
    if (priority && priority !== 'any') {
      conditions.push(`e.priority = $${paramIndex}`);
      params.push(priority);
      paramIndex++;
    }
    
    if (readStatus === 'read') {
      conditions.push(`e.is_read = TRUE`);
    } else if (readStatus === 'unread') {
      conditions.push(`e.is_read = FALSE`);
    }
    
    if (category && category !== 'any') {
      conditions.push(`e.category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }
    
    // If no conditions (could happen with a "*" search and no filters), add a dummy condition that's always true
    if (conditions.length === 0) {
      conditions.push('TRUE');
    }
    
    // Combine all conditions
    const whereClause = conditions.join(' AND ');
    
    // Log the search request for debugging
    log(`Advanced search: main query="${query}", filters: subject="${subjectFilter}", from="${fromFilter}", hasAttachment=${hasAttachment}`, 'search');
    
    // Query for emails with all conditions
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
        e.timestamp as "receivedDate",
        e.has_attachments as "hasAttachments",
        e.is_read as "isRead"
      FROM emails e
      JOIN email_accounts ea ON e.account_id = ea.id
      WHERE ea.user_id = $1
      AND (${whereClause})
      ORDER BY e.timestamp DESC
      LIMIT 50
    `;
    
    // Log the final constructed query for debugging
    log(`Executing email query: ${emailQuery.replace(/\s+/g, ' ')}`, 'search');
    log(`With params: ${JSON.stringify(params)}`, 'search');
    
    const emailResult = await pool.query(emailQuery, params);
    
    // Query for tasks with similar conditions
    // For now, task search doesn't use filters - in a future update this could be enhanced
    let taskResult = { rows: [], rowCount: 0 };
    
    if (!isWildcardSearch && query.length >= 2) {
      taskResult = await pool.query(`
        SELECT 
          id, 
          title, 
          description,
          priority,
          is_completed as "isCompleted",
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
      `, [userId, `%${query}%`]);
    }
    
    // Log results
    log(`Advanced search found ${emailResult.rowCount} emails and ${taskResult.rowCount} tasks`, 'search');
    
    // Return results
    return res.json({
      emails: emailResult.rows || [],
      tasks: taskResult.rows || [],
      totalResults: (emailResult.rowCount || 0) + (taskResult.rowCount || 0)
    });
    
  } catch (error: any) {
    console.error('Advanced search error:', error);
    log(`Advanced search error: ${error.message}`, 'error');
    
    return res.status(500).json({
      emails: [],
      tasks: [],
      error: 'Advanced search failed',
      message: error.message
    });
  }
});

export default router;