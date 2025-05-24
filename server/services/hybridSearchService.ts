/**
 * Hybrid Search Service
 * 
 * Combines full-text search (for typo tolerance) with semantic vector search (for meaning)
 * to provide a more robust and user-friendly search experience.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { emails, tasks } from '@shared/schema';
import { eq, and, ilike } from 'drizzle-orm/expressions';
import { embeddingService } from './embeddingService';
import { log } from '../vite';

// Result types to unify search results
export type SearchResultType = 'email' | 'task';

export interface SearchResult {
  id: number;
  type: SearchResultType;
  score: number;
  title: string;
  description?: string;
  date?: string;
  matchType: 'fulltext' | 'semantic' | 'hybrid';
  // Email-specific fields
  sender?: string;
  subject?: string;
  // Task-specific fields
  priority?: string;
  dueDate?: string;
  status?: string;
}

export interface SearchOptions {
  limit?: number;
  includeFullText?: boolean;
  includeSemantic?: boolean;
  combineResults?: boolean;
}

class HybridSearchService {
  /**
   * Perform a hybrid search across emails and tasks
   * Combines full-text search for typo tolerance with semantic search for meaning
   */
  async search(userId: number, query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const {
      limit = 20,
      includeFullText = true,
      includeSemantic = true,
      combineResults = true
    } = options;
    
    let results: SearchResult[] = [];
    
    try {
      // 1. Full-text search (handles typos)
      if (includeFullText) {
        const ftsResults = await this.performFullTextSearch(userId, query, limit);
        if (!combineResults) {
          return ftsResults;
        }
        results = [...ftsResults];
      }
      
      // 2. Semantic search (handles meaning)
      if (includeSemantic) {
        const semanticResults = await this.performSemanticSearch(userId, query, limit);
        if (!combineResults) {
          return semanticResults;
        }
        
        // 3. Combine and deduplicate results if both search types are used
        if (includeFullText) {
          // Add semantic results that weren't already found by full-text search
          for (const semanticResult of semanticResults) {
            const existingResult = results.find(
              r => r.id === semanticResult.id && r.type === semanticResult.type
            );
            
            if (existingResult) {
              // Update existing result to show it matched both search types
              existingResult.matchType = 'hybrid';
              // Use the higher of the two scores
              existingResult.score = Math.max(existingResult.score, semanticResult.score);
            } else {
              // Add new result from semantic search
              results.push(semanticResult);
            }
          }
        } else {
          results = semanticResults;
        }
      }
      
      // Sort by score (descending) and limit results
      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
        
    } catch (error) {
      log(`Error in hybrid search: ${error.message}`, 'error');
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Perform full-text search against PostgreSQL tsvector columns
   * This provides excellent typo tolerance
   */
  private async performFullTextSearch(userId: number, query: string, limit: number): Promise<SearchResult[]> {
    try {
      // Clean and prepare the query for full-text search
      const cleanQuery = query.trim();
      
      // Create the tsquery with typo tolerance using PostgreSQL's similarity features
      const tsQuery = this.createFuzzyTsQuery(cleanQuery);
      
      // Email full-text search with extra typo tolerance
      const emailResults = await db.execute(sql`
        SELECT 
          e.id, 
          e.subject as title, 
          e.sender, 
          SUBSTRING(e.body, 1, 150) as description,
          e.received_date as date,
          ts_rank_cd(e.search_vector, to_tsquery('english', ${tsQuery})) as score
        FROM emails e
        JOIN email_accounts a ON e.account_id = a.id
        WHERE 
          a.user_id = ${userId} AND
          (
            e.search_vector @@ to_tsquery('english', ${tsQuery})
            OR
            -- Add extra fuzzy matching for typo tolerance using ILIKE
            -- This helps catch typos like "intersting" when user meant "interesting"
            (
              ${cleanQuery.length > 3} AND (
                e.subject ILIKE ${`%${cleanQuery}%`} OR
                e.sender ILIKE ${`%${cleanQuery}%`} OR
                e.body ILIKE ${`%${cleanQuery}%`}
              )
            )
          )
        ORDER BY 
          ts_rank_cd(e.search_vector, to_tsquery('english', ${tsQuery})) DESC,
          -- Second sort criteria for results that matched by ILIKE
          CASE WHEN e.subject ILIKE ${`%${cleanQuery}%`} THEN 1.0
               WHEN e.sender ILIKE ${`%${cleanQuery}%`} THEN 0.8
               WHEN e.body ILIKE ${`%${cleanQuery}%`} THEN 0.6
               ELSE 0 END DESC
        LIMIT ${limit}
      `);

      // Task full-text search with extra typo tolerance
      const taskResults = await db.execute(sql`
        SELECT 
          t.id, 
          t.title, 
          t.description, 
          t.priority,
          t.status,
          t.due_date,
          t.created_at as date,
          ts_rank_cd(t.search_vector, to_tsquery('english', ${tsQuery})) as score
        FROM tasks t
        WHERE 
          t.user_id = ${userId} AND
          (
            t.search_vector @@ to_tsquery('english', ${tsQuery})
            OR
            -- Add extra fuzzy matching for typo tolerance using ILIKE
            -- This helps catch typos like "intersting" when user meant "interesting"
            (
              ${cleanQuery.length > 3} AND (
                t.title ILIKE ${`%${cleanQuery}%`} OR
                t.description ILIKE ${`%${cleanQuery}%`}
              )
            )
          )
        ORDER BY 
          ts_rank_cd(t.search_vector, to_tsquery('english', ${tsQuery})) DESC,
          -- Second sort criteria for results that matched by ILIKE
          CASE WHEN t.title ILIKE ${`%${cleanQuery}%`} THEN 1.0
               WHEN t.description ILIKE ${`%${cleanQuery}%`} THEN 0.7
               ELSE 0 END DESC
        LIMIT ${limit}
      `);

      // Transform to unified search result format
      const transformedEmailResults = (emailResults as any[]).map(email => ({
        id: email.id,
        type: 'email' as SearchResultType,
        title: email.title,
        description: email.description,
        sender: email.sender,
        subject: email.title,
        date: email.date,
        score: parseFloat(email.score || '0'),
        matchType: 'fulltext' as const
      }));

      const transformedTaskResults = (taskResults as any[]).map(task => ({
        id: task.id,
        type: 'task' as SearchResultType,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        dueDate: task.due_date,
        date: task.date,
        score: parseFloat(task.score || '0'),
        matchType: 'fulltext' as const
      }));

      // Combine and sort by score
      return [...transformedEmailResults, ...transformedTaskResults]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      log(`Error in full-text search: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * Create a fuzzy tsquery to handle typos and variations in search terms
   * Uses OR operator and word stems with prefix matching
   */
  private createFuzzyTsQuery(query: string): string {
    // Split into words, clean, and handle special characters
    const words = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Replace special chars with spaces
      .split(/\s+/)              // Split on whitespace
      .filter(word => word.length > 1);  // Filter out single characters
    
    if (words.length === 0) {
      return '';
    }
    
    // Create a query with fuzzy matching capabilities for typo tolerance
    // For each word:
    // 1. Add exact match
    // 2. Add prefix matching with :* operator
    // 3. Add similar word matches with % for fuzzy matching
    const tsQueryTerms = words.map(word => {
      // For short words (3 chars or less), just do prefix matching
      if (word.length <= 3) {
        return `${word}:*`;
      }
      
      // For longer words, add more fuzzy options to catch typos
      return `${word} | ${word}:* | ${word}:*%`;
    });
    
    // Join with OR operators for maximum typo tolerance
    return tsQueryTerms.join(' | ');
  }

  /**
   * Perform semantic vector search using embeddings
   */
  private async performSemanticSearch(userId: number, query: string, limit: number): Promise<SearchResult[]> {
    try {
      // Generate embedding for the query text
      const embedding = await embeddingService.generateEmbedding(query);
      if (!embedding || embedding.length === 0) {
        log('Failed to generate embedding for search query', 'error');
        return [];
      }
      
      // Search emails using vector similarity
      const emailResults = await db.execute(sql`
        SELECT 
          e.id, 
          e.subject as title, 
          e.sender,
          SUBSTRING(e.body, 1, 150) as description,
          e.received_date as date,
          1 - (e.embedding_vector <=> '[' || ${embedding.join(',')} || ']'::vector) as score
        FROM emails e
        JOIN email_accounts a ON e.account_id = a.id
        WHERE a.user_id = ${userId} AND e.embedding_vector IS NOT NULL
        ORDER BY score DESC
        LIMIT ${limit}
      `);

      // Search tasks using vector similarity
      const taskResults = await db.execute(sql`
        SELECT 
          t.id, 
          t.title, 
          t.description, 
          t.priority,
          t.status,
          t.due_date,
          t.created_at as date,
          1 - (t.embedding_vector <=> '[' || ${embedding.join(',')} || ']'::vector) as score
        FROM tasks t
        WHERE t.user_id = ${userId} AND t.embedding_vector IS NOT NULL
        ORDER BY score DESC
        LIMIT ${limit}
      `);

      // Transform to unified search result format
      const transformedEmailResults = (emailResults as any[]).map(email => ({
        id: email.id,
        type: 'email' as SearchResultType,
        title: email.title,
        description: email.description,
        sender: email.sender,
        subject: email.title,
        date: email.date,
        score: parseFloat(email.score || '0'),
        matchType: 'semantic' as const
      }));

      const transformedTaskResults = (taskResults as any[]).map(task => ({
        id: task.id,
        type: 'task' as SearchResultType,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        dueDate: task.due_date,
        date: task.date,
        score: parseFloat(task.score || '0'),
        matchType: 'semantic' as const
      }));

      // Combine and sort by score
      return [...transformedEmailResults, ...transformedTaskResults]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      log(`Error in semantic search: ${error.message}`, 'error');
      return [];
    }
  }
}

export const hybridSearchService = new HybridSearchService();