/**
 * Fix for pgvector format issues
 * This migration ensures embeddings are properly formatted for pgvector
 */
import { db } from "../db";
import { log } from "../vite";
import { sql } from "drizzle-orm";

export async function fixPgVectorFormat(): Promise<boolean> {
  try {
    log("Starting pgvector format fix migration");
    
    // First test if the pgvector extension is already enabled
    const pgvectorCheck = await db.execute(sql`
      SELECT 1 FROM pg_extension WHERE extname = 'vector';
    `);
    
    if (pgvectorCheck.rows.length === 0) {
      log("pgvector extension not installed, please run setup_pgvector first");
      return false;
    }
    
    // Create a helper function to properly format vectors
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION format_vector_string(input_str TEXT) RETURNS TEXT AS $$
      BEGIN
        -- Remove any extra quotes that might be present
        input_str := REPLACE(input_str, '"', '');
        
        -- If it doesn't start with [, add it
        IF LEFT(input_str, 1) <> '[' THEN
          input_str := '[' || input_str;
        END IF;
        
        -- If it doesn't end with ], add it
        IF RIGHT(input_str, 1) <> ']' THEN
          input_str := input_str || ']';
        END IF;
        
        RETURN input_str;
      END;
      $$ LANGUAGE plpgsql;
    `);

    log("Successfully created format_vector_string helper function");
    
    return true;
  } catch (error) {
    log(`Error fixing pgvector format: ${error.message}`, "error");
    return false;
  }
}