import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { tasks, emails } from '@shared/schema';
import { like, and, eq, or, sql } from 'drizzle-orm';
import { log } from '../vite';

const router = Router();

/**
 * Global search endpoint that searches across emails and tasks
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get search query from request
    const query = req.query.q as string;
    if (!query || query.trim().length === 0) {
      return res.json({
        tasks: [],
        emails: [],
        totalResults: 0
      });
    }

    // Perform search across different data types
    const searchTerm = `%${query.toLowerCase()}%`;

    // Search tasks
    const searchedTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          or(
            sql`LOWER(${tasks.title}) LIKE ${searchTerm}`,
            sql`LOWER(COALESCE(${tasks.description}, '')) LIKE ${searchTerm}`
          )
        )
      )
      .limit(20);

    // Search emails
    const searchedEmails = await db
      .select()
      .from(emails)
      .where(
        and(
          eq(emails.userId, userId),
          or(
            sql`LOWER(COALESCE(${emails.subject}, '')) LIKE ${searchTerm}`,
            sql`LOWER(COALESCE(${emails.from}, '')) LIKE ${searchTerm}`,
            sql`LOWER(COALESCE(${emails.to}, '')) LIKE ${searchTerm}`,
            sql`LOWER(COALESCE(${emails.body}, '')) LIKE ${searchTerm}`
          )
        )
      )
      .limit(20);

    // Return combined search results
    return res.json({
      tasks: searchedTasks,
      emails: searchedEmails,
      totalResults: searchedTasks.length + searchedEmails.length
    });
  } catch (error) {
    log(`Error performing global search: ${error.message}`, 'error');
    return res.status(500).json({ error: 'Failed to perform search' });
  }
});

export default router;