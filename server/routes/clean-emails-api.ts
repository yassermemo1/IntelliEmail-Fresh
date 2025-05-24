/**
 * Email content cleaning API
 * Provides endpoints for cleaning email content by removing unwanted markers
 */

import express, { Request, Response } from 'express';
import { pool } from '../db';
import { log } from '../vite';

const router = express.Router();

// Clean a batch of emails
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { limit = 200 } = req.body;
    
    // Get emails that need cleaning (not already cleaned)
    const emailsResult = await pool.query(
      'SELECT id, body, body_html FROM emails WHERE is_cleaned IS NULL OR is_cleaned = false LIMIT $1',
      [limit]
    );
    
    if (emailsResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No emails found that need cleaning',
        count: 0
      });
    }
    
    // Process each email
    let processedCount = 0;
    let successCount = 0;
    
    for (const email of emailsResult.rows) {
      try {
        let { id, body, body_html } = email;
        
        // Clean the text content
        if (body) {
          // Remove marker tags
          body = body.replace(/\[EMAIL HEADER REMOVED\]/g, '');
          body = body.replace(/\[EMAIL FOOTER REMOVED\]/g, '');
          body = body.replace(/\[URL REMOVED\]/g, '');
          body = body.replace(/<\[URL REMOVED\]>/g, '');
          body = body.replace(/"" <\[URL REMOVED\]>/g, '');
          
          // Remove multiple consecutive newlines
          body = body.replace(/\n{3,}/g, '\n\n');
          
          // Trim whitespace
          body = body.trim();
        }
        
        // Clean the HTML content
        if (body_html) {
          // Remove marker tags from HTML
          body_html = body_html.replace(/\[EMAIL HEADER REMOVED\]/g, '');
          body_html = body_html.replace(/\[EMAIL FOOTER REMOVED\]/g, '');
          body_html = body_html.replace(/\[URL REMOVED\]/g, '');
          body_html = body_html.replace(/<\[URL REMOVED\]>/g, '');
          body_html = body_html.replace(/"" <\[URL REMOVED\]>/g, '');
        }
        
        // Update the email with cleaned content
        await pool.query(
          'UPDATE emails SET body = $1, body_html = $2, is_cleaned = true WHERE id = $3',
          [body, body_html, id]
        );
        
        successCount++;
      } catch (err: any) {
        console.error(`Error cleaning email ${email.id}:`, err);
        log(`Error cleaning email ${email.id}: ${err.message}`, 'error');
      }
      
      processedCount++;
    }
    
    return res.json({
      success: true,
      message: `Successfully cleaned ${successCount} emails`,
      count: successCount,
      total: processedCount
    });
    
  } catch (error: any) {
    console.error('Error cleaning emails in batch:', error);
    log(`Error cleaning emails in batch: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to clean emails in batch' });
  }
});

// Clean a specific email
router.post('/single/:id', async (req: Request, res: Response) => {
  try {
    const emailId = parseInt(req.params.id, 10);
    
    if (isNaN(emailId)) {
      return res.status(400).json({ error: 'Invalid email ID' });
    }
    
    // Get the email content
    const emailResult = await pool.query(
      'SELECT body, body_html FROM emails WHERE id = $1',
      [emailId]
    );
    
    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    const email = emailResult.rows[0];
    let { body, body_html } = email;
    
    // Clean the text content
    if (body) {
      // Remove marker tags
      body = body.replace(/\[EMAIL HEADER REMOVED\]/g, '');
      body = body.replace(/\[EMAIL FOOTER REMOVED\]/g, '');
      body = body.replace(/\[URL REMOVED\]/g, '');
      body = body.replace(/<\[URL REMOVED\]>/g, '');
      body = body.replace(/"" <\[URL REMOVED\]>/g, '');
      
      // Remove multiple consecutive newlines
      body = body.replace(/\n{3,}/g, '\n\n');
      
      // Trim whitespace
      body = body.trim();
    }
    
    // Clean the HTML content
    if (body_html) {
      // Remove marker tags from HTML
      body_html = body_html.replace(/\[EMAIL HEADER REMOVED\]/g, '');
      body_html = body_html.replace(/\[EMAIL FOOTER REMOVED\]/g, '');
      body_html = body_html.replace(/\[URL REMOVED\]/g, '');
      body_html = body_html.replace(/<\[URL REMOVED\]>/g, '');
      body_html = body_html.replace(/"" <\[URL REMOVED\]>/g, '');
    }
    
    // Update the email with cleaned content
    await pool.query(
      'UPDATE emails SET body = $1, body_html = $2, is_cleaned = true WHERE id = $3',
      [body, body_html, emailId]
    );
    
    return res.json({
      success: true,
      message: 'Email content cleaned successfully',
      emailId
    });
    
  } catch (error: any) {
    console.error('Error cleaning email:', error);
    log(`Error cleaning email: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to clean email content' });
  }
});

// Get cleaning status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const statusResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_cleaned = true) as cleaned
      FROM emails
    `);
    
    const { total, cleaned } = statusResult.rows[0];
    const remaining = parseInt(total) - parseInt(cleaned);
    const percentComplete = total > 0 ? Math.round((parseInt(cleaned) / parseInt(total)) * 100) : 100;
    
    return res.json({
      success: true,
      total: parseInt(total),
      cleaned: parseInt(cleaned),
      remaining,
      percentComplete
    });
    
  } catch (error: any) {
    console.error('Error checking email cleaning status:', error);
    log(`Error checking email cleaning status: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to check email cleaning status' });
  }
});

export default router;