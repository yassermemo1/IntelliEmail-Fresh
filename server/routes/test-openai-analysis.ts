import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { aiService } from '../services/aiService';
import { db } from '../db';
import { emails } from '../../shared/schema';
import { desc, eq, lt, ne } from 'drizzle-orm';

const router = Router();

/**
 * Test OpenAI email analysis endpoint
 * This will analyze recent emails using OpenAI and return the results
 */
router.post('/analyze-recent-emails', async (req: Request, res: Response) => {
  try {
    const { count = 5 } = req.body;
    const limit = Math.min(Number(count), 10); // Limit to 10 max for quick testing
    
    // Get the most recent emails that aren't duplicates (different subjects)
    const recentEmails = await db
      .select()
      .from(emails)
      .where(
        ne(emails.subject, '') // Exclude empty subjects
      )
      .orderBy(desc(emails.timestamp))
      .limit(50); // Get more than we need to find variety
    
    // Filter to get emails with unique subjects
    const uniqueSubjectEmails = [];
    const seenSubjects = new Set();
    
    for (const email of recentEmails) {
      if (!seenSubjects.has(email.subject)) {
        seenSubjects.add(email.subject);
        uniqueSubjectEmails.push(email);
        
        if (uniqueSubjectEmails.length >= limit) {
          break;
        }
      }
    }
    
    // Process each email
    const results = [];
    
    for (const email of uniqueSubjectEmails) {
      console.log(`Analyzing email: ${email.id} - ${email.subject}`);
      
      try {
        // Get classification and actionability assessment
        const classification = aiService.classifyEmailContent(email.subject, email.body || '');
        const isLikelyNonActionable = aiService.isLikelyNonActionable(email.subject, email.sender);
        
        // Extract tasks from the email
        const extractedTasks = await aiService.extractTasksFromEmail(email.id);
        
        // Generate an explanation about task extraction
        const explanation = await aiService.generateTaskExtractionExplanation(
          email.subject,
          email.sender,
          classification,
          isLikelyNonActionable
        );
        
        results.push({
          emailId: email.id,
          subject: email.subject,
          from: email.sender,
          classification,
          isLikelyNonActionable,
          extractedTasks,
          analysis: {
            extractedTaskCount: extractedTasks.length,
            categories: classification,
            explanation
          }
        });
      } catch (error) {
        console.error(`Error analyzing email ${email.id}:`, error);
        results.push({
          emailId: email.id,
          subject: email.subject,
          from: email.sender,
          error: error.message || 'Unknown error during analysis'
        });
      }
    }
    
    return res.json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Error in email analysis test:', error);
    return res.status(500).json({
      success: false,
      message: 'Error analyzing emails',
      error: error.message
    });
  }
});

export default router;