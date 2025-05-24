/**
 * Email Task Classification and Extraction Service
 * This module processes emails and extracts potential tasks based on content analysis
 */

const { db } = require('./db');
const { OpenAI } = require('openai');
const { emails, tasks, aiSettings, aiModels } = require('../shared/schema');
const { eq, desc, isNull, and, sql } = require('drizzle-orm');

// Initialize OpenAI with the API key from environment variables or settings
let openai;

async function initializeAI() {
  try {
    console.log("Initializing AI service for task extraction...");
    
    // First, try to use the environment variable directly
    if (process.env.OPENAI_API_KEY) {
      console.log("Using OpenAI API key from environment variable");
      openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      return true;
    }
    
    // Fallback to getting the key from user settings
    const settings = await db.select().from(aiSettings).where(eq(aiSettings.userId, 1)).limit(1);
    console.log("Retrieved AI settings:", settings ? "Settings found" : "No settings found");
    
    if (settings && settings.length > 0 && settings[0].openaiApiKey) {
      console.log("Creating OpenAI client with API key from settings");
      openai = new OpenAI({ apiKey: settings[0].openaiApiKey });
      return true;
    } else {
      console.error("No OpenAI API key found in environment or settings");
      return false;
    }
  } catch (error) {
    console.error("Error initializing AI:", error);
    console.error("Error details:", error.message, error.stack);
    return false;
  }
}

/**
 * Extracts tasks from email content using AI analysis
 */
async function extractTasksFromEmail(email) {
  if (!openai) {
    const initialized = await initializeAI();
    if (!initialized) return null;
  }

  try {
    // Get the appropriate model from AI settings
    const settings = await db.select().from(aiSettings).where(eq(aiSettings.userId, 1)).limit(1);
    let model = 'gpt-3.5-turbo-nano'; // Default model
    
    // Use the user's selected model if available
    if (settings && settings.length > 0 && settings[0].selectedModelId) {
      const modelSettings = await db.select()
        .from(aiModels)
        .where(eq(aiModels.id, settings[0].selectedModelId))
        .limit(1);
      
      if (modelSettings && modelSettings.length > 0) {
        model = modelSettings[0].modelId;
      }
    }
    
    const systemPrompt = `
    You are an AI assistant specialized in analyzing emails to extract actionable tasks, requests, and follow-ups.
    
    When you identify potential tasks in an email, you will return a structured JSON response with an array of detailed task objects.
    
    Task Categories (choose exactly one from this list for each task):
    - FollowUp_ResponseNeeded (for tasks requiring a reply or check-in)
    - Report_Generation_Submission (for creating, completing or submitting reports/documents)
    - Meeting_Coordination_Prep (for scheduling, organizing, or preparing for meetings)
    - Review_Approval_Feedback (for reviewing materials or providing feedback)
    - Research_Investigation_Analysis (for researching topics or analyzing information)
    - Planning_Strategy_Development (for planning projects or developing strategies)
    - Client_Vendor_Communication (for communication with external parties)
    - Internal_Project_Task (for specific project-related action items)
    - Administrative_Logistics (for operational or administrative tasks)
    - Urgent_Action_Required (for high-priority items needing immediate attention)
    - Information_To_Digest_Review (for items requiring attention but not a discrete task)
    - Personal_Reminder_Appt (for personal appointments or reminders)
    
    Priority Levels (choose one):
    - P1_Critical (immediate attention required, highest impact)
    - P2_High (important with significant impact)
    - P3_Medium (standard priority)
    - P4_Low (can be addressed when time allows)
    
    For each task identified, provide the following structured information:
    {
      "suggested_title": "Concise, action-oriented title (max 100 chars)",
      "detailed_description": "More detailed description including key context or sub-points from the email relevant to this specific task",
      "source_snippet": "The exact sentence(s) from the email that triggered this task suggestion",
      "actors_involved": ["Person A", "Department B"], // People/entities directly related to this task
      "suggested_priority_level": "P3_Medium", // From the priority levels specified above
      "extracted_deadline_text": "by next Friday EOD", // Textual deadline for this specific task, exactly as mentioned in email
      "suggested_category": "Report_Generation_Submission", // From the categories specified above
      "estimated_effort_minutes": 60, // Optional: Your best estimate of time required
      "is_recurring_hint": false, // Boolean: Whether this appears to be a recurring task
      "reminder_suggestion_text": "remind me 1 day before deadline", // Optional: Your suggestion for a reminder timing
      "confidence_in_task_extraction": 0.85 // Your confidence for this specific task (0.0-1.0)
    }
    
    Extract at most 3 distinct tasks. If no clear tasks are found, respond with an empty array.
    Return your response in valid JSON format with a "tasks" array containing these structured task objects.
    `;
    
    const userPrompt = `
    Please analyze this email and extract any actionable tasks:
    
    Email Subject: ${email.subject || 'No Subject'}
    From: ${email.sender || email.from || 'Unknown Sender'}
    Date: ${email.timestamp ? new Date(email.timestamp).toISOString() : (email.date ? new Date(email.date).toISOString() : 'Unknown Date')}
    
    Content:
    ${email.body || email.textContent || email.htmlContent || 'No content available'}
    `;
    
    console.log(`Using model ${model} for enhanced task extraction`);
    
    // Call OpenAI to analyze the email with the enhanced prompt
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2, // Lower temperature for more consistent, focused results
      response_format: { type: "json_object" }
    });

    // Extract and parse the response
    const content = response.choices[0].message.content;
    const result = JSON.parse(content);
    
    // Check if tasks were found
    if (result && result.tasks && Array.isArray(result.tasks) && result.tasks.length > 0) {
      // Return tasks along with the model used for tracking purposes
      return {
        tasks: result.tasks,
        modelUsed: model
      };
    }
    
    return { tasks: [], modelUsed: model };
  } catch (error) {
    console.error(`Error extracting tasks from email ${email.id}:`, error);
    return { tasks: [], modelUsed: 'error' };
  }
}

