import express, { Request, Response } from 'express';
import { pool } from '../db';
import { debugLogger } from '../utils/debugLogger';

const router = express.Router();

// Simple task search endpoint
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string;
    debugLogger.searchLog('task_search_start', query);
    debugLogger.apiLog('/search/tasks', 'GET', { query, userId: 1 });
    
    if (!query || query.length < 2) {
      debugLogger.searchLog('task_search_too_short', query);
      return res.json([]);
    }
    
    const searchPattern = `%${query}%`;
    debugLogger.dbLog('task_search_query', { 
      query: searchPattern, 
      userId: 1,
      sqlQuery: 'SELECT id, title, description, priority, status, due_date, created_at FROM tasks WHERE user_id = $1 AND (title ILIKE $2 OR description ILIKE $2)'
    });
    
    const result = await pool.query(`
      SELECT id, title, description, priority, status, due_date as "dueDate", created_at as "createdAt"
      FROM tasks 
      WHERE user_id = $1
      AND (title ILIKE $2 OR description ILIKE $2)
      ORDER BY created_at DESC 
      LIMIT 20
    `, [1, searchPattern]);
    
    debugLogger.searchLog('task_search_complete', query, result.rows);
    debugLogger.dbLog('task_search_results', { 
      resultCount: result.rows.length,
      results: result.rows.map(r => ({ id: r.id, title: r.title }))
    });
    
    return res.json(result.rows);
  } catch (error) {
    debugLogger.error('search', 'Task search failed', error);
    return res.json([]);
  }
});

// Simple email search endpoint
router.get('/emails', async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string;
    debugLogger.searchLog('email_search_start', query);
    debugLogger.apiLog('/search/emails', 'GET', { query, userId: 1 });
    
    if (!query || query.length < 2) {
      debugLogger.searchLog('email_search_too_short', query);
      return res.json([]);
    }
    
    const searchPattern = `%${query}%`;
    debugLogger.dbLog('email_search_query', { 
      query: searchPattern, 
      userId: 1,
      sqlQuery: 'SELECT e.id, e.subject, e.sender, e.timestamp FROM emails e JOIN email_accounts ea ON e.account_id = ea.id WHERE ea.user_id = $1 AND (e.subject ILIKE $2 OR e.sender ILIKE $2 OR e.body ILIKE $2)'
    });
    
    const result = await pool.query(`
      SELECT e.id, e.subject, e.sender, e.timestamp as "date"
      FROM emails e
      JOIN email_accounts ea ON e.account_id = ea.id
      WHERE ea.user_id = $1
      AND (e.subject ILIKE $2 OR e.sender ILIKE $2 OR e.body ILIKE $2)
      ORDER BY e.timestamp DESC 
      LIMIT 20
    `, [1, searchPattern]);
    
    debugLogger.searchLog('email_search_complete', query, result.rows);
    debugLogger.dbLog('email_search_results', { 
      resultCount: result.rows.length,
      results: result.rows.slice(0, 3).map(r => ({ id: r.id, subject: r.subject, sender: r.sender }))
    });
    
    return res.json(result.rows);
  } catch (error) {
    debugLogger.error('search', 'Email search failed', error);
    return res.json([]);
  }
});

export default router;