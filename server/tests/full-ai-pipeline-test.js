/**
 * Full AI Pipeline End-to-End Test
 * 
 * This script tests the complete AI workflow:
 * 1. Email processing
 * 2. Embedding generation
 * 3. Vector database storage
 * 4. Task extraction
 * 5. Related email detection
 * 6. Semantic search
 * 
 * Run with: node server/tests/full-ai-pipeline-test.js
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import axios from 'axios';
import { WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = WebSocket;

// Test configuration
const config = {
  testEmail: {
    subject: "E2E Test: Action required for project deadline",
    from: "test@example.com",
    to: "user@example.com",
    text: `Hello Team,

This is a test email for the AI pipeline. Please note the following action items:

1. Complete the project report by Friday
2. Schedule a review meeting next Monday at 2pm
3. Send the client update with progress details

Please let me know if you have any questions.

Best regards,
Test User`,
    html: `<div>
      <p>Hello Team,</p>
      <p>This is a test email for the AI pipeline. Please note the following action items:</p>
      <ol>
        <li>Complete the project report by Friday</li>
        <li>Schedule a review meeting next Monday at 2pm</li>
        <li>Send the client update with progress details</li>
      </ol>
      <p>Please let me know if you have any questions.</p>
      <p>Best regards,<br>Test User</p>
    </div>`
  },
  userId: 1,
  accountId: 2 // Assuming this is a valid account ID in your system
};

// Track test progress
const testResults = {
  emailCreation: { success: false, emailId: null, message: "" },
  embeddingGeneration: { success: false, message: "" },
  taskExtraction: { success: false, taskIds: [], message: "" },
  relatedEmails: { success: false, count: 0, message: "" },
  semanticSearch: { success: false, results: [], message: "" },
  vectorDbValidation: { success: false, message: "" }
};

// Main test function
async function runFullPipelineTest() {
  console.log("🧪 Starting Full AI Pipeline E2E Test");
  console.log("======================================");
  
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Step 1: Create test email in database
    console.log("\n📧 STEP 1: Creating test email in database...");
    try {
      // First, let's check the schema to make sure we use the right column names
      const schemaCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'emails'
      `);
      
      console.log(`   Found ${schemaCheck.rows.length} columns in emails table`);
      
      // Now insert with the correct schema
      const insertEmailResult = await pool.query(`
        INSERT INTO emails (
          account_id, message_id, thread_id, subject, 
          sender, recipients, content_text, content_html, 
          received_at, is_read, has_attachments
        ) VALUES (
          $1, $2, $3, $4, 
          $5, $6, $7, $8, 
          NOW(), false, false
        ) RETURNING id
      `, [
        config.accountId,
        `test-${Date.now()}@example.com`,
        `thread-${Date.now()}`,
        config.testEmail.subject,
        config.testEmail.from,
        config.testEmail.to,
        config.testEmail.text,
        config.testEmail.html
      ]);
      
      if (insertEmailResult.rows.length > 0) {
        testResults.emailCreation.success = true;
        testResults.emailCreation.emailId = insertEmailResult.rows[0].id;
        testResults.emailCreation.message = "Test email created successfully";
        console.log(`✅ Test email created with ID: ${testResults.emailCreation.emailId}`);
      } else {
        testResults.emailCreation.message = "Failed to create test email";
        console.log("❌ Failed to create test email");
      }
    } catch (error) {
      testResults.emailCreation.message = `Error creating test email: ${error.message}`;
      console.log(`❌ Error creating test email: ${error.message}`);
    }
    
    if (!testResults.emailCreation.success) {
      throw new Error("Failed to create test email - cannot proceed with test");
    }
    
    // Step 2: Generate embedding for the test email
    console.log("\n🔢 STEP 2: Generating embedding for test email...");
    try {
      console.log("Checking if embeddings pipeline is initialized...");
      
      // Trigger embedding generation for the email
      const embeddingResult = await pool.query(`
        SELECT * FROM emails 
        WHERE id = $1 AND embedding_vector IS NOT NULL
      `, [testResults.emailCreation.emailId]);
      
      if (embeddingResult.rows.length > 0) {
        console.log("✅ Embedding already exists for the email");
        testResults.embeddingGeneration.success = true;
      } else {
        console.log("Embedding doesn't exist yet, triggering embedding generation...");
        
        // Wait for embedding generation (may need to manually trigger it)
        console.log("Making API request to process embeddings...");
        try {
          await axios.post('/api/ai/process-embeddings', {
            emailIds: [testResults.emailCreation.emailId]
          });
          
          // Wait a bit for processing
          console.log("Waiting for embedding generation to complete...");
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Check if embedding was generated
          const checkResult = await pool.query(`
            SELECT * FROM emails 
            WHERE id = $1 AND embedding_vector IS NOT NULL
          `, [testResults.emailCreation.emailId]);
          
          if (checkResult.rows.length > 0) {
            console.log("✅ Embedding successfully generated");
            testResults.embeddingGeneration.success = true;
            testResults.embeddingGeneration.message = "Embedding successfully generated";
          } else {
            console.log("❌ Failed to generate embedding after waiting");
            testResults.embeddingGeneration.message = "Failed to generate embedding after waiting";
          }
        } catch (apiError) {
          console.log(`❌ API error when processing embeddings: ${apiError.message}`);
          testResults.embeddingGeneration.message = `API error: ${apiError.message}`;
        }
      }
    } catch (error) {
      testResults.embeddingGeneration.message = `Error checking/generating embedding: ${error.message}`;
      console.log(`❌ Error in embedding generation step: ${error.message}`);
    }
    
    // Step 3: Test task extraction
    console.log("\n📋 STEP 3: Testing task extraction...");
    try {
      // Trigger task extraction through the API
      const taskExtractionResult = await axios.post('/api/ai/extract-tasks', {
        emailId: testResults.emailCreation.emailId
      });
      
      if (taskExtractionResult.data.success && taskExtractionResult.data.tasks && taskExtractionResult.data.tasks.length > 0) {
        testResults.taskExtraction.success = true;
        testResults.taskExtraction.taskIds = taskExtractionResult.data.tasks.map(t => t.id);
        testResults.taskExtraction.message = `Successfully extracted ${taskExtractionResult.data.tasks.length} tasks`;
        console.log(`✅ Successfully extracted ${taskExtractionResult.data.tasks.length} tasks`);
        
        // Log the extracted tasks
        console.log("Extracted tasks:");
        taskExtractionResult.data.tasks.forEach((task, index) => {
          console.log(`   ${index + 1}. ${task.title} (Due: ${task.dueDate || 'No date'})`);
        });
      } else {
        testResults.taskExtraction.message = "Failed to extract tasks or no tasks found";
        console.log("❌ Failed to extract tasks or no tasks found");
      }
    } catch (error) {
      testResults.taskExtraction.message = `Error in task extraction: ${error.message}`;
      console.log(`❌ Error in task extraction: ${error.message}`);
      
      if (error.response) {
        console.log("API Response:", error.response.data);
      }
    }
    
    // Step 4: Test related email detection
    console.log("\n🔗 STEP 4: Testing related email detection...");
    try {
      // Get related emails for our test email
      const relatedEmailsResult = await axios.get(`/api/emails/${testResults.emailCreation.emailId}/related-enhanced`);
      
      if (relatedEmailsResult.data.success) {
        testResults.relatedEmails.success = true;
        testResults.relatedEmails.count = relatedEmailsResult.data.relatedEmails.length;
        testResults.relatedEmails.message = `Found ${relatedEmailsResult.data.relatedEmails.length} related emails`;
        console.log(`✅ Found ${relatedEmailsResult.data.relatedEmails.length} related emails`);
      } else {
        testResults.relatedEmails.message = "Failed to get related emails";
        console.log("❌ Failed to get related emails");
      }
    } catch (error) {
      testResults.relatedEmails.message = `Error getting related emails: ${error.message}`;
      console.log(`❌ Error getting related emails: ${error.message}`);
    }
    
    // Step 5: Test semantic search
    console.log("\n🔍 STEP 5: Testing semantic search...");
    try {
      // Perform semantic search
      const searchQuery = "project deadline";
      const semanticSearchResult = await axios.post('/api/ai/semantic-search', {
        query: searchQuery
      });
      
      if (semanticSearchResult.data.success) {
        testResults.semanticSearch.success = true;
        testResults.semanticSearch.results = semanticSearchResult.data.results;
        testResults.semanticSearch.message = `Found ${semanticSearchResult.data.results.length} semantic search results`;
        console.log(`✅ Found ${semanticSearchResult.data.results.length} semantic search results for query: "${searchQuery}"`);
        
        // See if our test email is in the results
        const testEmailInResults = semanticSearchResult.data.results.some(
          r => r.id === testResults.emailCreation.emailId
        );
        
        if (testEmailInResults) {
          console.log("   ✅ Test email was found in semantic search results (expected)");
        } else {
          console.log("   ⚠️ Test email was not found in semantic search results (unexpected)");
        }
      } else {
        testResults.semanticSearch.message = "Failed to perform semantic search";
        console.log("❌ Failed to perform semantic search");
      }
    } catch (error) {
      testResults.semanticSearch.message = `Error in semantic search: ${error.message}`;
      console.log(`❌ Error in semantic search: ${error.message}`);
    }
    
    // Step 6: Validate vector database state
    console.log("\n🔐 STEP 6: Validating vector database state...");
    try {
      // Check vector database statistics
      const vectorDbStats = await pool.query(`
        SELECT 
          COUNT(*) as total_emails,
          COUNT(embedding_vector) as emails_with_embeddings,
          (COUNT(embedding_vector) * 100.0 / COUNT(*)) as percent_complete
        FROM emails
      `);
      
      const stats = vectorDbStats.rows[0];
      console.log(`   Total emails: ${stats.total_emails}`);
      console.log(`   Emails with embeddings: ${stats.emails_with_embeddings}`);
      console.log(`   Completion percentage: ${parseFloat(stats.percent_complete).toFixed(2)}%`);
      
      // Check if our test email has a properly formatted vector
      const vectorCheckResult = await pool.query(`
        SELECT 
          id, 
          embedding_vector IS NOT NULL AS has_embedding,
          embedding_vector::text LIKE '[%' AS has_correct_format
        FROM emails
        WHERE id = $1
      `, [testResults.emailCreation.emailId]);
      
      if (vectorCheckResult.rows.length > 0) {
        const emailCheck = vectorCheckResult.rows[0];
        
        if (emailCheck.has_embedding && emailCheck.has_correct_format) {
          testResults.vectorDbValidation.success = true;
          testResults.vectorDbValidation.message = "Test email has correctly formatted embedding vector";
          console.log("✅ Test email has correctly formatted embedding vector");
        } else if (emailCheck.has_embedding) {
          testResults.vectorDbValidation.message = "Test email has embedding but format may be incorrect";
          console.log("⚠️ Test email has embedding but format may be incorrect");
        } else {
          testResults.vectorDbValidation.message = "Test email is missing embedding vector";
          console.log("❌ Test email is missing embedding vector");
        }
      } else {
        testResults.vectorDbValidation.message = "Could not find test email in database";
        console.log("❌ Could not find test email in database");
      }
    } catch (error) {
      testResults.vectorDbValidation.message = `Error validating vector database: ${error.message}`;
      console.log(`❌ Error validating vector database: ${error.message}`);
    }
    
    // Summarize test results
    console.log("\n📊 E2E TEST SUMMARY:");
    console.log("====================");
    
    let passedTests = 0;
    const totalTests = Object.keys(testResults).length;
    
    for (const [testName, result] of Object.entries(testResults)) {
      const icon = result.success ? "✅" : "❌";
      console.log(`${icon} ${testName}: ${result.message}`);
      if (result.success) passedTests++;
    }
    
    console.log("\n🏁 TEST COMPLETION:");
    console.log(`Passed ${passedTests}/${totalTests} tests (${Math.round(passedTests/totalTests*100)}%)`);
    
    // Write results to file for reference
    const resultsObj = {
      timestamp: new Date().toISOString(),
      testResults,
      summary: {
        passedTests,
        totalTests,
        percentage: Math.round(passedTests/totalTests*100)
      }
    };
    
    fs.writeFileSync(
      path.join(process.cwd(), 'server', 'tests', 'ai-pipeline-results.json'),
      JSON.stringify(resultsObj, null, 2)
    );
    
    console.log("\nResults saved to server/tests/ai-pipeline-results.json");
    
    // Close database connection
    await pool.end();
    
  } catch (error) {
    console.error("❌ Critical test failure:", error.message);
  }
}

// Run the test
runFullPipelineTest()
  .then(() => console.log("E2E test execution completed"))
  .catch(err => console.error("Fatal error in E2E test:", err));