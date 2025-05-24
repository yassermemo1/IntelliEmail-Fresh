// Database migration script
import { db } from './db';
import { aiModels, aiSettings, llmProviderEnum } from '@shared/schema';
import { ollamaService } from './services/ollamaService';
import { sql } from 'drizzle-orm';
import { setupPgVector } from './migrations/setup_pgvector';
import { createVectorIndexes } from './migrations/vector_indexes';
import { fixPgVectorFinal } from './migrations/fix_pgvector_final';
import { fixVectorDimensions } from './migrations/fix_vector_dimensions';
import { implementFullTextSearch } from './migrations/fts_implementation';
import { enhanceTasksTable } from './migrations/task_enhancement_migration';

// List of default LLM models to seed the database with
const defaultModels = [
  {
    provider: 'openai',
    modelId: 'gpt-4o',
    displayName: 'GPT-4o',
    description: 'OpenAI\'s newest multimodal model. 2024 knowledge cutoff.',
    capabilities: { text: true, vision: true, audio: false },
    contextLength: 128000,
    isEmbeddingModel: false,
    isDefault: true
  },
  {
    provider: 'openai',
    modelId: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    description: 'Faster and more cost-effective OpenAI model',
    capabilities: { text: true, vision: false, audio: false },
    contextLength: 16000,
    isEmbeddingModel: false,
    isDefault: false
  },
  {
    provider: 'openai',
    modelId: 'text-embedding-3-small',
    displayName: 'Text Embedding 3-Small',
    description: 'Efficient text embedding model from OpenAI',
    capabilities: { text: true, vision: false, audio: false },
    contextLength: 8191,
    isEmbeddingModel: true,
    isDefault: true
  },
  {
    provider: 'anthropic',
    modelId: 'claude-3-7-sonnet-20250219',
    displayName: 'Claude 3.7 Sonnet',
    description: 'State-of-the-art Anthropic model with strong reasoning capabilities',
    capabilities: { text: true, vision: true, audio: false },
    contextLength: 200000,
    isEmbeddingModel: false,
    isDefault: false
  },
  {
    provider: 'perplexity',
    modelId: 'llama-3.1-sonar-small-128k-online',
    displayName: 'Llama 3.1 Sonar Small',
    description: 'Web-connected model with latest information access',
    capabilities: { text: true, vision: false, audio: false, web: true },
    contextLength: 128000,
    isEmbeddingModel: false,
    isDefault: false
  }
];

