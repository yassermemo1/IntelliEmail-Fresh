/**
 * Simplified Debug Search API
 * 
 * A specialized endpoint to debug search issues
 */

import express, { Request, Response } from 'express';
import { pool } from '../db';  
import { log } from '../vite';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session.user?.id || 1;
    
    // Hard-coded test search term
    const searchTerm = 'Yasser';
    log(`Debug search for term: ${searchTerm}`, 'search');
    
    // Create pattern for LIKE search
    const pattern = `%${searchTerm}%`;
    
    // Direct SQL query for all matching emails
    const emailResult = await pool.query(`
      SELECT e.id, e.subject, e.sender
      FROM emails e
      JOIN email_accounts ea ON e.account_id = ea.id
      WHERE ea.user_id = $1
      AND (
        LOWER(e.subject) LIKE LOWER($2) OR
        LOWER(e.sender) LIKE LOWER($2) OR
        LOWER(e.body) LIKE LOWER($2)
      )
      ORDER BY e.timestamp DESC
      LIMIT 50
    `, [userId, pattern]);
    
    // Return just the count and sample results for debugging
    return res.json({
      searchTerm: searchTerm,
      totalEmailMatches: emailResult.rowCount,
      sampleMatches: emailResult.rows.slice(0, 5).map(email => ({
        id: email.id,
        subject: email.subject,
        sender: email.sender
      }))
    });
    
  } catch (error: any) {
    console.error('Debug search error:', error);
    log(`Debug search error: ${error.message}`, 'error');
    
    return res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

export default router;