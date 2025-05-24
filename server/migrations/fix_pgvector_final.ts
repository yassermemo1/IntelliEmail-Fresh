/**
 * Final fix for pgvector implementation
 * This migration ensures embedding vectors are properly stored as vector(768)
 */
import { sql } from "drizzle-orm";
import { log } from "../vite";
import { db } from "../db";

export async function fixPgVectorFinal(): Promise<boolean> {
  try {
    log("Running final pgvector fix");

    // 1. First ensure pgvector extension is installed
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
    log("Verified pgvector extension is installed");

    // 2. Check if the embedding_vector column in emails has the correct type
    const emailColumnResult = await db.execute(sql`
      SELECT data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'emails' AND column_name = 'embedding_vector';
    `);

    const emailColumnInfo = emailColumnResult.rows[0];
    
    // 3. Drop and recreate embedding_vector column in emails if needed
    if (!emailColumnInfo || emailColumnInfo.data_type !== 'USER-DEFINED') {
      log("Recreating emails.embedding_vector as vector(768)...");
      
      // First create a backup column for existing data
      await db.execute(sql`
        ALTER TABLE emails 
        ADD COLUMN IF NOT EXISTS embedding_vector_backup jsonb
      `);
      
      // Copy data to backup
      await db.execute(sql`
        UPDATE emails 
        SET embedding_vector_backup = to_jsonb(embedding_vector) 
        WHERE embedding_vector IS NOT NULL
      `);
      
      // Drop the existing column
      await db.execute(sql`
        ALTER TABLE emails 
        DROP COLUMN IF EXISTS embedding_vector
      `);
      
      // Create the new column with proper vector type
      await db.execute(sql`
        ALTER TABLE emails 
        DROP COLUMN IF EXISTS embedding_vector;
        
        CREATE EXTENSION IF NOT EXISTS vector;
        
        ALTER TABLE emails 
        ADD COLUMN embedding_vector vector(768) NOT NULL DEFAULT '[]'::vector
      `);
      
      log("Emails embedding_vector column recreated as vector(768)");
    } else {
      log("Emails embedding_vector column already has proper vector type");
    }
    
    // 4. Check if the embedding_vector column in tasks has the correct type
    const taskColumnResult = await db.execute(sql`
      SELECT data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'embedding_vector';
    `);

    const taskColumnInfo = taskColumnResult.rows[0];
    
    // 5. Drop and recreate embedding_vector column in tasks if needed
    if (!taskColumnInfo || taskColumnInfo.data_type !== 'USER-DEFINED') {
      log("Recreating tasks.embedding_vector as vector(768)...");
      
      // First create a backup column for existing data
      await db.execute(sql`
        ALTER TABLE tasks 
        ADD COLUMN IF NOT EXISTS embedding_vector_backup jsonb
      `);
      
      // Copy data to backup
      await db.execute(sql`
        UPDATE tasks 
        SET embedding_vector_backup = to_jsonb(embedding_vector) 
        WHERE embedding_vector IS NOT NULL
      `);
      
      // Drop the existing column
      await db.execute(sql`
        ALTER TABLE tasks 
        DROP COLUMN IF EXISTS embedding_vector
      `);
      
      // Create the new column with proper vector type
      await db.execute(sql`
        ALTER TABLE tasks 
        ADD COLUMN embedding_vector vector(768) NOT NULL DEFAULT '[]'::vector
      `);
      
      log("Tasks embedding_vector column recreated as vector(768)");
    } else {
      log("Tasks embedding_vector column already has proper vector type");
    }
    
    // 6. Create vector indexes for performance
    log("Creating HNSW indexes for vector similarity search...");
    
    // Create index for emails
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ix_emails_embedding_vector_hnsw
      ON emails
      USING hnsw (embedding_vector vector_cosine_ops)
      WITH (ef_construction = 128, m = 16)
    `);
    
    // Create index for tasks
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ix_tasks_embedding_vector_hnsw
      ON tasks
      USING hnsw (embedding_vector vector_cosine_ops)
      WITH (ef_construction = 128, m = 16)
    `);
    
    log("Successfully created HNSW indexes for vector search");
    
    return true;
  } catch (error) {
    log(`Error in fixPgVectorFinal: ${error.message}`);
    return false;
  }
}