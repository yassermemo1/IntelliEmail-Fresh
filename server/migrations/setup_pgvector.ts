import { db } from "../db";
import { sql } from "drizzle-orm";
import { log } from "../vite";

/**
 * Set up pgvector extension and properly configure vector columns
 */
export async function setupPgVector() {
  try {
    // Step 1: Enable the pgvector extension
    log("Enabling pgvector extension...");
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    
    // Step 2: Check if columns exist and their current types
    const emailColumnCheck = await db.execute(sql`
      SELECT data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'emails' AND column_name = 'embedding_vector'
    `);
    
    const taskColumnCheck = await db.execute(sql`
      SELECT data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'tasks' AND column_name = 'embedding_vector'
    `);
    
    // Convert the results to more usable forms
    const emailColumnInfo = Array.isArray(emailColumnCheck) 
      ? emailColumnCheck[0] 
      : (emailColumnCheck?.rows?.[0] || null);
      
    const taskColumnInfo = Array.isArray(taskColumnCheck) 
      ? taskColumnCheck[0] 
      : (taskColumnCheck?.rows?.[0] || null);
    
    // Step 3: Alter or create the columns as needed
    
    // For emails table
    if (!emailColumnInfo) {
      log("Creating vector column for emails.embedding_vector...");
      await db.execute(sql`
        ALTER TABLE emails 
        ADD COLUMN embedding_vector vector(1536)
      `);
    } else if (emailColumnInfo.data_type !== 'USER-DEFINED' || 
               (emailColumnInfo.data_type === 'USER-DEFINED' && !emailColumnInfo.character_maximum_length)) {
      log("Converting emails.embedding_vector to proper vector type...");
      
      // First create a backup column
      await db.execute(sql`
        ALTER TABLE emails 
        ADD COLUMN embedding_vector_backup jsonb
      `);
      
      // Copy data to backup
      await db.execute(sql`
        UPDATE emails 
        SET embedding_vector_backup = embedding_vector::jsonb 
        WHERE embedding_vector IS NOT NULL
      `);
      
      // Drop the existing column
      await db.execute(sql`
        ALTER TABLE emails 
        DROP COLUMN embedding_vector
      `);
      
      // Create the new column with proper vector type
      await db.execute(sql`
        ALTER TABLE emails 
        ADD COLUMN embedding_vector vector(1536)
      `);
      
      // Attempt to convert and restore data if possible (advanced conversion would require custom logic)
      log("Data conversion for embedded vectors will need to be handled separately");
    } else {
      log("Email embedding_vector column already has proper vector type");
    }
    
    // For tasks table
    if (!taskColumnInfo) {
      log("Creating vector column for tasks.embedding_vector...");
      await db.execute(sql`
        ALTER TABLE tasks 
        ADD COLUMN embedding_vector vector(1536)
      `);
    } else if (taskColumnInfo.data_type !== 'USER-DEFINED' || 
               (taskColumnInfo.data_type === 'USER-DEFINED' && !taskColumnInfo.character_maximum_length)) {
      log("Converting tasks.embedding_vector to proper vector type...");
      
      // First create a backup column
      await db.execute(sql`
        ALTER TABLE tasks 
        ADD COLUMN embedding_vector_backup jsonb
      `);
      
      // Copy data to backup
      await db.execute(sql`
        UPDATE tasks 
        SET embedding_vector_backup = embedding_vector::jsonb 
        WHERE embedding_vector IS NOT NULL
      `);
      
      // Drop the existing column
      await db.execute(sql`
        ALTER TABLE tasks 
        DROP COLUMN embedding_vector
      `);
      
      // Create the new column with proper vector type
      await db.execute(sql`
        ALTER TABLE tasks 
        ADD COLUMN embedding_vector vector(1536)
      `);
      
      // Attempt to convert and restore data if possible
      log("Data conversion for task vectors will need to be handled separately");
    } else {
      log("Task embedding_vector column already has proper vector type");
    }
    
    log("Vector column setup completed successfully");
    return { success: true, message: "Vector columns configured successfully" };
  } catch (error) {
    log(`Error setting up vector columns: ${error.message}`);
    return { success: false, message: error.message };
  }
}