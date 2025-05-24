/**
 * Final Typo-Tolerant Search Implementation
 * 
 * This implementation carefully matches the database schema
 * to ensure proper handling of typos in search queries
 */

import express, { Request, Response } from 'express';
import { pool } from '../db';
import { log } from '../vite';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session.user?.id || 1;
    
    // Get query and filters from request
    const query = req.query.q as string;
    const subjectFilter = req.query.subject as string;
    const fromFilter = req.query.from as string;
    const toFilter = req.query.to as string;
    const ccFilter = req.query.cc as string;
    const hasAttachment = req.query.attachment === 'true';
    const afterDate = req.query.after as string;
    const beforeDate = req.query.before as string;
    const priority = req.query.priority as string;
    const readStatus = req.query.read as string;
    const category = req.query.category as string;
    
    // Check if this is a wildcard search with filters
    const isWildcardSearch = query === '*';
    
    // If no query and no filters, return empty results
    if (!query && !subjectFilter && !fromFilter && !toFilter && !ccFilter && 
        !hasAttachment && !afterDate && !beforeDate && !priority && !readStatus && !category) {
      return res.json({
        emails: [],
        tasks: [],
        totalResults: 0
      });
    }
    
    // If query is not wildcard and too short, return empty
    if (!isWildcardSearch && query && query.length < 2) {
      return res.json({
        emails: [],
        tasks: [],
        totalResults: 0
      });
    }
    
    log(`Final search implementation with query: "${query}"`, 'search');
    
    // Build email query conditions
    let conditions = [];
    let params = [userId];
    let paramIndex = 2;
    
    // Main search query (if not wildcard)
    if (!isWildcardSearch && query) {
      const pattern = `%${query}%`;
      conditions.push(`(
        LOWER(e.subject) LIKE LOWER($${paramIndex}) OR
        LOWER(e.sender) LIKE LOWER($${paramIndex}) OR
        LOWER(e.body) LIKE LOWER($${paramIndex})
      )`);
      params.push(pattern);
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
    
    // If no conditions (should not happen with validation above), add a dummy condition
    if (conditions.length === 0) {
      conditions.push('TRUE');
    }
    
    // Combine all conditions
    const whereClause = conditions.join(' AND ');
    
    // Query for emails with filters
    const emailSQL = `
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
    
    // Log the final SQL for debugging
    log(`Executing email query with filters: ${emailSQL.replace(/\s+/g, ' ')}`, 'search');
    
    const emailResult = await pool.query(emailSQL, params);
    
    // For tasks, only use the main query (not filters)
    let taskResult = { rows: [], rowCount: 0 };
    
    if (!isWildcardSearch && query) {
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
    
    // Log results for monitoring
    log(`Search for "${query}" found ${emailResult.rowCount} emails and ${taskResult.rowCount} tasks`, 'search');
    
    // Return formatted results
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