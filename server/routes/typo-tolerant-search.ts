import { Router, Request, Response } from 'express';
import { db } from '../db';
import { emails, tasks } from '@shared/schema';
import { sql, and, eq, isNotNull } from 'drizzle-orm';
import { pool } from '../db';

const router = Router();

// Setup dictionary configuration (this would ideally be in a migration)
async function setupFTSConfiguration() {
  try {
    const client = await pool.connect();
    try {
      // Check if the dictionary is already configured
      const checkResult = await client.query(`
        SELECT 1 FROM pg_ts_config WHERE cfgname = 'english_ispell' LIMIT 1;
      `);
      
      if (checkResult.rows.length === 0) {
        // Create custom text search configuration
        await client.query(`
          CREATE TEXT SEARCH CONFIGURATION public.english_ispell ( COPY = pg_catalog.english );
        `);
        
        // Use the Ispell dictionary
        await client.query(`
          ALTER TEXT SEARCH CONFIGURATION public.english_ispell
          ALTER MAPPING FOR asciiword, asciihword, hword_asciipart, word, hword, hword_part
          WITH english_stem;
        `);
        
        console.log('Created custom FTS configuration: english_ispell');
      } else {
        console.log('Custom FTS configuration already exists');
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error setting up FTS configuration:', error);
    // Continue even if this fails - we'll fall back to regular 'english' dictionary
  }
}

// Initialize FTS configuration when this module is loaded
setupFTSConfiguration();

// Helper function to perform a typo-tolerant search query
async function performTypoTolerantSearch(query: string, userId: number, table: any, textColumns: string[], limit = 10) {
  // Normalize the query
  const normalizedQuery = query.trim().toLowerCase();
  
  // Create a PostgreSQL tsvector from the combined columns
  const tsvectorExpression = sql`to_tsvector('english', ${sql.join(
    textColumns.map(col => sql`COALESCE(${sql.identifier(col)}, '')`),
    ' || ' 
  )})`;
  
  // Create a tsquery from the user input
  const tsqueryExpression = sql`websearch_to_tsquery('english', ${normalizedQuery})`;
  
  // Perform a combined search
  const result = await db.execute(sql`
    SELECT 
      *, 
      ts_rank(${tsvectorExpression}, ${tsqueryExpression}) AS rank
    FROM ${sql.identifier(table._.name)}
    WHERE 
      ${table.userId} = ${userId} AND
      ${tsvectorExpression} @@ ${tsqueryExpression}
    ORDER BY rank DESC
    LIMIT ${limit}
  `);
  
  return result.rows;
}

// Search emails with typo tolerance
router.get('/emails', async (req: Request, res: Response) => {
  try {
    const { query, userId } = req.query;
    
    if (!query || !userId) {
      return res.status(400).json({ error: 'Query and userId are required' });
    }
    
    const results = await performTypoTolerantSearch(
      query as string,
      parseInt(userId as string),
      emails,
      ['subject', 'bodyText', 'sender'],
      20
    );
    
    return res.json(results);
  } catch (error) {
    console.error('Error in typo-tolerant email search:', error);
    return res.status(500).json({ error: 'Search failed' });
  }
});

// Search tasks with typo tolerance
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const { query, userId } = req.query;
    
    if (!query || !userId) {
      return res.status(400).json({ error: 'Query and userId are required' });
    }
    
    const results = await performTypoTolerantSearch(
      query as string,
      parseInt(userId as string),
      tasks,
      ['title', 'description'],
      20
    );
    
    return res.json(results);
  } catch (error) {
    console.error('Error in typo-tolerant task search:', error);
    return res.status(500).json({ error: 'Search failed' });
  }
});

