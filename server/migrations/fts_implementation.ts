/**
 * Migration to implement PostgreSQL Full-Text Search
 * 
 * This migration:
 * 1. Adds tsvector columns to emails and tasks tables
 * 2. Creates GIN indexes for fast full-text searches
 * 3. Sets up triggers to automatically update search vectors
 */

import { sql } from 'drizzle-orm';
import { db } from '../db';
import { log } from '../vite';

export async function implementFullTextSearch(): Promise<boolean> {
  try {
    log('Starting full-text search implementation...', 'migration');

    // Step 1: Add tsvector columns if they don't exist
    await db.execute(sql`
      -- Add search_vector column to emails if it doesn't exist
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'emails' AND column_name = 'search_vector'
        ) THEN
          ALTER TABLE emails ADD COLUMN search_vector tsvector;
        ELSE
          -- If it exists but needs to be converted to tsvector
          ALTER TABLE emails ALTER COLUMN search_vector TYPE tsvector USING COALESCE(search_vector::tsvector, to_tsvector(''));
        END IF;
      END $$;
      
      -- Add search_vector column to tasks if it doesn't exist
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'tasks' AND column_name = 'search_vector'
        ) THEN
          ALTER TABLE tasks ADD COLUMN search_vector tsvector;
        ELSE
          -- If it exists but needs to be converted to tsvector
          ALTER TABLE tasks ALTER COLUMN search_vector TYPE tsvector USING COALESCE(search_vector::tsvector, to_tsvector(''));
        END IF;
      END $$;
    `);

    log('Added tsvector columns to emails and tasks tables', 'migration');

    // Step 2: Create GIN indexes for fast full-text searches
    await db.execute(sql`
      -- Create GIN indexes for fast full-text searches
      CREATE INDEX IF NOT EXISTS emails_search_idx ON emails USING GIN(search_vector);
      CREATE INDEX IF NOT EXISTS tasks_search_idx ON tasks USING GIN(search_vector);
    `);

    log('Created GIN indexes for fast full-text searches', 'migration');

    // Step 3: Set up triggers to automatically update the tsvector columns
    await db.execute(sql`
      -- Create or replace function to update search vectors for emails
      CREATE OR REPLACE FUNCTION update_email_search_vector()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.search_vector := 
            setweight(to_tsvector('english', COALESCE(NEW.subject, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(NEW.sender, '')), 'B') ||
            setweight(to_tsvector('english', COALESCE(NEW.body, '')), 'C');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;

      -- Create or replace function to update search vectors for tasks
      CREATE OR REPLACE FUNCTION update_task_search_vector()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.search_vector := 
            setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
            setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;

      -- Create triggers to automatically update search vectors
      DROP TRIGGER IF EXISTS email_search_update ON emails;
      CREATE TRIGGER email_search_update
      BEFORE INSERT OR UPDATE ON emails
      FOR EACH ROW
      EXECUTE FUNCTION update_email_search_vector();

      DROP TRIGGER IF EXISTS task_search_update ON tasks;
      CREATE TRIGGER task_search_update
      BEFORE INSERT OR UPDATE ON tasks
      FOR EACH ROW
      EXECUTE FUNCTION update_task_search_vector();
    `);

    log('Set up triggers to automatically update search vectors', 'migration');

    // Step 4: Update existing records to populate the search vectors
    await db.execute(sql`
      -- Update existing emails
      UPDATE emails SET search_vector = 
        setweight(to_tsvector('english', COALESCE(subject, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(sender, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(body, '')), 'C')
      WHERE search_vector IS NULL;

      -- Update existing tasks
      UPDATE tasks SET search_vector = 
        setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(description, '')), 'B')
      WHERE search_vector IS NULL;
    `);

    log('Updated existing records with search vectors', 'migration');

    // Step 5: Configure an Ispell dictionary for spell checking (if available)
    try {
      // Try to create a custom dictionary configuration that includes Ispell
      await db.execute(sql`
        -- Try to create a custom dictionary configuration if not exists
        -- This requires the ispell dictionary files to be installed on the server
        CREATE TEXT SEARCH CONFIGURATION IF NOT EXISTS english_ispell (COPY = english);
        
        -- Try to create the ispell dictionary if the hunspell extension is available
        DO $$
        BEGIN
          -- Check if hunspell dictionaries are available
          IF EXISTS (
            SELECT 1 FROM pg_ts_dict 
            WHERE dictname = 'english_hunspell' OR dictname LIKE '%ispell%'
          ) THEN
            -- Use existing ispell/hunspell dictionary
            ALTER TEXT SEARCH CONFIGURATION english_ispell
            ALTER MAPPING FOR asciiword, asciihword, hword, hword_part, word
            WITH english_stem, english_hunspell;
          END IF;
        EXCEPTION
          WHEN OTHERS THEN
            -- If there's an error, we'll continue with the standard english dictionary
            RAISE NOTICE 'Ispell dictionary not available, using standard English dictionary';
        END $$;
      `);
      log('Configured text search with spell-checking capabilities', 'migration');
    } catch (error) {
      // If ispell configuration fails, we'll continue with the standard dictionary
      log(`Ispell dictionary setup failed: ${error.message}. Using standard English dictionary.`, 'migration');
    }

    return true;
  } catch (error) {
    log(`Error implementing full-text search: ${error.message}`, 'error');
    return false;
  }
}