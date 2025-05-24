import { Router, Request, Response } from 'express';
import { db } from '../db';
import { emails } from '@shared/schema';
import { eq, and, desc, ne, or, like, sql } from 'drizzle-orm';

const router = Router();

// Get emails based on query parameters (account, cleaned status, RAG status)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      accountId, 
      limit = 50, 
      offset = 0,
      cleaned,
      ragProcessed  
    } = req.query;
    
    let query = db.select().from(emails);
    
    // Apply filters based on query parameters
    if (accountId) {
      query = query.where(eq(emails.accountId, Number(accountId)));
    }
    
    if (cleaned === 'true') {
      query = query.where(eq(emails.is_cleaned, true));
    }
    
    if (ragProcessed === 'true') {
      query = query.where(eq(emails.is_rag_processed, true));
    }
    
    // Apply sorting and pagination
    const results = await query
      .orderBy(desc(emails.timestamp))
      .limit(Number(limit))
      .offset(Number(offset));
    
    res.json(results);
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get a specific email by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const emailId = parseInt(req.params.id);
    
    const [email] = await db
      .select()
      .from(emails)
      .where(eq(emails.id, emailId));
    
    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    res.json(email);
  } catch (error) {
    console.error('Error fetching email:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get related emails for a specific email
router.get('/:id/related', async (req: Request, res: Response) => {
  try {
    const emailId = parseInt(req.params.id);
    
    // First, get the email to find its thread ID and subject
    const [targetEmail] = await db
      .select()
      .from(emails)
      .where(eq(emails.id, emailId));
    
    if (!targetEmail) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    // Find emails with the same thread ID or similar subject (excluding the current email)
    const relatedEmails = await db
      .select()
      .from(emails)
      .where(
        and(
          ne(emails.id, emailId),
          or(
            targetEmail.threadId ? eq(emails.threadId, targetEmail.threadId) : undefined,
            like(emails.subject, `%${targetEmail.subject.replace(/^(re:|fwd:)\s*/i, '')}%`)
          )
        )
      )
      .limit(10);
    
    res.json(relatedEmails);
  } catch (error) {
    console.error('Error fetching related emails:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update a specific email
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const emailId = parseInt(req.params.id);
    const updateData = req.body;
    
    // Make sure required fields aren't modified
    delete updateData.id;
    delete updateData.accountId;
    delete updateData.messageId;
    
    const [updatedEmail] = await db
      .update(emails)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(emails.id, emailId))
      .returning();
    
    if (!updatedEmail) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    res.json(updatedEmail);
  } catch (error) {
    console.error('Error updating email:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Special endpoint to clean marker tags from already processed emails
router.post('/clean-markers', async (req: Request, res: Response) => {
  try {
    const { limit = 100 } = req.body;
    
    // Get emails that have been cleaned but still contain marker tags
    const emailsToFix = await db
      .select()
      .from(emails)
      .where(eq(emails.is_cleaned, true))
      .limit(limit);
    
    let processedCount = 0;
    
    for (const email of emailsToFix) {
      if (!email.body) continue;
      
      let cleanedBody = email.body;
      let changed = false;
      
      // Direct replacement of URL REMOVED markers
      if (cleanedBody.includes('[URL REMOVED]') || 
          cleanedBody.includes('[[URL') || 
          cleanedBody.includes('([URL') ||
          cleanedBody.includes('[EMAIL FOOTER REMOVED]')) {
        
        const original = cleanedBody;
        
        // Remove all URL REMOVED markers with different bracket patterns
        cleanedBody = cleanedBody.replace(/\[URL REMOVED\]/g, '');
        cleanedBody = cleanedBody.replace(/\[\[URL REMOVED\]\]/g, '');
        cleanedBody = cleanedBody.replace(/\(\[URL REMOVED\]\)/g, '');
        cleanedBody = cleanedBody.replace(/\[URL REMOVED\]\]/g, '');
        cleanedBody = cleanedBody.replace(/\[\[URL REMOVED\]/g, '');
        
        // Remove all EMAIL FOOTER REMOVED markers
        cleanedBody = cleanedBody.replace(/\[EMAIL FOOTER REMOVED\]/g, '');
        
        // Remove all parenthesized URL markers like "([URL REMOVED])"
        cleanedBody = cleanedBody.replace(/\(\s*\[[^\]]*URL[^\]]*\]\s*\)/g, '');
        
        // Remove all parenthesized REMOVED markers
        cleanedBody = cleanedBody.replace(/\(\s*\[[^\]]*REMOVED[^\]]*\]\s*\)/g, '');
        
        // Clean up multiple spaces
        cleanedBody = cleanedBody.replace(/\s{2,}/g, ' ');
        
        if (original !== cleanedBody) {
          changed = true;
        }
      }
      
      if (changed) {
        // Update the email in the database
        await db
          .update(emails)
          .set({
            body: cleanedBody,
            updatedAt: new Date()
          })
          .where(eq(emails.id, email.id));
        
        processedCount++;
      }
    }
    
    // Get count of emails that might still have marker tags
    const remainingCount = await db
      .select({ count: sql`count(*)` })
      .from(emails)
      .where(
        and(
          eq(emails.is_cleaned, true),
          or(
            like(emails.body, '%[URL REMOVED]%'),
            like(emails.body, '%[EMAIL FOOTER REMOVED]%')
          )
        )
      )
      .then(result => Number(result[0].count));
    
    res.json({
      success: true,
      message: `Processed ${processedCount} emails and removed marker tags.`,
      remaining: remainingCount
    });
  } catch (error) {
    console.error("Error removing marker tags:", error);
    res.status(500).json({ error: "Failed to remove marker tags from emails" });
  }
});

export default router;