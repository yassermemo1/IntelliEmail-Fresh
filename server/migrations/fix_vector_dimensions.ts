/**
 * Migration to fix inconsistent vector dimensions
 * Ensures all vector embeddings are standardized to 768 dimensions
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import { log } from "../vite";

export async function fixVectorDimensions(): Promise<boolean> {
  try {
    log("Starting migration: fix_vector_dimensions");
    
    // Step 1: Check the current vector column type
    log("Checking current vector column type...");
    const columnInfo = await db.execute(sql.raw(`
      SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) as formatted_type
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class cl ON cl.oid = a.attrelid
      WHERE cl.relname = 'emails' AND a.attname = 'embedding_vector'
    `));
    
    const columnType = columnInfo.rows[0]?.formatted_type;
    log(`Current embedding_vector column type: ${columnType}`);
    
    // Step 2: Ensure pgvector extension is enabled
    log("Ensuring pgvector extension is enabled...");
    await db.execute(sql.raw(`CREATE EXTENSION IF NOT EXISTS vector`));
    
    // Step 3: Alter the column to explicitly be vector(768) if not already
    log("Altering embedding_vector columns to vector(768)...");
    await db.execute(sql.raw(`
      ALTER TABLE emails 
      ALTER COLUMN embedding_vector TYPE vector(768) USING NULL
    `));
    
    await db.execute(sql.raw(`
      ALTER TABLE tasks 
      ALTER COLUMN embedding_vector TYPE vector(768) USING NULL
    `));
    
    // Step 4: Nullify all existing incorrect dimension embeddings 
    log("Nullifying all existing embeddings to enforce 768-dimensional consistency...");
    await db.execute(sql.raw(`
      UPDATE emails
      SET 
        embedding_vector = NULL,
        embedding_generated_at = NULL,
        metadata = jsonb_build_object(
          'embeddingReset', true,
          'embeddingResetDate', NOW(),
          'embeddingResetReason', 'Dimension standardization to 768'
        )
      WHERE embedding_vector IS NOT NULL
    `));
    
    await db.execute(sql.raw(`
      UPDATE tasks
      SET 
        embedding_vector = NULL
      WHERE embedding_vector IS NOT NULL
    `));
    
    // Step 5: Create proper vector indexes for similarity search
    log("Creating HNSW indexes for vector similarity search...");
    
    // Drop existing indexes if any
    try {
      await db.execute(sql.raw(`DROP INDEX IF EXISTS emails_embedding_vector_idx`));
      await db.execute(sql.raw(`DROP INDEX IF EXISTS tasks_embedding_vector_idx`));
    } catch (error) {
      log(`Warning when dropping indexes: ${(error as Error).message}`);
    }
    
    // Create new HNSW indexes properly configured for 768 dimensions
    await db.execute(sql.raw(`
      CREATE INDEX emails_embedding_vector_idx 
      ON emails 
      USING hnsw (embedding_vector vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `));
    
    await db.execute(sql.raw(`
      CREATE INDEX tasks_embedding_vector_idx 
      ON tasks 
      USING hnsw (embedding_vector vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `));
    
    log("Migration completed successfully: fix_vector_dimensions");
    return true;
  } catch (error) {
    log(`Error in fix_vector_dimensions migration: ${(error as Error).message}`);
    console.error("Migration error:", error);
    return false;
  }
}