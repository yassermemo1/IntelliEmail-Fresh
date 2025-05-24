import express, { Request, Response } from 'express';
import { pool } from '../db';
import { debugLogger } from '../utils/debugLogger';
import { OpenAI } from 'openai';

const router = express.Router();

/**
 * Global Search Endpoint
 * Combines database queries, vector embeddings, and RAG functionality
 */
router.get('/global', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    debugLogger.searchLog('global_search_start', query);
    
    if (!query || query.length < 2) {
      debugLogger.searchLog('global_search_too_short', query);
      return res.json({
        query,
        results: {
          tasks: [],
          emails: [],
          vectorResults: [],
          ragSummary: null
        },
        searchMethods: []
      });
    }

    const searchResults: {
      tasks: any[];
      emails: any[];
      vectorResults: any[];
      ragSummary: any;
      searchMethods: string[];
    } = {
      tasks: [],
      emails: [],
      vectorResults: [],
      ragSummary: null,
      searchMethods: []
    };

    // 1. Traditional Database Search
    debugLogger.dbLog('global_search_database', { query });
    try {
      const searchPattern = `%${query}%`;
      
      // Search tasks
      const taskResults = await pool.query(`
        SELECT 
          id, title, description, priority, status, 
          due_date as "dueDate", created_at as "createdAt",
          'database' as search_method
        FROM tasks 
        WHERE user_id = 1
        AND (title ILIKE $1 OR description ILIKE $1)
        ORDER BY created_at DESC 
        LIMIT 10
      `, [searchPattern]);
      
      // Search emails
      const emailResults = await pool.query(`
        SELECT 
          e.id, e.subject, e.sender, e.timestamp as "date",
          'database' as search_method
        FROM emails e
        JOIN email_accounts ea ON e.account_id = ea.id
        WHERE ea.user_id = 1
        AND (e.subject ILIKE $1 OR e.sender ILIKE $1 OR e.body ILIKE $1)
        ORDER BY e.timestamp DESC 
        LIMIT 10
      `, [searchPattern]);

      searchResults.tasks = taskResults.rows;
      searchResults.emails = emailResults.rows;
      searchResults.searchMethods.push('database');
      
      debugLogger.dbLog('database_search_complete', {
        tasks: taskResults.rows.length,
        emails: emailResults.rows.length
      });
    } catch (dbError) {
      debugLogger.error('search', 'Database search failed', dbError);
    }

    // 2. Vector/Embedding Search
    debugLogger.vectorLog('global_search_vector', { query });
    try {
      // Generate embedding for the search query using OpenAI
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      let queryEmbedding: number[] = [];
      
      if (process.env.OPENAI_API_KEY) {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: query
        });
        queryEmbedding = embeddingResponse.data[0].embedding;
      }
      debugLogger.embeddingLog('query_embedding_generated', { 
        dimensions: queryEmbedding.length,
        query 
      });

      if (queryEmbedding && queryEmbedding.length > 0) {
        // Vector search for tasks
        const vectorTaskResults = await pool.query(`
          SELECT 
            id, title, description, priority, status,
            due_date as "dueDate", created_at as "createdAt",
            embedding_vector <-> $1::vector as distance,
            'vector' as search_method
          FROM tasks 
          WHERE user_id = 1 
          AND embedding_vector IS NOT NULL
          ORDER BY embedding_vector <-> $1::vector
          LIMIT 5
        `, [`[${queryEmbedding.join(',')}]`]);

        // Vector search for emails
        const vectorEmailResults = await pool.query(`
          SELECT 
            e.id, e.subject, e.sender, e.timestamp as "date",
            e.embedding_vector <-> $1::vector as distance,
            'vector' as search_method
          FROM emails e
          JOIN email_accounts ea ON e.account_id = ea.id
          WHERE ea.user_id = 1 
          AND e.embedding_vector IS NOT NULL
          ORDER BY e.embedding_vector <-> $1::vector
          LIMIT 5
        `, [`[${queryEmbedding.join(',')}]`]);

        searchResults.vectorResults = [
          ...vectorTaskResults.rows.map(r => ({ ...r, type: 'task' })),
          ...vectorEmailResults.rows.map(r => ({ ...r, type: 'email' }))
        ];
        searchResults.searchMethods.push('vector');
        
        debugLogger.vectorLog('vector_search_complete', {
          taskResults: vectorTaskResults.rows.length,
          emailResults: vectorEmailResults.rows.length
        });
      }
    } catch (vectorError) {
      debugLogger.error('search', 'Vector search failed', vectorError);
    }

    // 3. RAG (Retrieval Augmented Generation) Summary
    debugLogger.aiLog('global_search_rag', 'text-embedding-ada-002', { query });
    try {
      const totalResults = searchResults.tasks.length + searchResults.emails.length + searchResults.vectorResults.length;
      
      if (totalResults > 0) {
        // Create a summary of findings for RAG
        const taskTitles = searchResults.tasks.map(t => t.title).slice(0, 5);
        const emailSubjects = searchResults.emails.map(e => e.subject).slice(0, 5);
        
        searchResults.ragSummary = {
          searchQuery: query,
          totalResults,
          taskMatches: searchResults.tasks.length,
          emailMatches: searchResults.emails.length,
          vectorMatches: searchResults.vectorResults.length,
          keyFindings: {
            topTaskTitles: taskTitles,
            topEmailSubjects: emailSubjects
          },
          searchContext: `Found ${totalResults} total results for "${query}" across tasks and emails using database and vector search methods.`
        };
        searchResults.searchMethods.push('rag');
        
        debugLogger.analysisLog('rag_summary_generated', searchResults.ragSummary);
      }
    } catch (ragError) {
      debugLogger.error('search', 'RAG summary failed', ragError);
    }

    // Final response
    debugLogger.searchLog('global_search_complete', query, {
      totalTasks: searchResults.tasks.length,
      totalEmails: searchResults.emails.length,
      totalVectorResults: searchResults.vectorResults.length,
      methods: searchResults.searchMethods
    });

    return res.json({
      query,
      results: searchResults,
      searchMethods: searchResults.searchMethods,
      totalResults: searchResults.tasks.length + searchResults.emails.length + searchResults.vectorResults.length
    });

  } catch (error) {
    debugLogger.error('search', 'Global search failed', error);
    return res.status(500).json({ 
      error: 'Global search failed', 
      query: req.query.q,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;