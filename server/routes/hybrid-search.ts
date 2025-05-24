/**
 * Hybrid Search Routes
 * 
 * Implements enhanced search functionality that combines:
 * - Full-text search with typo tolerance
 * - Semantic vector search for meaning
 */

import { Router, Request, Response } from 'express';
import { hybridSearchService } from '../services/hybridSearchService';
import { log } from '../vite';
import { z } from 'zod';

const router = Router();

// Validate search parameters
const searchParamsSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  limit: z.coerce.number().int().positive().optional(),
  semanticOnly: z.boolean().optional(),
  ftsOnly: z.boolean().optional(),
});

/**
 * Global search endpoint that combines Full-Text Search and Semantic Search 
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session.user?.id || 1; // Default to user 1 for testing
    
    // Parse and validate search parameters
    const params = searchParamsSchema.safeParse({
      q: req.query.q,
      limit: req.query.limit,
      semanticOnly: req.query.semanticOnly === 'true',
      ftsOnly: req.query.ftsOnly === 'true',
    });
    
    if (!params.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid search parameters',
        errors: params.error.format()
      });
    }
    
    const { q: query, limit = 20, semanticOnly = false, ftsOnly = false } = params.data;
    
    // Log the search attempt
    log(`Hybrid search: "${query}" (FTS only: ${ftsOnly}, Semantic only: ${semanticOnly})`, 'search');
    
    // Set search options
    const includeFullText = !semanticOnly;
    const includeSemantic = !ftsOnly;
    
    // Perform hybrid search
    const searchResults = await hybridSearchService.search(userId, query, {
      limit,
      includeFullText,
      includeSemantic,
      combineResults: includeFullText && includeSemantic
    });
    
    // Organize results by type
    const emailResults = searchResults.filter(result => result.type === 'email');
    const taskResults = searchResults.filter(result => result.type === 'task');
    
    return res.json({
      success: true,
      query,
      emails: emailResults,
      tasks: taskResults,
      totalResults: searchResults.length,
      searchType: semanticOnly ? 'semantic' : (ftsOnly ? 'fulltext' : 'hybrid')
    });
  } catch (error) {
    log(`Error performing hybrid search: ${error.message}`, 'error');
    return res.status(500).json({
      success: false, 
      message: 'Failed to perform search',
      error: error.message
    });
  }
});

/**
 * Search diagnostics endpoint that shows results from both search methods separately
 * Useful for debugging and comparing search approaches
 */
router.get('/compare', async (req: Request, res: Response) => {
  try {
    // Get user ID from session
    const userId = req.session.user?.id || 1; // Default to user 1 for testing
    
    // Parse and validate search parameters
    const params = searchParamsSchema.safeParse({
      q: req.query.q,
      limit: req.query.limit,
    });
    
    if (!params.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid search parameters',
        errors: params.error.format()
      });
    }
    
    const { q: query, limit = 10 } = params.data;
    
    // Log the search attempt
    log(`Comparing search methods for: "${query}"`, 'search');
    
    // Perform full-text search only
    const ftsResults = await hybridSearchService.search(userId, query, {
      limit,
      includeFullText: true,
      includeSemantic: false,
    });
    
    // Perform semantic search only
    const semanticResults = await hybridSearchService.search(userId, query, {
      limit,
      includeFullText: false,
      includeSemantic: true,
    });
    
    // Perform hybrid search (combined results)
    const hybridResults = await hybridSearchService.search(userId, query, {
      limit,
      includeFullText: true,
      includeSemantic: true,
      combineResults: true
    });
    
    return res.json({
      success: true,
      query,
      ftsResults,
      semanticResults,
      hybridResults,
      comparison: {
        ftsCount: ftsResults.length,
        semanticCount: semanticResults.length,
        hybridCount: hybridResults.length,
      }
    });
  } catch (error) {
    log(`Error comparing search methods: ${error.message}`, 'error');
    return res.status(500).json({
      success: false,
      message: 'Failed to compare search methods',
      error: error.message
    });
  }
});

export default router;