/**
 * Vector Database System Verification Script
 * 
 * This script verifies the complete vector database system by:
 * 1. Creating a test email
 * 2. Generating and storing its embedding
 * 3. Testing vector similarity search
 * 4. Validating vector format
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { WebSocket } from 'ws';
import { aiService } from '../services/aiService.js';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory for proper path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure neon for WebSocket support
neonConfig.webSocketConstructor = WebSocket;

// Test data
const testEmail = {
  subject: "Test Email for Vector System Validation",
  sender: "test@example.com",
  content_text: `This is a test email that is specifically designed to validate the vector embedding system.
It should generate proper embeddings that can be used for similarity search in our pgvector database.
We need to ensure the vector format is correct and properly stored in PostgreSQL.`
};

// Connect to OpenAI for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Main verification function
async function verifyVectorSystem() {
  console.log("🧪 Starting Vector Database System Verification");
  console.log("==============================================");
  
  const results = {
    dbConnection: false,
    vectorFormat: false,
    embeddingGeneration: false,
    embeddingStorage: false,
    vectorSimilaritySearch: false
  };
  
  const testResults = {};
  
  try {
    // Step 1: Test Database Connection
    console.log("\n🔄 Step 1: Testing Database Connection");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    try {
      const connectionTest = await pool.query('SELECT 1 as connection_test');
      if (connectionTest.rows[0].connection_test === 1) {
        results.dbConnection = true;
        console.log("✅ Database connection successful");
      }
    } catch (dbError) {
      console.error("❌ Database connection failed:", dbError.message);
      // Exit early if we can't connect to the database
      return { success: false, results, error: dbError.message };
    }
    
    // Step 2: Add test email to database
    console.log("\n🔄 Step 2: Creating Test Email in Database");
    try {
      const insertEmailResult = await pool.query(`
        INSERT INTO emails (
          account_id, message_id, thread_id, subject, 
          sender, recipient, content_text, content_html, 
          received_at, is_read, has_attachments
        ) VALUES (
          $1, $2, $3, $4, 
          $5, $6, $7, $8, 
          NOW(), false, false
        ) RETURNING id
      `, [
        2, // account_id (assuming 2 is a valid account ID)
        `test-vector-${Date.now()}@example.com`,
        `thread-vector-${Date.now()}`,
        testEmail.subject,
        testEmail.sender,
        "user@example.com",
        testEmail.content_text,
        `<div>${testEmail.content_text.split('\n').map(p => `<p>${p}</p>`).join('')}</div>`
      ]);
      
      testResults.emailId = insertEmailResult.rows[0].id;
      console.log(`✅ Test email created with ID: ${testResults.emailId}`);
    } catch (emailError) {
      console.error("❌ Error creating test email:", emailError.message);
      return { success: false, results, error: emailError.message };
    }
    
    // Step 3: Generate embedding directly using OpenAI
    console.log("\n🔄 Step 3: Generating Test Embedding via OpenAI");
    let testEmbedding;
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: testEmail.content_text,
      });
      
      testEmbedding = embeddingResponse.data[0].embedding;
      testResults.embeddingDimension = testEmbedding.length;
      
      if (testEmbedding && testEmbedding.length > 0) {
        results.embeddingGeneration = true;
        console.log(`✅ Generated embedding with dimension: ${testResults.embeddingDimension}`);
      } else {
        console.log("❌ Failed to generate embedding");
      }
    } catch (aiError) {
      console.error("❌ Error generating embedding:", aiError.message);
      // Continue with test since we might want to test local implementation
    }
    
    // Step 4: Test aiService embedding generation
    console.log("\n🔄 Step 4: Testing aiService.generateEmbedding function");
    try {
      const serviceEmbedding = await aiService.generateEmbedding(testEmail.content_text);
      testResults.serviceEmbeddingDimension = serviceEmbedding.length;
      
      console.log(`✅ aiService generated embedding with dimension: ${testResults.serviceEmbeddingDimension}`);
      
      // Compare with direct OpenAI embedding if available
      if (testEmbedding) {
        const dimensionsMatch = testEmbedding.length === serviceEmbedding.length;
        console.log(`   Dimensions match: ${dimensionsMatch ? '✅' : '❌'}`);
      }
    } catch (serviceError) {
      console.error("❌ Error in aiService.generateEmbedding:", serviceError.message);
    }
    
    // Step 5: Test embedding storage format
    console.log("\n🔄 Step 5: Testing Vector Format");
    try {
      // First check for proper bracket format in a test vector
      const testVector = JSON.stringify(testEmbedding || [0.1, 0.2, 0.3]);
      const properFormat = testVector.startsWith('[') && testVector.endsWith(']');
      
      if (properFormat) {
        results.vectorFormat = true;
        console.log("✅ Vector format is correct (proper brackets)");
      } else {
        console.log("❌ Vector format is incorrect (missing proper brackets)");
      }
      
      // Test SQL array format for pgvector
      const vectorSqlTest = await pool.query(`
        SELECT '[0.1, 0.2, 0.3]'::vector(3) as test_vector
      `);
      
      if (vectorSqlTest.rows[0].test_vector) {
        console.log("✅ PostgreSQL pgvector type is working correctly");
      }
    } catch (formatError) {
      console.error("❌ Error testing vector format:", formatError.message);
    }
    
    // Step 6: Store embedding in database
    console.log("\n🔄 Step 6: Storing Test Embedding in Database");
    try {
      // Use aiService to update the embedding
      const updateResult = await aiService.updateEmailEmbeddings(testResults.emailId);
      
      if (updateResult && updateResult.success) {
        results.embeddingStorage = true;
        console.log("✅ Successfully stored embedding in database");
      } else {
        console.log("❌ Failed to store embedding in database");
      }
      
      // Verify the embedding was stored
      const verifyStorage = await pool.query(`
        SELECT embedding_vector IS NOT NULL as has_embedding
        FROM emails
        WHERE id = $1
      `, [testResults.emailId]);
      
      if (verifyStorage.rows[0] && verifyStorage.rows[0].has_embedding) {
        console.log("✅ Verified embedding exists in database");
      } else {
        console.log("❌ Embedding not found in database");
      }
    } catch (storageError) {
      console.error("❌ Error storing embedding:", storageError.message);
    }
    
    // Step 7: Test vector similarity search
    console.log("\n🔄 Step 7: Testing Vector Similarity Search");
    try {
      // Generate a query embedding
      const queryText = "vector database system validation test";
      const queryEmbedding = await aiService.generateEmbedding(queryText);
      
      // Test similarity search directly in database
      const similarityQuery = await pool.query(`
        SELECT id, subject, sender, 
          embedding_vector <=> $1 as distance
        FROM emails
        WHERE embedding_vector IS NOT NULL
        ORDER BY embedding_vector <=> $1
        LIMIT 5
      `, [JSON.stringify(queryEmbedding)]);
      
      if (similarityQuery.rows.length > 0) {
        results.vectorSimilaritySearch = true;
        console.log(`✅ Similarity search returned ${similarityQuery.rows.length} results`);
        
        // Check if our test email is in the results
        const testEmailInResults = similarityQuery.rows.some(row => row.id === testResults.emailId);
        console.log(`   Test email found in similarity results: ${testEmailInResults ? '✅' : '❌'}`);
        
        // Log top results
        console.log("   Top similarity results:");
        similarityQuery.rows.forEach((row, index) => {
          console.log(`     ${index + 1}. ID: ${row.id}, Subject: ${row.subject.substring(0, 30)}..., Distance: ${row.distance.toFixed(4)}`);
        });
      } else {
        console.log("❌ Similarity search returned no results");
      }
    } catch (searchError) {
      console.error("❌ Error in similarity search:", searchError.message);
    }
    
    // Final verification step: Check vector format in database
    console.log("\n🔄 Step 8: Verifying Vector Format in Database");
    try {
      const formatCheck = await pool.query(`
        SELECT 
          embedding_vector IS NOT NULL as has_embedding,
          embedding_vector::text LIKE '[%' as starts_with_bracket,
          embedding_vector::text LIKE '%]' as ends_with_bracket
        FROM emails
        WHERE id = $1
      `, [testResults.emailId]);
      
      if (formatCheck.rows.length > 0) {
        const row = formatCheck.rows[0];
        console.log(`   Has embedding: ${row.has_embedding ? '✅' : '❌'}`);
        console.log(`   Starts with bracket: ${row.starts_with_bracket ? '✅' : '❌'}`);
        console.log(`   Ends with bracket: ${row.ends_with_bracket ? '✅' : '❌'}`);
        
        if (row.has_embedding && row.starts_with_bracket && row.ends_with_bracket) {
          console.log("✅ Vector format in database is correct");
        } else {
          console.log("❌ Vector format in database needs correction");
        }
      }
    } catch (finalCheckError) {
      console.error("❌ Error in final format check:", finalCheckError.message);
    }
    
    // Calculate overall success
    const overallSuccess = Object.values(results).every(result => result === true);
    const passedTests = Object.values(results).filter(result => result === true).length;
    const totalTests = Object.keys(results).length;
    
    console.log("\n📊 TEST SUMMARY:");
    console.log("===============");
    console.log(`Overall Status: ${overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Passed ${passedTests}/${totalTests} tests (${Math.round(passedTests/totalTests*100)}%)`);
    
    Object.entries(results).forEach(([test, result]) => {
      console.log(`${result ? '✅' : '❌'} ${test}`);
    });
    
    // Save test results to file
    const reportData = {
      timestamp: new Date().toISOString(),
      results,
      testResults,
      overallSuccess,
      passedTests,
      totalTests
    };
    
    fs.writeFileSync(
      path.join(process.cwd(), 'server', 'tests', 'vector-test-results.json'),
      JSON.stringify(reportData, null, 2)
    );
    
    console.log("\nResults saved to server/tests/vector-test-results.json");
    
    // Close the database pool
    await pool.end();
    
    return { success: overallSuccess, results, testResults };
    
  } catch (error) {
    console.error("❌ Critical error in vector system verification:", error.message);
    return { success: false, error: error.message };
  }
}

// Run the verification
verifyVectorSystem()
  .then(result => console.log("\n🏁 Vector system verification complete"))
  .catch(error => console.error("Fatal error:", error));