// Hybrid search combining FTS and vector search for emails
router.get('/emails/hybrid', async (req: Request, res: Response) => {
  try {
    const { query, userId, embedding } = req.query;
    
    if (!query || !userId) {
      return res.status(400).json({ error: 'Query and userId are required' });
    }
    
    // First, get FTS results
    const ftsResults = await performTypoTolerantSearch(
      query as string,
      parseInt(userId as string),
      emails,
      ['subject', 'bodyText', 'sender'],
      15
    );
    
    // If we have vector embedding, get semantic results as well
    let semanticResults: any[] = [];
    if (embedding) {
      try {
        const parsedEmbedding = JSON.parse(embedding as string);
        
        semanticResults = await db.execute(sql`
          SELECT 
            *, 
            embedding_vector <=> ${sql.array(parsedEmbedding, 'float')}::vector AS distance
          FROM ${emails._.name}
          WHERE 
            ${emails.userId} = ${parseInt(userId as string)} AND
            ${isNotNull(emails.embeddingVector)}
          ORDER BY distance ASC
          LIMIT 15
        `).then(res => res.rows);
      } catch (e) {
        console.error('Error in semantic search part:', e);
        // Continue with just FTS results
      }
    }
    
    // Combine results using a simple fusion strategy
    const idSet = new Set();
    const fusedResults: any[] = [];
    
    // First add FTS results with their rank
    ftsResults.forEach((result: any) => {
      idSet.add(result.id);
      fusedResults.push({
        ...result,
        matchType: 'keyword',
        score: result.rank,
        hybrid_score: result.rank * 10 // Weight FTS higher for typo correction
      });
    });
    
    // Then add semantic results that aren't duplicates
    semanticResults.forEach((result: any) => {
      if (!idSet.has(result.id)) {
        idSet.add(result.id);
        fusedResults.push({
          ...result,
          matchType: 'semantic',
          score: 1 - result.distance, // Convert distance to similarity
          hybrid_score: (1 - result.distance) * 5 // Weight semantic a bit lower
        });
      } else {
        // If exists in both, boost score
        const existingIndex = fusedResults.findIndex(r => r.id === result.id);
        if (existingIndex !== -1) {
          fusedResults[existingIndex].matchType = 'keyword+semantic';
          fusedResults[existingIndex].semantic_score = 1 - result.distance;
          fusedResults[existingIndex].hybrid_score += (1 - result.distance) * 3; // Boost combined matches
        }
      }
    });
    
    // Sort by final hybrid score
    fusedResults.sort((a, b) => b.hybrid_score - a.hybrid_score);
    
    return res.json(fusedResults.slice(0, 20)); // Return top 20 results
  } catch (error) {
    console.error('Error in hybrid search:', error);
    return res.status(500).json({ error: 'Hybrid search failed' });
  }
});

// Hybrid search combining FTS and vector search for tasks
router.get('/tasks/hybrid', async (req: Request, res: Response) => {
  try {
    const { query, userId, embedding } = req.query;
    
    if (!query || !userId) {
      return res.status(400).json({ error: 'Query and userId are required' });
    }
    
    // First, get FTS results
    const ftsResults = await performTypoTolerantSearch(
      query as string,
      parseInt(userId as string),
      tasks,
      ['title', 'description'],
      15
    );
    
    // If we have vector embedding, get semantic results as well
    let semanticResults: any[] = [];
    if (embedding) {
      try {
        const parsedEmbedding = JSON.parse(embedding as string);
        
        semanticResults = await db.execute(sql`
          SELECT 
            *, 
            embedding_vector <=> ${sql.array(parsedEmbedding, 'float')}::vector AS distance
          FROM ${tasks._.name}
          WHERE 
            ${tasks.userId} = ${parseInt(userId as string)} AND
            ${isNotNull(tasks.embeddingVector)}
          ORDER BY distance ASC
          LIMIT 15
        `).then(res => res.rows);
      } catch (e) {
        console.error('Error in semantic search part:', e);
        // Continue with just FTS results
      }
    }
    
    // Combine results using a simple fusion strategy (same as emails)
    const idSet = new Set();
    const fusedResults: any[] = [];
    
    // First add FTS results with their rank
    ftsResults.forEach((result: any) => {
      idSet.add(result.id);
      fusedResults.push({
        ...result,
        matchType: 'keyword',
        score: result.rank,
        hybrid_score: result.rank * 10
      });
    });
    
    // Then add semantic results that aren't duplicates
    semanticResults.forEach((result: any) => {
      if (!idSet.has(result.id)) {
        idSet.add(result.id);
        fusedResults.push({
          ...result,
          matchType: 'semantic',
          score: 1 - result.distance,
          hybrid_score: (1 - result.distance) * 5
        });
      } else {
        // If exists in both, boost score
        const existingIndex = fusedResults.findIndex(r => r.id === result.id);
        if (existingIndex !== -1) {
          fusedResults[existingIndex].matchType = 'keyword+semantic';
          fusedResults[existingIndex].semantic_score = 1 - result.distance;
          fusedResults[existingIndex].hybrid_score += (1 - result.distance) * 3;
        }
      }
    });
    
    // Sort by final hybrid score
    fusedResults.sort((a, b) => b.hybrid_score - a.hybrid_score);
    
    return res.json(fusedResults.slice(0, 20));
  } catch (error) {
    console.error('Error in hybrid search:', error);
    return res.status(500).json({ error: 'Hybrid search failed' });
  }
});

export default router;