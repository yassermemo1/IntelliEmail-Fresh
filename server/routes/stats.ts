import { Router, Request, Response } from 'express';
import { db } from '../db';
import { emails, tasks, emailAccounts } from '@shared/schema';
import { sql, count, desc } from 'drizzle-orm';
import { cache } from '../utils/cache';

const router = Router();

// Statistics endpoint for dashboard
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = 1; // Default user ID for now
    
    // Use cache for stats data with a 30-second TTL
    const statsData = await cache.getOrSet(`dashboard_stats_${userId}`, async () => {
      // Get comprehensive email stats with accurate counts for processed, cleaned, and RAG emails
      const emailQuery = await db.select({
        total: count(),
        unread: sql<number>`SUM(CASE WHEN "is_read" = false THEN 1 ELSE 0 END)`,
        processed: sql<number>`SUM(CASE WHEN "processed" = true THEN 1 ELSE 0 END)`,
        cleaned: sql<number>`SUM(CASE WHEN "is_cleaned" = true THEN 1 ELSE 0 END)`,
        ragProcessed: sql<number>`SUM(CASE WHEN "is_rag_processed" = true THEN 1 ELSE 0 END)`
      }).from(emails);
      
      // Get task stats
      const taskQuery = await db.select({
        total: count(),
        highPriority: sql<number>`SUM(CASE WHEN "priority" = 'high' THEN 1 ELSE 0 END)`,
        completed: sql<number>`SUM(CASE WHEN "is_completed" = true THEN 1 ELSE 0 END)`,
        pending: sql<number>`SUM(CASE WHEN "is_completed" = false THEN 1 ELSE 0 END)`,
      }).from(tasks);
      
      // Get email account stats
      const accountQuery = await db.select({
        total: count(),
      }).from(emailAccounts);
      
      // Recent emails
      const recentEmails = await db
        .select()
        .from(emails)
        .orderBy(desc(emails.timestamp))
        .limit(5);
      
      // Recent tasks
      const recentTasks = await db
        .select()
        .from(tasks)
        .orderBy(desc(tasks.createdAt))
        .limit(5);
      
      return {
        emails: {
          total: Number(emailQuery[0].total) || 0,
          unread: Number(emailQuery[0].unread) || 0,
          processedEmails: Number(emailQuery[0].processed) || 0, 
          cleanedEmails: Number(emailQuery[0].cleaned) || 0, // Using accurate cleaned emails count
          ragEmails: Number(emailQuery[0].ragProcessed) || 0, // Using accurate RAG processed emails count
          totalEmails: Number(emailQuery[0].total) || 0
        },
        tasks: {
          total: Number(taskQuery[0].total) || 0,
          highPriority: Number(taskQuery[0].highPriority) || 0,
          completed: Number(taskQuery[0].completed) || 0,
          pending: Number(taskQuery[0].pending) || 0
        },
        accounts: {
          total: Number(accountQuery[0].total) || 0
        },
        recent: {
          emails: recentEmails,
          tasks: recentTasks
        }
      };
    }, 30); // Cache for 30 seconds
    
    res.json(statsData);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Clear cache endpoint
router.post('/clear-cache', async (req: Request, res: Response) => {
  try {
    cache.clear();
    res.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;