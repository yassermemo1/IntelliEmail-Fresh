/**
 * End-to-End test script for AI Settings functionality
 * 
 * This script verifies that the AI settings endpoints are working correctly
 * and that settings can be properly updated and retrieved.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { WebSocket } from 'ws';
import axios from 'axios';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = WebSocket;

// API base URL (using the Replit environment)
const API_BASE_URL = '/api';

// Test settings data
const TEST_SETTINGS = {
  selectedProvider: 'openai',
  selectedModelId: 'gpt-4o',
  ollamaEndpoint: 'http://localhost:11434',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: '',
  perplexityApiKey: '',
  autoExtractTasks: true
};

async function testAiSettings() {
  console.log('🧪 Starting AI Settings E2E tests...');
  
  try {
    // First, make a direct database connection to check settings
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    console.log('1️⃣ Testing GET /api/ai/settings endpoint...');
    try {
      const getResponse = await axios.get(`${API_BASE_URL}/ai/settings`);
      console.log('✅ GET /api/ai/settings returned:', getResponse.status);
      console.log('Response data:', JSON.stringify(getResponse.data, null, 2));
    } catch (getError) {
      console.error('❌ GET /api/ai/settings failed:', getError.message);
      if (getError.response) {
        console.error('Response status:', getError.response.status);
        console.error('Response data:', getError.response.data);
      }
    }
    
    console.log('\n2️⃣ Testing PUT /api/ai/settings endpoint...');
    try {
      const putResponse = await axios.put(`${API_BASE_URL}/ai/settings`, TEST_SETTINGS);
      console.log('✅ PUT /api/ai/settings returned:', putResponse.status);
      console.log('Response data:', JSON.stringify(putResponse.data, null, 2));
    } catch (putError) {
      console.error('❌ PUT /api/ai/settings failed:', putError.message);
      if (putError.response) {
        console.error('Response status:', putError.response.status);
        console.error('Response data:', putError.response.data);
      }
    }
    
    console.log('\n3️⃣ Testing GET /api/ai/models endpoint...');
    try {
      const modelsResponse = await axios.get(`${API_BASE_URL}/ai/models`);
      console.log('✅ GET /api/ai/models returned:', modelsResponse.status);
      console.log('Models count:', modelsResponse.data.data?.length || 0);
    } catch (modelsError) {
      console.error('❌ GET /api/ai/models failed:', modelsError.message);
      if (modelsError.response) {
        console.error('Response status:', modelsError.response.status);
        console.error('Response data:', modelsError.response.data);
      }
    }
    
    console.log('\n4️⃣ Checking settings directly in database...');
    try {
      const settingsQuery = await pool.query(`
        SELECT * FROM ai_settings 
        WHERE user_id = 1
      `);
      
      if (settingsQuery.rows.length > 0) {
        console.log('✅ Found settings in database for user 1:');
        console.log(settingsQuery.rows[0]);
      } else {
        console.log('❌ No settings found in database for user 1');
      }
    } catch (dbError) {
      console.error('❌ Database query failed:', dbError.message);
    }
    
    // Close database connection
    await pool.end();
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
  
  console.log('\n🏁 AI Settings E2E tests completed');
}

// Run the test
testAiSettings()
  .then(() => console.log('Test execution completed'))
  .catch(err => console.error('Error running tests:', err));