export async function runMigrations() {
  try {
    console.log("Starting database migrations...");
    
    // Setup pgvector and ensure proper vector column types
    const vectorSetupResult = await setupPgVector();
    console.log(`Vector setup result: ${vectorSetupResult.success ? "Success" : vectorSetupResult.message}`);
    
    // Run the final pgvector fix to ensure proper vector format
    const finalFixResult = await fixPgVectorFinal();
    console.log(`Final pgvector fix result: ${finalFixResult ? "Success" : "Failed"}`);
    
    // Run the vector dimensions fix to standardize to 768 dimensions
    const dimensionsFixResult = await fixVectorDimensions();
    console.log(`Vector dimensions standardization result: ${dimensionsFixResult ? "Success" : "Failed"}`);
    
    // Only proceed with index creation if vector setup was successful
    if (vectorSetupResult.success || finalFixResult || dimensionsFixResult) {
      const indexCreationResult = await createVectorIndexes();
      console.log(`Vector indexes creation result: ${indexCreationResult ? "Success" : "Failed"}`);
    }
    
    // Fix AI settings table structure
    const { fixAiSettings } = await import('./migrations/fix_ai_settings');
    const aiSettingsResult = await fixAiSettings();
    console.log(`AI settings fix result: ${aiSettingsResult ? "Success" : "Failed"}`);
    
    // Populate AI models table with all providers
    const { populateAiModels } = await import('./migrations/populate_ai_models');
    const modelsResult = await populateAiModels();
    console.log(`AI models population result: ${modelsResult ? "Success" : "Failed"}`);
    
    // Implement Full-Text Search for emails and tasks
    const ftsResult = await implementFullTextSearch();
    console.log(`Full-Text Search implementation result: ${ftsResult ? "Success" : "Failed"}`);
    
    // 1. Update schema if needed (creating new tables is handled by drizzle-kit)
    console.log("Creating AI models table if it doesn't exist...");
    
    // First ensure the enums exist with all values
    await db.execute(sql`
      DO $$
      BEGIN
        -- LLM Provider enum
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'llm_provider') THEN
          CREATE TYPE llm_provider AS ENUM ('ollama', 'openai', 'anthropic', 'perplexity');
        ELSE
          -- Check if we need to add any missing enum values
          BEGIN
            ALTER TYPE llm_provider ADD VALUE IF NOT EXISTS 'ollama';
            ALTER TYPE llm_provider ADD VALUE IF NOT EXISTS 'openai';
            ALTER TYPE llm_provider ADD VALUE IF NOT EXISTS 'anthropic';
            ALTER TYPE llm_provider ADD VALUE IF NOT EXISTS 'perplexity';
          EXCEPTION
            WHEN duplicate_object THEN
              -- Handle case when value already exists
          END;
        END IF;
        
        -- Auth Method enum
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auth_method') THEN
          CREATE TYPE auth_method AS ENUM ('app_password', 'oauth', 'basic');
        ELSE
          -- Check if we need to add any missing enum values
          BEGIN
            ALTER TYPE auth_method ADD VALUE IF NOT EXISTS 'app_password';
            ALTER TYPE auth_method ADD VALUE IF NOT EXISTS 'oauth';
            ALTER TYPE auth_method ADD VALUE IF NOT EXISTS 'basic';
          EXCEPTION
            WHEN duplicate_object THEN
              -- Handle case when value already exists
          END;
        END IF;
        
        -- Link Type enum
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'link_type') THEN
          CREATE TYPE link_type AS ENUM ('thread', 'subject', 'semantic');
        ELSE
          -- Check if we need to add any missing enum values
          BEGIN
            ALTER TYPE link_type ADD VALUE IF NOT EXISTS 'thread';
            ALTER TYPE link_type ADD VALUE IF NOT EXISTS 'subject';
            ALTER TYPE link_type ADD VALUE IF NOT EXISTS 'semantic';
          EXCEPTION
            WHEN duplicate_object THEN
              -- Handle case when value already exists
          END;
        END IF;
      END
      $$;
    `);
    
    // Update email_accounts table to add all missing columns
    await db.execute(sql`
      ALTER TABLE IF EXISTS email_accounts 
      ADD COLUMN IF NOT EXISTS auth_method auth_method DEFAULT 'app_password' NOT NULL,
      ADD COLUMN IF NOT EXISTS display_name TEXT,
      ADD COLUMN IF NOT EXISTS server_settings JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);
    
    // Create the email_semantic_links table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS email_semantic_links (
        email_id_a INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
        email_id_b INTEGER NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
        similarity_score INTEGER NOT NULL,
        link_type link_type NOT NULL DEFAULT 'semantic',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        
        -- Ensure there are no duplicate links (a->b and b->a)
        CONSTRAINT email_semantic_links_pk PRIMARY KEY (email_id_a, email_id_b),
        
        -- Convention: email_id_a should always be smaller than email_id_b
        CONSTRAINT email_id_order_check CHECK (email_id_a < email_id_b)
      );
      
      -- Create indexes for faster lookups
      CREATE INDEX IF NOT EXISTS email_semantic_links_a_idx ON email_semantic_links(email_id_a);
      CREATE INDEX IF NOT EXISTS email_semantic_links_b_idx ON email_semantic_links(email_id_b);
      CREATE INDEX IF NOT EXISTS email_semantic_links_score_idx ON email_semantic_links(similarity_score);
    `);
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_models (
        id SERIAL PRIMARY KEY,
        provider llm_provider NOT NULL,
        model_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT,
        capabilities JSONB NOT NULL DEFAULT '{}',
        context_length INTEGER,
        is_embedding_model BOOLEAN NOT NULL DEFAULT FALSE,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // 2. Check if AI models table is empty and seed with defaults if needed
    const existingModelsCount = await db.select({ count: sql<number>`count(*)` })
      .from(aiModels);
    
    const modelCount = Number(existingModelsCount[0]?.count || 0);
    
    if (modelCount === 0) {
      console.log("Seeding default AI models...");
      for (const model of defaultModels) {
        await db.insert(aiModels).values({
          provider: model.provider as any,
          modelId: model.modelId,
          displayName: model.displayName,
          description: model.description,
          capabilities: model.capabilities,
          contextLength: model.contextLength,
          isEmbeddingModel: model.isEmbeddingModel,
          isDefault: model.isDefault
        });
      }
      console.log(`Added ${defaultModels.length} default AI models`);
    }
    
    // 3. Attempt to discover and add Ollama models if available
    try {
      console.log("Checking for local Ollama models...");
      const ollamaAvailable = await ollamaService.isAvailable();
      
      if (ollamaAvailable) {
        const modelsAdded = await ollamaService.syncModelsToDatabase();
        console.log(`Added ${modelsAdded} Ollama models to the database`);
      } else {
        console.log("Ollama server not available. No local models added.");
      }
    } catch (error) {
      console.log("Failed to check for Ollama models:", error);
    }
    
    // 4. Enhance the tasks table with additional fields for rich task data
    try {
      console.log("Running task enhancement migration...");
      const taskEnhancementResult = await enhanceTasksTable();
      console.log(`Task schema enhancement result: ${taskEnhancementResult}`);
    } catch (error) {
      console.error("Error enhancing task schema:", error);
    }
    
    console.log("Migrations completed successfully");
    return true;
  } catch (error) {
    console.error("Migration failed:", error);
    return false;
  }
}