/**
 * Creates enhanced task records in the database from extracted task data
 */
async function createTasksFromExtracted(email, extractedResult) {
  if (!extractedResult || !extractedResult.tasks || extractedResult.tasks.length === 0) return 0;
  
  try {
    let createdCount = 0;
    const extractedTasks = extractedResult.tasks;
    const modelUsed = extractedResult.modelUsed || 'gpt-3.5-turbo-nano';
    
    for (const taskData of extractedTasks) {
      // Map AI priority level to database priority
      let priorityLevel = 'medium';
      if (taskData.suggested_priority_level) {
        if (taskData.suggested_priority_level.includes('P1') || taskData.suggested_priority_level.includes('Critical')) {
          priorityLevel = 'high';
        } else if (taskData.suggested_priority_level.includes('P2') || taskData.suggested_priority_level.includes('High')) {
          priorityLevel = 'high';
        } else if (taskData.suggested_priority_level.includes('P4') || taskData.suggested_priority_level.includes('Low')) {
          priorityLevel = 'low';
        }
      }
      
      // Calculate confidence score (0-100)
      const confidenceScore = taskData.confidence_in_task_extraction 
        ? Math.floor(taskData.confidence_in_task_extraction * 100) 
        : 85;
      
      // Parse date from extracted_deadline_text if possible
      let dueDate = null;
      if (taskData.extracted_deadline_text) {
        try {
          // This is a simplified approach - in production you might want 
          // to use a more robust date parsing library
          const dateText = taskData.extracted_deadline_text;
          if (dateText.includes('tomorrow')) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            dueDate = tomorrow;
          } else if (dateText.includes('next week')) {
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            dueDate = nextWeek;
          } else if (dateText.match(/\d{4}-\d{2}-\d{2}/)) {
            // Looks like an ISO date
            dueDate = new Date(dateText);
          }
        } catch (e) {
          console.log(`Could not parse date from: ${taskData.extracted_deadline_text}`);
        }
      }
      
      // Format the task data for database insertion with enhanced fields
      const taskRecord = {
        userId: 1, // Using the default user ID
        emailId: email.id,
        title: taskData.suggested_title || taskData.title || 'Task from email',
        description: taskData.detailed_description || '',
        detailedDescription: taskData.detailed_description || '',
        sourceSnippet: taskData.source_snippet || '',
        priority: priorityLevel,
        category: taskData.suggested_category || null,
        actorsInvolved: taskData.actors_involved || [],
        estimatedEffortMinutes: taskData.estimated_effort_minutes || null,
        isCompleted: false,
        aiGenerated: true,
        aiConfidence: confidenceScore,
        aiModel: modelUsed,
        originalAiSuggestionJson: taskData, // Store the complete AI suggestion
        needsReview: true, // Mark for human review
        isRecurringSuggestion: taskData.is_recurring_hint || false,
        aiSuggestedReminderText: taskData.reminder_suggestion_text || null,
        dueDate: dueDate,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Insert the task into the database
      try {
        const result = await db.insert(tasks).values(taskRecord);
        if (result) createdCount++;
      } catch (insertError) {
        console.error(`Error inserting task: ${insertError.message}`);
        // If category enum value is invalid, retry without it
        if (insertError.message.includes('invalid input value for enum')) {
          console.log('Retrying task insertion without category');
          const retryRecord = { ...taskRecord, category: null };
          const retryResult = await db.insert(tasks).values(retryRecord);
          if (retryResult) createdCount++;
        }
      }
    }
    
    console.log(`Created ${createdCount} enhanced tasks from email ID ${email.id} using model ${modelUsed}`);
    return createdCount;
  } catch (error) {
    console.error(`Error creating tasks for email ${email.id}:`, error);
    return 0;
  }
}

