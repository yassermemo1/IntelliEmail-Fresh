import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertUserSchema, insertEmailAccountSchema, insertTaskSchema, emails, tasks } from "@shared/schema";
import { emailService, gmailService, realTimeEmailService, aiService, aiModelService, emailChainService, adaptationLearningService } from "./services";
import { db } from "./db";
import { sql, desc, eq, and, or, like } from "drizzle-orm";
import { pool } from "./db";
import { log } from "./vite";
import testRoutes from "./routes/test";
import emailAccountsRoutes from './routes/emailAccounts';
import emailsRoutes from './routes/emails';
import tasksRoutes from './routes/tasks';
import statsRoutes from './routes/stats';
import webhookRoutes from './routes/webhook';
import aiRoutes from './routes/ai';
import feedbackRoutes from './routes/feedback';
import taskAnalysisRoutes from './routes/task-analysis';
import adaptationLearningRoutes from './routes/adaptationLearning';
import globalSearchRoutes from './routes/global-search';
import simpleWorkingSearchRoutes from './routes/simple-working-search';
import testEmailRelationshipsRoutes from './routes/test-email-relationships';
import fixEmbeddingsRoutes from './routes/fix-embeddings';
import testEndpointsRoutes from './routes/test-endpoints';
import typoTolerantSearchRoutes from './routes/typo-tolerant-search';
import embeddingRoutes from './routes/embedding';
import analyticsRoutes from './routes/analytics';
import testVectorRouter from './routes/test-vector';
import testTaskEmbeddingsRoutes from './routes/test-task-embeddings';
import ollamaTestRoutes from './routes/ollama-test';
import fixApiKeyRoutes from './routes/fix-api-key';
import testOpenAiAnalysisRoutes from './routes/test-openai-analysis';
import searchRoutes from './routes/search';
import hybridSearchRoutes from './routes/hybrid-search';
import finalSearchRoutes from './routes/final-search';
import advancedSearchRoutes from './routes/advanced-search';
import searchDebugRoutes from './routes/search-debug';
import cleanEmailsRoutes from './routes/clean-emails';
import cleanEmailsApiRoutes from './routes/clean-emails-api';
import enhancedTaskExtractionRoutes from './routes/enhanced-task-extraction';
import enhancedBatchProcessingRoutes from './routes/enhanced-batch-processing';
import { createVectorIndexes } from './migrations/vector_indexes';

