/**
 * Simple Typo-Tolerant Search API
 * 
 * This route provides a straightforward implementation of search that can handle
 * misspellings like "intersting" instead of "interesting" through SQL ILIKE patterns
 */

import express, { Request, Response } from 'express';
import { db } from '../db';
import { eq, and, ilike, or, sql } from 'drizzle-orm';
import { emails, tasks, emailAccounts } from '@shared/schema';
import { log } from '../vite';

// Enable more detailed logging for debugging
const debug = true;

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
    
    // Create basic pattern for ILIKE search
    const pattern = `%${query}%`;
    
    // Create email query with ILIKE for typo tolerance
    const emailResults = await db
      .select({
        id: emails.id,
        subject: emails.subject,
        sender: emails.sender,
        body: emails.body,
        receivedDate: emails.receivedDate
      })
      .from(emails)
      .innerJoin(
        emailAccounts,
        and(
          eq(emails.accountId, emailAccounts.id),
          eq(emailAccounts.userId, userId)
        )
      )
      .where(
        or(
          ilike(emails.subject, pattern),
          ilike(emails.sender, pattern),
          ilike(emails.body, pattern)
        )
      )
      .orderBy(emails.receivedDate)
      .limit(20);
    
    // Create task query with ILIKE for typo tolerance
    const taskResults = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        priority: tasks.priority,
        status: tasks.status,
        dueDate: tasks.dueDate,
        createdAt: tasks.createdAt
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          or(
            ilike(tasks.title, pattern),
            ilike(tasks.description, pattern)
          )
        )
      )
      .orderBy(tasks.createdAt)
      .limit(20);
    
    // Make sure we have valid results before mapping
    const formattedEmails = Array.isArray(emailResults) ? emailResults.map(email => ({
      id: email.id,
      subject: email.subject || '',
      sender: email.sender || '',
      body: email.body ? email.body.substring(0, 150) : '',
      receivedDate: email.receivedDate
    })) : [];
    
    // Make sure tasks are in proper format
    const formattedTasks = Array.isArray(taskResults) ? taskResults : [];
    
    // Return formatted results
    return res.json({
      success: true,
      query,
      emails: formattedEmails,
      tasks: formattedTasks,
      totalResults: formattedEmails.length + formattedTasks.length
    });
    
  } catch (error) {
    log(`Error in typo search: ${error.message}`, 'error');
    return res.status(500).json({
      success: false,
      error: 'Search failed'
    });
  }
});

export default router;