/**
 * Processes emails to extract and create tasks with configurable options
 * @param {Object} options - Configuration options
 * @param {number} [options.limit=100] - Maximum number of emails to process
 * @param {number} [options.daysBack=null] - Only process emails from the last X days
 * @param {boolean} [options.unprocessedOnly=true] - Only process emails not previously processed
 * @param {string} [options.modelOverride=null] - Override the default AI model
 * @returns {Promise<Object>} Processing statistics
 */
async function processRecentEmails(options = {}) {
  // Set defaults if options is a number (backward compatibility)
  if (typeof options === 'number') {
    options = { limit: options };
  }
  
  // Extract options with defaults
  const {
    limit = 100,
    daysBack = null,
    unprocessedOnly = true,
    modelOverride = null,
  } = options;

  try {
    console.log(`Starting task extraction with parameters: limit=${limit}, daysBack=${daysBack || 'all'}, unprocessedOnly=${unprocessedOnly}...`);
    
    // Build the query based on options
    let query = db.select().from(emails);
    
    if (unprocessedOnly) {
      query = query.where(isNull(emails.processedForTasks));
    }
    
    // Add date filter if daysBack is specified
    if (daysBack && daysBack > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      // Using timestamp field instead of date which may not exist
      query = query.where(sql`${emails.timestamp} >= ${cutoffDate.toISOString()}`);
    }
    
    // Complete the query with sorting and limit
    // Use timestamp field for sorting which is more reliable than date
    const recentEmails = await query.orderBy(desc(emails.timestamp)).limit(limit);
    
    console.log(`Found ${recentEmails.length} emails to process`);
    
    if (recentEmails.length === 0) {
      return { processed: 0, taskCount: 0 };
    }
    
    let totalTasksCreated = 0;
    
    for (const email of recentEmails) {
      // Extract tasks from the email
      const extractionResult = await extractTasksFromEmail(email);
      
      // Create tasks in the database if tasks were found
      if (extractionResult && extractionResult.tasks && extractionResult.tasks.length > 0) {
        const tasksCreated = await createTasksFromExtracted(email, extractionResult);
        totalTasksCreated += tasksCreated;
      }
      
      // Mark the email as processed for tasks
      await db
        .update(emails)
        .set({ processedForTasks: new Date() })
        .where(eq(emails.id, email.id));
      
      console.log(`Processed email ID ${email.id}, found ${extractionResult?.tasks?.length || 0} tasks`);
    }
    
    console.log(`Task extraction completed. Processed ${recentEmails.length} emails and created ${totalTasksCreated} tasks.`);
    
    return {
      processed: recentEmails.length,
      taskCount: totalTasksCreated
    };
  } catch (error) {
    console.error("Error processing emails for tasks:", error);
    return { processed: 0, taskCount: 0, error: error.message };
  }
}

module.exports = {
  processRecentEmails
};