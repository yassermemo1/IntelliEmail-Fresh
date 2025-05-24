/**
 * Direct API key addition script
 * This bypasses UI validation and adds the API key directly to the database
 */

import pg from 'pg';
import { OpenAI } from 'openai';

const { Pool } = pg;

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// The API key to add (your key)
const API_KEY = 'your-openai-api-key-here';

// First verify that the API key works
async function testApiKey() {
  try {
    console.log('Testing OpenAI API key...');
    const openai = new OpenAI({ apiKey: API_KEY });
    const response = await openai.models.list();
    
    if (response && Array.isArray(response.data)) {
      console.log(`API key is valid! Found ${response.data.length} models`);
      return true;
    }
    
    console.log('API key validation failed');
    return false;
  } catch (error) {
    console.error('API key validation error:', error.message);
    return false;
  }
}

// Update the database with the API key
async function updateApiKey() {
  try {
    // Check if API key is valid
    const isValid = await testApiKey();
    
    if (!isValid) {
      console.error('Not updating database with invalid API key');
      return;
    }
    
    // Check if AI settings record exists
    const checkResult = await pool.query(
      'SELECT * FROM ai_settings WHERE user_id = $1',
      [1] // Default user ID
    );
    
    if (checkResult.rows.length === 0) {
      // Insert new settings
      console.log('Creating new AI settings record with API key');
      await pool.query(
        `INSERT INTO ai_settings 
        (user_id, selected_provider, selected_model_id, ollama_endpoint, openai_api_key, auto_extract_tasks) 
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [1, 'openai', 1, 'http://localhost:11434', API_KEY, false]
      );
    } else {
      // Update existing settings
      console.log('Updating existing AI settings with API key');
      await pool.query(
        'UPDATE ai_settings SET openai_api_key = $1, selected_provider = $2 WHERE user_id = $3',
        [API_KEY, 'openai', 1]
      );
    }
    
    console.log('API key successfully added to database!');
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the update
updateApiKey().catch(console.error);