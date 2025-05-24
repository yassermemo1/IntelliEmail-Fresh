/**
 * Email content cleaner
 * 
 * This route provides functionality to clean email content
 * by removing unwanted markers and sanitizing content
 */

import express, { Request, Response } from 'express';
import { pool } from '../db';
import { log } from '../vite';

const router = express.Router();

// Clean a single email
router.post('/clean/:id', async (req: Request, res: Response) => {
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

// Clean all emails in bulk
router.post('/clean-all', async (req: Request, res: Response) => {
  try {
    const { limit = 200 } = req.body;
    
    // Get emails that need cleaning (not already cleaned)
    const emailsResult = await pool.query(
      'SELECT id, body, body_html FROM emails WHERE is_cleaned = false LIMIT $1',
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
        
        processedCount++;
      } catch (err) {
        console.error(`Error cleaning email ${email.id}:`, err);
      }
    }
    
    return res.json({
      success: true,
      message: `Successfully cleaned ${processedCount} emails`,
      count: processedCount
    });
    
  } catch (error: any) {
    console.error('Error cleaning emails in bulk:', error);
    log(`Error cleaning emails in bulk: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to clean emails in bulk' });
  }
});

export default router;