import { db } from "../db";
import { sql } from "drizzle-orm";
import { log } from "../vite";

/**
 * Create HNSW vector indexes for improved vector search performance
 * This significantly speeds up vector similarity searches in pgvector
 */
export async function createVectorIndexes(): Promise<boolean> {
  try {
    // Check if vector extension is enabled first
    const vectorExtensionCheck = await db.execute(sql`
      SELECT 1 FROM pg_extension WHERE extname = 'vector'
    `);
    
    const vectorEnabled = (vectorExtensionCheck?.rows?.length || 0) > 0;
    
    if (!vectorEnabled) {
      log("Vector extension not enabled. Cannot create indexes.");
      return false;
    }
    
    // Create HNSW index on emails.embedding_vector if not exists
    try {
      // First check if the index already exists
      const emailIndexExists = await db.execute(sql`
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'emails_embedding_vector_hnsw_idx'
      `);
      
      if (!(emailIndexExists?.rows?.length)) {
        log("Creating HNSW index on emails.embedding_vector...");
        await db.execute(sql`
          CREATE INDEX emails_embedding_vector_hnsw_idx 
          ON emails 
          USING hnsw (embedding_vector vector_l2_ops)
          WITH (m = 16, ef_construction = 64)
        `);
        log("HNSW index created on emails.embedding_vector");
      } else {
        log("HNSW index already exists on emails.embedding_vector");
      }
    } catch (error) {
      log(`Error creating HNSW index on emails.embedding_vector: ${error.message}`);
      // Continue despite error to try creating other indexes
    }
    
    // Create HNSW index on tasks.embedding_vector if not exists
    try {
      // First check if the index already exists
      const taskIndexExists = await db.execute(sql`
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'tasks_embedding_vector_hnsw_idx'
      `);
      
      if (!(taskIndexExists?.rows?.length)) {
        log("Creating HNSW index on tasks.embedding_vector...");
        await db.execute(sql`
          CREATE INDEX tasks_embedding_vector_hnsw_idx 
          ON tasks 
          USING hnsw (embedding_vector vector_l2_ops)
          WITH (m = 16, ef_construction = 64)
        `);
        log("HNSW index created on tasks.embedding_vector");
      } else {
        log("HNSW index already exists on tasks.embedding_vector");
      }
    } catch (error) {
      log(`Error creating HNSW index on tasks.embedding_vector: ${error.message}`);
      // Continue despite error
    }
    
    // Create a standard GiST index as fallback for exact searches
    try {
      // Check if the GiST index already exists for emails
      const emailGistIndexExists = await db.execute(sql`
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'emails_embedding_vector_gist_idx'
      `);
      
      if (!(emailGistIndexExists?.rows?.length)) {
        log("Creating GiST index on emails.embedding_vector...");
        await db.execute(sql`
          CREATE INDEX emails_embedding_vector_gist_idx 
          ON emails 
          USING gist (embedding_vector)
        `);
        log("GiST index created on emails.embedding_vector");
      }
    } catch (error) {
      log(`Error creating GiST index on emails.embedding_vector: ${error.message}`);
    }
    
    // Check if the GiST index already exists for tasks
    try {
      const taskGistIndexExists = await db.execute(sql`
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'tasks_embedding_vector_gist_idx'
      `);
      
      if (!(taskGistIndexExists?.rows?.length)) {
        log("Creating GiST index on tasks.embedding_vector...");
        await db.execute(sql`
          CREATE INDEX tasks_embedding_vector_gist_idx 
          ON tasks 
          USING gist (embedding_vector)
        `);
        log("GiST index created on tasks.embedding_vector");
      }
    } catch (error) {
      log(`Error creating GiST index on tasks.embedding_vector: ${error.message}`);
    }
    
    log("Vector indexes creation completed");
    return true;
  } catch (error) {
    log(`Error creating vector indexes: ${error.message}`);
    return false;
  }
}