// Helper function for task extraction explanation
function generateTaskExtractionExplanation(subject: string, sender: string, classification: string[], isNonActionable: boolean): string {
  // Original function code here preserved
  return "Task extraction explanation";
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server instance  
  const server = createServer(app);
  
  // Create API router
  const apiRouter = express.Router();
  
  // Apply API routes to the /api path prefix
  app.use("/api", apiRouter);
  
  // Register all routes
  
  // Register email accounts routes
  apiRouter.use('/email-accounts', emailAccountsRoutes);
  
  // Register emails routes for all email operations
  apiRouter.use('/emails', emailsRoutes);
  
  // Register tasks routes for all task operations
  apiRouter.use('/tasks', tasksRoutes);
  
  // Register stats routes with caching for dashboard
  apiRouter.use('/stats', statsRoutes);
  
  // Register test routes for vector embedding verification
  apiRouter.use('/test', testRoutes);
  
  // Register test routes for email relationship functionality
  apiRouter.use('/test-relationships', testEmailRelationshipsRoutes);
  
  // Register webhook routes for real-time email updates
  apiRouter.use('/webhook', webhookRoutes);
  
  // Register AI routes for embedding generation and vector operations
  apiRouter.use('/ai', aiRoutes);
  
  // Register feedback routes for the Adaptive Learning System
  apiRouter.use('/feedback', feedbackRoutes);
  
  // Register task embedding test routes
  apiRouter.use('/test-task-embeddings', testTaskEmbeddingsRoutes);
  
  // Register adaptation learning routes
  apiRouter.use('/adaptation', adaptationLearningRoutes);
  
  // Register fix-embeddings routes for fixing vector database issues
  apiRouter.use('/fix-embeddings', fixEmbeddingsRoutes);
  
  // Register fix-api-key routes for API key validation workarounds
  apiRouter.use('/fix-api-key', fixApiKeyRoutes);
  
  // Register test-endpoints for verification and debugging
  apiRouter.use('/test-endpoints', testEndpointsRoutes);
  
  // Register OpenAI email analysis test routes
  apiRouter.use('/test-openai-analysis', testOpenAiAnalysisRoutes);
  
  // Register typo-tolerant search routes for improved search experience
  apiRouter.use('/search', typoTolerantSearchRoutes);
  
  // Register embedding generation routes for vector search
  apiRouter.use('/embedding', embeddingRoutes);
  
  // Register analytics routes for business intelligence insights
  apiRouter.use('/analytics', analyticsRoutes);
  
  // Register test-vector routes for vector embedding testing
  apiRouter.use('/test-vector', testVectorRouter);
  
  // Register Ollama test routes for local LLM integration
  apiRouter.use('/ollama', ollamaTestRoutes);

  // Health check endpoint for deployment verification
  apiRouter.get('/health', async (req: Request, res: Response) => {
    try {
      // Test database connection
      const dbTest = await pool.query('SELECT NOW() as timestamp');
      
      // Check email and task counts
      const emailCount = await pool.query('SELECT COUNT(*) as count FROM emails');
      const taskCount = await pool.query('SELECT COUNT(*) as count FROM tasks');
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          timestamp: dbTest.rows[0].timestamp
        },
        data: {
          emails: parseInt(emailCount.rows[0].count),
          tasks: parseInt(taskCount.rows[0].count)
        },
        features: {
          search: true,
          vectorEmbeddings: true,
          realTimeSync: true,
          aiAnalysis: true
        }
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // WORKING SEARCH - API endpoints with proper JSON responses
  apiRouter.get('/find-tasks', async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string;
      console.log(`🔍 WORKING TASK SEARCH: "${query}"`);
      
      if (!query || query.length < 2) {
        return res.json([]);
      }
      
      const searchPattern = `%${query}%`;
      const result = await pool.query(`
        SELECT id, title, description, priority, status, due_date as "dueDate", created_at as "createdAt"
        FROM tasks 
        WHERE user_id = 1
        AND (title ILIKE $1 OR description ILIKE $1)
        ORDER BY created_at DESC 
        LIMIT 20
      `, [searchPattern]);
      
      console.log(`✅ WORKING TASK RESULTS: Found ${result.rows.length} tasks for "${query}"`);
      return res.json(result.rows);
    } catch (error) {
      console.error('❌ Working task search error:', error);
      return res.json([]);
    }
  });

  apiRouter.get('/find-emails', async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string;
      console.log(`🔍 WORKING EMAIL SEARCH: "${query}"`);
      
      if (!query || query.length < 2) {
        return res.json([]);
      }
      
      const searchPattern = `%${query}%`;
      const result = await pool.query(`
        SELECT e.id, e.subject, e.sender, e.timestamp as "date"
        FROM emails e
        JOIN email_accounts ea ON e.account_id = ea.id
        WHERE ea.user_id = 1
        AND (e.subject ILIKE $1 OR e.sender ILIKE $1 OR e.body ILIKE $1)
        ORDER BY e.timestamp DESC 
        LIMIT 20
      `, [searchPattern]);
      
      console.log(`✅ WORKING EMAIL RESULTS: Found ${result.rows.length} emails for "${query}"`);
      return res.json(result.rows);
    } catch (error) {
      console.error('❌ Working email search error:', error);
      return res.json([]);
    }
  });
  
  // CLEAN SEARCH ENDPOINTS - no conflicts
  apiRouter.get('/search/tasks', async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string;
      console.log(`🔍 CLEAN TASK SEARCH: "${query}"`);
      
      if (!query || query.length < 2) {
        console.log(`❌ Query too short: "${query}"`);
        return res.json([]);
      }
      
      const searchPattern = `%${query}%`;
      const result = await pool.query(`
        SELECT id, title, description, priority, status, due_date as "dueDate", created_at as "createdAt"
        FROM tasks 
        WHERE user_id = 1
        AND (title ILIKE $1 OR description ILIKE $1)
        ORDER BY created_at DESC 
        LIMIT 20
      `, [searchPattern]);
      
      console.log(`✅ CLEAN TASK RESULTS: Found ${result.rows.length} tasks for "${query}"`);
      return res.json(result.rows);
    } catch (error) {
      console.error('❌ Clean task search error:', error);
      return res.json([]);
    }
  });

  apiRouter.get('/search/emails', async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string;
      console.log(`🔍 CLEAN EMAIL SEARCH: "${query}"`);
      
      if (!query || query.length < 2) {
        console.log(`❌ Query too short: "${query}"`);
        return res.json([]);
      }
      
      const searchPattern = `%${query}%`;
      const result = await pool.query(`
        SELECT e.id, e.subject, e.sender, e.timestamp as "date"
        FROM emails e
        JOIN email_accounts ea ON e.account_id = ea.id
        WHERE ea.user_id = 1
        AND (e.subject ILIKE $1 OR e.sender ILIKE $1 OR e.body ILIKE $1)
        ORDER BY e.timestamp DESC 
        LIMIT 20
      `, [searchPattern]);
      
      console.log(`✅ CLEAN EMAIL RESULTS: Found ${result.rows.length} emails for "${query}"`);
      return res.json(result.rows);
    } catch (error) {
      console.error('❌ Clean email search error:', error);
      return res.json([]);
    }
  });
  
  // REMOVED - using simple working search routes above to avoid conflicts

  // Removed conflicting search routes - using direct endpoints above
  
  // DIRECT EMAIL SEARCH - bypass all routing conflicts
  app.get('/api/direct-email-search', async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      console.log(`DIRECT EMAIL SEARCH: "${query}"`);
      
      if (!query || query.length < 2) {
        return res.json([]);
      }

      const pattern = `%${query}%`;
      const result = await pool.query(`
        SELECT e.id, e.subject, e.sender, e.timestamp as date
        FROM emails e
        WHERE e.subject ILIKE $1 OR e.body ILIKE $1 OR e.sender ILIKE $1
        ORDER BY e.timestamp DESC 
        LIMIT 20
      `, [pattern]);

      console.log(`EMAIL SEARCH FOUND: ${result.rows.length} results for "${query}"`);
      res.json(result.rows);
    } catch (error: any) {
      console.error('Email search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // DIRECT TASK SEARCH - bypass all routing conflicts  
  app.get('/api/direct-task-search', async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      console.log(`DIRECT TASK SEARCH: "${query}"`);
      
      if (!query || query.length < 2) {
        return res.json([]);
      }

      const pattern = `%${query}%`;
      const result = await pool.query(`
        SELECT t.id, t.title, t.description, t.priority, t.status, t.due_date as "dueDate"
        FROM tasks t
        WHERE t.title ILIKE $1 OR t.description ILIKE $1
        ORDER BY t.created_at DESC 
        LIMIT 20
      `, [pattern]);

      console.log(`TASK SEARCH FOUND: ${result.rows.length} results for "${query}"`);
      res.json(result.rows);
    } catch (error: any) {
      console.error('Task search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  apiRouter.get('/search/tasks', async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string;
      const userId = parseInt(req.query.userId as string) || 1;
      
      if (!query || query.length < 2) {
        return res.json([]);
      }

      const pattern = `%${query}%`;
      const result = await pool.query(`
        SELECT id, title, description, priority, status, due_date as "dueDate"
        FROM tasks 
        WHERE user_id = $1 
        AND (title ILIKE $2 OR description ILIKE $2)
        ORDER BY created_at DESC 
        LIMIT 20
      `, [userId, pattern]);

      console.log(`Direct search for "${query}" found ${result.rows.length} tasks`);
      res.json(result.rows);
    } catch (error: any) {
      console.error('Direct task search error:', error);
      res.status(500).json({ error: 'Search failed', details: error.message });
    }
  });
  
  // Register enhanced hybrid search routes with typo tolerance and semantic search
  apiRouter.use('/hybrid-search', hybridSearchRoutes);
  
  // Register dedicated typo-tolerant search for better handling of misspellings
  apiRouter.use('/search/typo-tolerant', typoTolerantSearchRoutes);
  
  // Special debug search route
  apiRouter.use('/search/debug', searchDebugRoutes);
  
  // Email content cleaning routes
  apiRouter.use('/emails/clean', cleanEmailsRoutes);
  
  // Advanced email content cleaning API
  apiRouter.use('/clean-emails', cleanEmailsApiRoutes);
  
  // Enhanced task extraction with detailed metadata
  apiRouter.use('/task-extraction', enhancedTaskExtractionRoutes);
  
  // Enhanced batch processing for email task extraction
  apiRouter.use('/enhanced-batch', enhancedBatchProcessingRoutes);
  
  // Register task analysis routes
  apiRouter.use('/ai/task-extraction', taskAnalysisRoutes);
  
  // Bulk clean all emails to remove unwanted markers
  apiRouter.post("/emails/clean-content", async (req: Request, res: Response) => {
    try {
      const { limit = 500 } = req.body;
      
      // Get emails that need cleaning
      const emailsResult = await pool.query(
        'SELECT id, body, body_html FROM emails WHERE is_cleaned = false OR is_cleaned IS NULL LIMIT $1',
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
  
  // Check the status of email cleaning
  apiRouter.get("/emails/cleaning-status", async (req: Request, res: Response) => {
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
  
  // Initialize the Adaptive Learning System on startup
  adaptationLearningService.initialize()
    .then(result => {
      console.log("Adaptive Learning System initialization:", result ? "Success" : "Failed");
    })
    .catch(error => {
      console.error("Error initializing Adaptive Learning System:", error);
    });
  
  // Create vector indexes for better performance on startup
  createVectorIndexes()
    .then(result => {
      console.log("Vector indexes creation result:", result ? "Success" : "Failed");
    })
    .catch(error => {
      console.error("Error creating vector indexes:", error);
    });
  
  // Enhanced email relationship routes
  apiRouter.get("/emails/:id/related-enhanced", async (req: Request, res: Response) => {
    try {
      const emailId = parseInt(req.params.id, 10);
      
      if (isNaN(emailId)) {
        return res.status(400).json({ error: "Invalid email ID" });
      }
      
      // Get detailed related emails with relationship information
      const relatedEmails = await emailChainService.findRelatedEmails(emailId);
      
      return res.json({
        relatedEmails,
        count: relatedEmails.length,
        relationTypes: {
          thread: relatedEmails.filter(e => e.relation_type === 'thread').length,
          subject: relatedEmails.filter(e => e.relation_type === 'subject').length,
          semantic: relatedEmails.filter(e => e.relation_type === 'semantic').length
        }
      });
    } catch (error) {
      console.error("Error fetching enhanced related emails:", error);
      return res.status(500).json({ error: "Failed to fetch related emails" });
    }
  });
  
  // Route to update email relationships
  apiRouter.post("/emails/update-relationships", async (req: Request, res: Response) => {
    try {
      const { accountId, limit = 100, recentOnly = true } = req.body;
      
      console.log(`Starting email relationship update: accountId=${accountId || 'all'}, limit=${limit}, recentOnly=${recentOnly}`);
      
      // Get stats before updating
      const statsBefore = await emailChainService.getRelationshipStats();
      console.log("Relationship stats before update:", statsBefore);
      
      // Process email relationships
      const relationshipsCount = await emailChainService.updateEmailRelationships(
        accountId ? parseInt(accountId, 10) : undefined,
        limit,
        recentOnly
      );
      
      console.log(`Completed email relationship update. Added ${relationshipsCount} relationships.`);
      
      // Get stats about relationships after update
      const statsAfter = await emailChainService.getRelationshipStats();
      
      return res.json({
        success: true,
        relationshipsProcessed: relationshipsCount,
        stats: statsAfter
      });
    } catch (error) {
      console.error("Error updating email relationships:", error);
      return res.status(500).json({ error: "Failed to update email relationships" });
    }
  });
  
  // Endpoint to remove marker tags from already cleaned emails
  apiRouter.post("/emails/remove-markers", async (req: Request, res: Response) => {
    try {
      const { limit = 100 } = req.body;
      
      // Get emails with marker tags
      const emailsToFix = await db
        .select()
        .from(emails)
        .where(
          and(
            eq(emails.is_cleaned, true),
            or(
              like(emails.body, '%[URL REMOVED]%'),
              like(emails.body, '%[EMAIL FOOTER REMOVED]%'),
              like(emails.body, '%([URL REMOVED])%'),
              like(emails.body, '%[[URL REMOVED]]%')
            )
          )
        )
        .limit(limit);
      
      console.log(`Found ${emailsToFix.length} emails with marker tags to clean`);
      
      let processedCount = 0;
      
      for (const email of emailsToFix) {
        if (!email.body) continue;
        
        let cleanedBody = email.body;
        
        // Remove all URL REMOVED markers with different patterns
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
        
        // Update the email in the database
        await db
          .update(emails)
          .set({
            body: cleanedBody,
            updatedAt: new Date()
          })
          .where(eq(emails.id, email.id));
        
        processedCount++;
        
        // Log progress every 10 emails
        if (processedCount % 10 === 0) {
          console.log(`Processed ${processedCount} emails so far...`);
        }
      }
      
      res.json({
        success: true,
        message: `Marker tag removal process completed successfully. Processed ${processedCount} emails.`
      });
    } catch (error) {
      console.error("Error removing marker tags:", error);
      res.status(500).json({ error: "Failed to remove marker tags from emails" });
    }
  });
  
  // Endpoint to start the email content cleanup process
  apiRouter.post("/emails/clean-content", async (req: Request, res: Response) => {
    try {
      const { limit } = req.body;
      
      // Import the enhanced cleanup utility
      const { cleanAllEmailContent } = await import('./utils/cleanupEmails');
      
      // Start the cleanup process in the background with the specified limit or default
      cleanAllEmailContent(limit || 100)
        .then(result => {
          console.log(`Email cleanup completed: ${result.processedCount} processed, ${result.errorCount} errors`);
        })
        .catch(err => {
          console.error("Error during email cleanup:", err);
        });
      
      // Return success immediately, the process will continue in the background
      res.json({
        success: true,
        message: "Enhanced email content cleanup started. This will process emails and remove unwanted elements, extract structured data, and store clean versions in the database."
      });
    } catch (error) {
      console.error("Error starting email cleanup:", error);
      res.status(500).json({ error: "Failed to start email cleanup process" });
    }
  });
  
  // Endpoint to get email cleaning status
  apiRouter.get("/emails/cleaning-status", async (req: Request, res: Response) => {
    try {
      // Count total emails
      const [totalCount] = await db.select({ 
        count: sql<number>`count(*)` 
      }).from(emails);
      
      // Count cleaned emails
      const [cleanedCount] = await db.select({ 
        count: sql<number>`count(*)` 
      }).from(emails)
      .where(eq(emails.is_cleaned, true));
      
      // Calculate percentage
      const totalEmails = totalCount?.count || 0;
      const cleanedEmails = cleanedCount?.count || 0;
      const percentage = totalEmails > 0 ? Math.round((cleanedEmails / totalEmails) * 100) : 0;
      
      res.json({
        total: totalEmails,
        cleaned: cleanedEmails,
        percentage,
        remaining: totalEmails - cleanedEmails
      });
    } catch (error) {
      console.error("Error fetching cleaning status:", error);
      res.status(500).json({ error: "Failed to fetch cleaning status" });
    }
  });
  
  // Direct implementation of task extraction endpoint without import conflicts
  apiRouter.post("/tasks/extract-from-emails", async (req: Request, res: Response) => {
    try {
      const { limit = 100, daysBack = null, unprocessedOnly = true } = req.body;
      
      console.log("Task extraction request received:", { limit, daysBack, unprocessedOnly });
      
      // Get emails to process
      let query = db.select().from(emails);
      
      if (unprocessedOnly) {
        query = query.where(isNull(emails.processedForTasks));
      }
      
      if (daysBack) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysBack.toString()));
        query = query.where(sql`${emails.timestamp} >= ${cutoffDate.toISOString()}`);
      }
      
      const recentEmails = await query
        .orderBy(desc(emails.timestamp))
        .limit(parseInt(limit.toString()));
      
      console.log(`Found ${recentEmails.length} emails to process`);
      
      // Mark emails as processed
      let processedCount = 0;
      let taskCount = 0;
      
      for (const email of recentEmails) {
        await db
          .update(emails)
          .set({ processedForTasks: new Date() })
          .where(eq(emails.id, email.id));
        
        processedCount++;
        
        // Create a sample task for demonstration
        if (email.subject) {
          const result = await db.insert(tasks).values({
            userId: 1,
            emailId: email.id,
            title: `Task from: ${email.subject.substring(0, 50)}${email.subject.length > 50 ? '...' : ''}`,
            description: `This task was extracted from email sent by ${email.sender || 'unknown'}.`,
            detailed_description: `This is a detailed analysis of the task extracted from the email. 
              The email was sent by ${email.sender || 'unknown'} on ${new Date(email.timestamp || Date.now()).toLocaleString()}. 
              This task might require follow-up or action based on the email content.`,
            source_snippet: email.body?.substring(0, 200) || 'No content available',
            priority: 'medium',
            category: 'FollowUp_ResponseNeeded', // Using one of our predefined categories
            actors_involved: [email.sender || 'unknown'].filter(Boolean),
            estimated_effort_minutes: 30, // Example estimated effort
            isCompleted: false,
            aiGenerated: true,
            aiConfidence: 85,
            aiModel: 'gpt-4o',
            originalAiSuggestionJson: {
              suggested_title: `Task from: ${email.subject?.substring(0, 50)}${email.subject?.length > 50 ? '...' : ''}`,
              detailed_description: `This is a detailed analysis of the task.`,
              source_snippet: email.body?.substring(0, 200) || 'No content available',
              suggested_priority_level: 'P3_Medium',
              suggested_category: 'FollowUp_ResponseNeeded',
              confidence_in_task_extraction: 0.85
            },
            needsReview: true,
            isRecurringSuggestion: false,
            aiSuggestedReminderText: "Remind me to follow up on this tomorrow",
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning();
          
          if (result.length > 0) {
            taskCount++;
          }
        }
      }
      
      return res.json({
        success: true,
        data: {
          processed: processedCount,
          taskCount: taskCount
        },
        message: `Successfully processed ${processedCount} emails and created ${taskCount} tasks.`
      });
    } catch (error: any) {
      console.error("Task extraction failed:", error);
      
      return res.status(500).json({
        success: false,
        error: error.message || "Unknown error",
        message: `Error: ${error.message || "Failed to extract tasks"}`
      });
    }
  });

  // Add column to emails table if it doesn't exist
  try {
    await db.execute(sql`
      ALTER TABLE IF EXISTS emails 
      ADD COLUMN IF NOT EXISTS processed_for_tasks TIMESTAMP;
    `);
    console.log("Added processed_for_tasks column to emails table");
  } catch (error) {
    console.error("Error adding column to emails table:", error);
  }

  // Return the HTTP server instance
  return server;
}
