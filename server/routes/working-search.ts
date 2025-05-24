import express, { Request, Response } from 'express';
import { pool } from '../db';

const router = express.Router();

// WORKING SEARCH - Direct implementation that bypasses all routing conflicts
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string;
    console.log(`🔍 SEARCH REQUEST - Tasks: "${query}"`);
    
    if (!query || query.length < 2) {
      console.log(`❌ Query too short: "${query}"`);
      return res.json([]);
    }
    
    // Direct SQL query that we know works
    const searchPattern = `%${query}%`;
    console.log(`📊 Executing SQL with pattern: ${searchPattern}`);
    
    const result = await pool.query(`
      SELECT 
        id, 
        title, 
        description, 
        priority, 
        status, 
        due_date as "dueDate",
        created_at as "createdAt"
      FROM tasks 
      WHERE user_id = 1
      AND (
        title ILIKE $1 
        OR description ILIKE $1
        OR COALESCE(description, '') ILIKE $1
      )
      ORDER BY created_at DESC 
      LIMIT 20
    `, [searchPattern]);
    
    console.log(`✅ SEARCH RESULTS - Tasks: Found ${result.rows.length} results`);
    console.log(`📋 Sample results:`, result.rows.slice(0, 2).map(r => ({
      id: r.id,
      title: r.title
    })));
    
    return res.json(result.rows);
  } catch (error) {
    console.error('❌ Task search failed:', error);
    return res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

router.get('/emails', async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string;
    console.log(`🔍 SEARCH REQUEST - Emails: "${query}"`);
    
    if (!query || query.length < 2) {
      console.log(`❌ Query too short: "${query}"`);
      return res.json([]);
    }
    
    // Direct SQL query for emails
    const searchPattern = `%${query}%`;
    console.log(`📊 Executing email SQL with pattern: ${searchPattern}`);
    
    const result = await pool.query(`
      SELECT 
        e.id, 
        e.subject, 
        e.sender, 
        e.timestamp as "date"
      FROM emails e
      JOIN email_accounts ea ON e.account_id = ea.id
      WHERE ea.user_id = 1
      AND (
        e.subject ILIKE $1 
        OR e.sender ILIKE $1 
        OR e.body ILIKE $1
      )
      ORDER BY e.timestamp DESC 
      LIMIT 20
    `, [searchPattern]);
    
    console.log(`✅ SEARCH RESULTS - Emails: Found ${result.rows.length} results`);
    console.log(`📧 Sample results:`, result.rows.slice(0, 2).map(r => ({
      id: r.id,
      subject: r.subject,
      sender: r.sender
    })));
    
    return res.json(result.rows);
  } catch (error) {
    console.error('❌ Email search failed:', error);
    return res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

export default router;