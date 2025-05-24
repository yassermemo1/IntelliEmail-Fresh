/**
 * Migration to fix AI settings table
 * Ensures that all required columns are present for AI settings functionality
 */
import { db } from "../db";
import { sql } from "drizzle-orm";
import { log } from "../vite";

export async function fixAiSettings(): Promise<boolean> {
  try {
    log("Starting AI settings table migration...");

    // Check if selected_provider column exists
    const checkColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ai_settings' AND column_name = 'selected_provider'
    `);

    if (checkColumn.rows.length === 0) {
      log("Adding selected_provider column to ai_settings table");
      
      // Create the llm_provider enum type if it doesn't exist
      await db.execute(sql`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'llm_provider') THEN
            CREATE TYPE llm_provider AS ENUM ('ollama', 'openai', 'anthropic', 'perplexity');
          END IF;
        END
        $$;
      `);
      
      // Add the column with default value
      await db.execute(sql`
        ALTER TABLE ai_settings
        ADD COLUMN IF NOT EXISTS selected_provider llm_provider NOT NULL DEFAULT 'openai'
      `);
      
      log("selected_provider column added successfully");
    } else {
      log("selected_provider column already exists");
    }

    // Check if selected_model_id column exists
    const checkModelIdColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ai_settings' AND column_name = 'selected_model_id'
    `);

    if (checkModelIdColumn.rows.length === 0) {
      log("Adding selected_model_id column to ai_settings table");
      
      // Add the column
      await db.execute(sql`
        ALTER TABLE ai_settings
        ADD COLUMN IF NOT EXISTS selected_model_id INTEGER REFERENCES ai_models(id)
      `);
      
      log("selected_model_id column added successfully");
    } else {
      log("selected_model_id column already exists");
    }

    // Check if embedding_model_id column exists
    const checkEmbeddingModelIdColumn = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ai_settings' AND column_name = 'embedding_model_id'
    `);

    if (checkEmbeddingModelIdColumn.rows.length === 0) {
      log("Adding embedding_model_id column to ai_settings table");
      
      // Add the column
      await db.execute(sql`
        ALTER TABLE ai_settings
        ADD COLUMN IF NOT EXISTS embedding_model_id INTEGER REFERENCES ai_models(id)
      `);
      
      log("embedding_model_id column added successfully");
    } else {
      log("embedding_model_id column already exists");
    }

    // Check if API key columns exist
    const checkApiKeyColumns = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ai_settings' AND column_name IN ('openai_api_key', 'anthropic_api_key', 'perplexity_api_key')
    `);

    if (checkApiKeyColumns.rows.length < 3) {
      log("Adding API key columns to ai_settings table");
      
      // Add the API key columns
      await db.execute(sql`
        ALTER TABLE ai_settings
        ADD COLUMN IF NOT EXISTS openai_api_key TEXT,
        ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT,
        ADD COLUMN IF NOT EXISTS perplexity_api_key TEXT
      `);
      
      log("API key columns added successfully");
    } else {
      log("API key columns already exist");
    }

    // Ensure other columns exist with appropriate defaults
    await db.execute(sql`
      ALTER TABLE ai_settings
      ADD COLUMN IF NOT EXISTS ollama_endpoint TEXT DEFAULT 'http://localhost:11434',
      ADD COLUMN IF NOT EXISTS confidence_threshold INTEGER DEFAULT 70 NOT NULL,
      ADD COLUMN IF NOT EXISTS auto_extract_tasks BOOLEAN DEFAULT false NOT NULL
    `);

    log("AI settings table migration completed successfully");
    return true;
  } catch (error) {
    log(`Error fixing AI settings table: ${error}`);
    console.error("Migration error:", error);
    return false;
  }
}