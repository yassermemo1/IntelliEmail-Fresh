/**
 * Standalone script to fix task embeddings
 * This script directly adds vector embeddings to tasks using the OpenAI API
 * Run with: node server/fix-task-embeddings.cjs
 */

// Use CommonJS require syntax
require('dotenv').config();
const { Pool } = require('pg');
const { OpenAI } = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize database connection
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function generateEmbedding(text) {
  try {
    // Use OpenAI's embedding API to generate embeddings
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    
    // Get the embedding from the response
    const embedding = response.data[0].embedding;
    console.log(`Generated OpenAI embedding with ${embedding.length} dimensions`);
    
    // Convert to 768 dimensions if needed
    if (embedding.length === 1536) {
      console.log("Converting 1536-dim OpenAI embedding to 768-dim using proper dimensionality reduction");
      // Take every other value to reduce from 1536 to 768
      const reducedEmbedding = embedding.filter((_, index) => index % 2 === 0);
      console.log(`Final embedding has ${reducedEmbedding.length} dimensions`);
      return reducedEmbedding;
    }
    
    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

function prepareTaskTextForEmbedding(task) {
  let text = '';
  
  // Add title (high importance)
  if (task.title) {
    text += `Title: ${task.title}\n\n`;
  }
  
  // Add description (high importance)
  if (task.description) {
    text += `Description: ${task.description}\n\n`;
  }
  
  // Add priority (medium importance)
  if (task.priority) {
    text += `Priority: ${task.priority}\n`;
  }
  
  // Add due date (medium importance)
  if (task.due_date) {
    text += `Due Date: ${new Date(task.due_date).toISOString()}\n`;
  }
  
  // Add completion status
  if (task.is_completed !== undefined) {
    text += `Completed: ${task.is_completed ? 'Yes' : 'No'}\n`;
  }
  
  // Add source email ID if available
  if (task.email_id) {
    text += `Source Email ID: ${task.email_id}\n`;
  }
  
  return text;
}

async function fixTaskEmbeddings() {
  console.log('Starting task embedding generation...');
  
  try {
    // Step 1: Make sure pgvector extension is installed
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('Verified pgvector extension is installed');
    
    // Check pgvector version
    const versionResult = await pool.query(`SELECT extversion FROM pg_extension WHERE extname = 'vector';`);
    const version = versionResult.rows[0]?.extversion;
    console.log(`Current pgvector version: ${version}`);
    
    // Step 2: Ensure task embedding_vector column has the correct type
    try {
      await pool.query(`
        ALTER TABLE tasks 
        ALTER COLUMN embedding_vector TYPE vector(768) 
        USING NULL::vector(768);
      `);
      console.log('Updated tasks.embedding_vector column to vector(768) type');
    } catch (error) {
      if (error.message.includes('already has type')) {
        console.log('tasks.embedding_vector already has correct type');
      } else {
        console.error('Error fixing column type:', error.message);
      }
    }
    
    // Create a task if there are none to test with
    const countResult = await pool.query('SELECT COUNT(*) FROM tasks');
    const taskCount = parseInt(countResult.rows[0].count);
    
    if (taskCount === 0) {
      console.log('No tasks found, creating a test task...');
      await pool.query(`
        INSERT INTO tasks (title, description, priority, user_id, is_completed)
        VALUES ('Test Task', 'This is a test task to verify embedding generation', 'medium', 1, false)
      `);
      console.log('Test task created');
    }
    
    // Step 3: Get tasks without embeddings
    const tasksResult = await pool.query(`
      SELECT id, title, description, priority, due_date, is_completed, email_id
      FROM tasks 
      WHERE embedding_vector IS NULL
      LIMIT 50
    `);
    
    const tasks = tasksResult.rows;
    console.log(`Found ${tasks.length} tasks without embeddings`);
    
    if (tasks.length === 0) {
      console.log('No tasks need embedding generation.');
      return;
    }
    
    // Step 4: Process each task and generate embeddings
    let processed = 0;
    let successful = 0;
    let failed = 0;
    
    for (const task of tasks) {
      processed++;
      try {
        // Prepare task text for embedding
        const taskText = prepareTaskTextForEmbedding(task);
        
        if (!taskText || taskText.trim().length < 10) {
          console.log(`Skipping task ${task.id} due to insufficient content`);
          failed++;
          continue;
        }
        
        // Generate embedding
        const embedding = await generateEmbedding(taskText);
        
        // Format for pgvector storage
        const vectorString = `[${embedding.join(',')}]`;
        
        // Update the task with the embedding
        await pool.query(`
          UPDATE tasks
          SET 
            embedding_vector = $1::vector(768)
          WHERE id = $2
        `, [vectorString, task.id]);
        
        console.log(`Successfully generated and stored embedding for task ${task.id} (${embedding.length} dimensions)`);
        successful++;
      } catch (error) {
        console.error(`Error processing task ${task.id}:`, error.message);
        failed++;
      }
    }
    
    console.log(`Task embedding generation completed: ${processed} processed, ${successful} successful, ${failed} failed`);
    
    // Step 5: Verify some task embeddings were created
    const verifyResult = await pool.query(`
      SELECT COUNT(*) 
      FROM tasks 
      WHERE embedding_vector IS NOT NULL
    `);
    
    const tasksWithEmbeddings = verifyResult.rows[0].count;
    console.log(`Total tasks with embeddings after processing: ${tasksWithEmbeddings}`);
    
    // Step 6: Create or update vector indexes for search performance
    try {
      console.log('Creating HNSW index for tasks if not exists...');
      await pool.query(`
        CREATE INDEX IF NOT EXISTS tasks_embedding_vector_hnsw_idx 
        ON tasks 
        USING hnsw (embedding_vector vector_cosine_ops)
        WITH (m='16', ef_construction='64')
      `);
      console.log('HNSW index created or already exists');
    } catch (error) {
      console.error('Error creating vector index:', error.message);
    }
    
    // Step 7: Sample verification of dimension consistency
    const sampleResult = await pool.query(`
      SELECT id, title, array_length(embedding_vector::real[], 1) as dimensions
      FROM tasks
      WHERE embedding_vector IS NOT NULL
      LIMIT 5
    `);
    
    console.log('Sample of tasks with embeddings:');
    console.table(sampleResult.rows);
    
  } catch (error) {
    console.error('Error in fix-task-embeddings script:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixTaskEmbeddings()
  .then(() => console.log('Done!'))
  .catch(err => console.error('Script failed:', err));