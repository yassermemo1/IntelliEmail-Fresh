import { Router, Request, Response } from 'express';
import { emailChainService } from '../services/emailChainService';
import { db } from '../db';
import { sql, eq } from 'drizzle-orm';
import { emails } from '@shared/schema';
import { log } from '../vite';

const router = Router();

/**
 * Test endpoint to find related emails for a specific email
 */
router.get('/related/:emailId', async (req: Request, res: Response) => {
  try {
    const emailId = parseInt(req.params.emailId);
    if (isNaN(emailId)) {
      return res.status(400).json({ error: 'Invalid email ID' });
    }
    
    // Get the source email details for the response
    const [sourceEmail] = await db.select({
      id: emails.id,
      subject: emails.subject,
      sender: emails.sender,
      threadId: emails.threadId,
      hasEmbedding: sql<boolean>`embedding_vector IS NOT NULL`
    })
    .from(emails)
    .where(eq(emails.id, emailId));
    
    if (!sourceEmail) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    // Find related emails using all detection methods
    const relatedEmails = await emailChainService.findRelatedEmails(emailId);
    
    // Get basic stats about relationships
    let relationshipStats;
    try {
      const statsResult = await db.execute(sql`
        SELECT 
          COUNT(*) AS total_links,
          COUNT(*) FILTER (WHERE link_type = 'thread') AS thread_links,
          COUNT(*) FILTER (WHERE link_type = 'subject') AS subject_links,
          COUNT(*) FILTER (WHERE link_type = 'semantic') AS semantic_links,
          COUNT(*) FILTER (WHERE similarity_score >= 90) AS high_confidence_links
        FROM email_semantic_links
      `);
      
      const stats = Array.isArray(statsResult) && statsResult.length > 0 
        ? statsResult[0] 
        : (statsResult?.rows && statsResult.rows.length > 0 ? statsResult.rows[0] : {});
        
      relationshipStats = {
        totalLinks: parseInt(stats?.total_links || '0'),
        threadLinks: parseInt(stats?.thread_links || '0'),
        subjectLinks: parseInt(stats?.subject_links || '0'),
        semanticLinks: parseInt(stats?.semantic_links || '0'),
        highConfidenceLinks: parseInt(stats?.high_confidence_links || '0')
      };
    } catch (error) {
      log(`Error getting relationship stats: ${error.message}`);
      relationshipStats = { 
        totalLinks: 0, 
        threadLinks: 0, 
        subjectLinks: 0, 
        semanticLinks: 0, 
        highConfidenceLinks: 0 
      };
    }
    
    return res.json({
      sourceEmail,
      relatedEmails,
      stats: {
        count: relatedEmails.length,
        threadRelations: relatedEmails.filter(e => e.relation_type === 'thread').length,
        subjectRelations: relatedEmails.filter(e => e.relation_type === 'subject').length,
        semanticRelations: relatedEmails.filter(e => e.relation_type === 'semantic').length
      },
      globalStats: relationshipStats
    });
  } catch (error) {
    log(`Error testing email relationships: ${error.message}`);
    res.status(500).json({ error: 'Error testing email relationships' });
  }
});

/**
 * Test endpoint to update email relationships
 */
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { accountId, limit = 50, recentOnly = true } = req.body;
    
    log(`Starting test relationship update${accountId ? ` for account ${accountId}` : ' for all accounts'}`);
    
    // Get basic stats before updating
    let statsBefore;
    try {
      const statsResult = await db.execute(sql`
        SELECT 
          COUNT(*) AS total_links,
          COUNT(*) FILTER (WHERE link_type = 'thread') AS thread_links,
          COUNT(*) FILTER (WHERE link_type = 'subject') AS subject_links,
          COUNT(*) FILTER (WHERE link_type = 'semantic') AS semantic_links,
          COUNT(*) FILTER (WHERE similarity_score >= 90) AS high_confidence_links
        FROM email_semantic_links
      `);
      
      const stats = Array.isArray(statsResult) && statsResult.length > 0 
        ? statsResult[0] 
        : (statsResult?.rows && statsResult.rows.length > 0 ? statsResult.rows[0] : {});
        
      statsBefore = {
        totalLinks: parseInt(stats?.total_links || '0'),
        threadLinks: parseInt(stats?.thread_links || '0'),
        subjectLinks: parseInt(stats?.subject_links || '0'),
        semanticLinks: parseInt(stats?.semantic_links || '0'),
        highConfidenceLinks: parseInt(stats?.high_confidence_links || '0')
      };
    } catch (error) {
      log(`Error getting stats before: ${error.message}`);
      statsBefore = { totalLinks: 0, threadLinks: 0, subjectLinks: 0, semanticLinks: 0, highConfidenceLinks: 0 };
    }
    
    // Process email relationships
    const startTime = Date.now();
    const relationshipsCount = await emailChainService.updateEmailRelationships(
      accountId ? parseInt(accountId) : undefined,
      parseInt(limit),
      recentOnly
    );
    const duration = Date.now() - startTime;
    
    // Get basic stats after updating
    let statsAfter;
    try {
      const statsResult = await db.execute(sql`
        SELECT 
          COUNT(*) AS total_links,
          COUNT(*) FILTER (WHERE link_type = 'thread') AS thread_links,
          COUNT(*) FILTER (WHERE link_type = 'subject') AS subject_links,
          COUNT(*) FILTER (WHERE link_type = 'semantic') AS semantic_links,
          COUNT(*) FILTER (WHERE similarity_score >= 90) AS high_confidence_links
        FROM email_semantic_links
      `);
      
      const stats = Array.isArray(statsResult) && statsResult.length > 0 
        ? statsResult[0] 
        : (statsResult?.rows && statsResult.rows.length > 0 ? statsResult.rows[0] : {});
        
      statsAfter = {
        totalLinks: parseInt(stats?.total_links || '0'),
        threadLinks: parseInt(stats?.thread_links || '0'),
        subjectLinks: parseInt(stats?.subject_links || '0'),
        semanticLinks: parseInt(stats?.semantic_links || '0'),
        highConfidenceLinks: parseInt(stats?.high_confidence_links || '0')
      };
    } catch (error) {
      log(`Error getting stats after: ${error.message}`);
      statsAfter = { totalLinks: 0, threadLinks: 0, subjectLinks: 0, semanticLinks: 0, highConfidenceLinks: 0 };
    }
    
    res.json({
      success: true,
      message: `Processed ${relationshipsCount} email relationships in ${duration}ms`,
      statsBefore,
      statsAfter,
      performance: {
        totalMilliseconds: duration,
        relationsPerSecond: Math.round((relationshipsCount / duration) * 1000)
      }
    });
  } catch (error) {
    log(`Error updating email relationships: ${error.message}`);
    res.status(500).json({ error: 'Error updating email relationships' });
  }
});

export default router;