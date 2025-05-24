import { db } from '../db';
import { emails, tasks } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';
import OpenAI from 'openai';

// Initialize OpenAI with the API key from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Enhanced task extraction service
 * Uses advanced LLM prompting to extract rich task data from emails
 */
export class EnhancedTaskExtractionService {
  /**
   * Extract rich task data from email using advanced AI model
   * @param emailId ID of the email to process
   * @returns The processed extraction result with task data
   */
  async extractEnhancedTasksFromEmail(emailId: number): Promise<any> {
    try {
      // Get email from database
      const [email] = await db
        .select()
        .from(emails)
        .where(eq(emails.id, emailId));

      if (!email) {
        throw new Error(`Email not found with ID: ${emailId}`);
      }

      // Use our enhanced AI prompt to analyze the email
      const systemPrompt = `
      You are an AI assistant specialized in analyzing emails to extract actionable tasks, requests, and follow-ups.
      
      When you identify potential tasks in an email, you will return a structured JSON response with an array of detailed task objects.
      If the email is marketing/promotional content or doesn't contain actionable items, clearly indicate this.
      
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
      - Marketing_Promotional_Content (for promotional emails that don't require action)
      
      For each task identified, provide the following structured information:
      {
        "suggested_title": "Concise, action-oriented title (max 100 chars)",
        "detailed_description": "More detailed description including key context or sub-points from the email relevant to this specific task",
        "source_snippet": "The exact sentence(s) from the email that triggered this task suggestion",
        "actors_involved": ["Person A", "Department B"], // People/entities directly related to this task
        "suggested_priority_level": "P3_Medium", // P1_Critical, P2_High, P3_Medium, P4_Low
        "extracted_deadline_text": "by next Friday EOD", // Textual deadline for this specific task, exactly as mentioned in email
        "suggested_category": "Report_Generation_Submission", // From the categories specified above
        "estimated_effort_minutes": 60, // Optional: Your best estimate of time required
        "is_recurring_hint": false, // Boolean: Whether this appears to be a recurring task
        "reminder_suggestion_text": "remind me 1 day before deadline", // Optional: Your suggestion for a reminder timing
        "confidence_in_task_extraction": 0.85 // Your confidence for this specific task (0.0-1.0)
      }
      
      If the email is purely marketing/promotional or contains no actionable tasks, return:
      {
        "email_classification": "marketing_promotional" or "non_actionable", 
        "explanation": "Brief explanation of why no tasks were extracted"
      }
      
      Return your response in valid JSON format with either an "email_classification" field or a "tasks" array.
      `;
      
      const userPrompt = `
      Please analyze this email and extract any actionable tasks:
      
      Email Subject: ${email.subject || 'No Subject'}
      From: ${email.sender || email.from || 'Unknown Sender'}
      Date: ${email.timestamp ? new Date(email.timestamp).toISOString() : 'Unknown Date'}
      
      Content:
      ${email.body || email.textContent || email.htmlContent || 'No content available'}
      `;
      
      console.log(`Using GPT-4o model for enhanced task extraction on email ID ${emailId}`);
      
      // Call OpenAI to analyze the email with the enhanced prompt
      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2, // Lower temperature for more consistent, focused results
        response_format: { type: "json_object" }
      });
      
      // Extract and parse the response
      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }
      const result = JSON.parse(content);
      
      // Store the AI-generated analysis in the email record
      await this.storeEmailAnalysisResult(email.id, result);
      
      return result;
    } catch (error) {
      console.error(`Error in enhanced task extraction for email ${emailId}:`, error);
      throw error;
    }
  }
  
  /**
   * Store the AI analysis result in the email record
   * @param emailId ID of the email
   * @param analysisResult The AI-generated analysis
   */
  async storeEmailAnalysisResult(emailId: number, analysisResult: any): Promise<void> {
    try {
      // Prepare update data
      const updateData: any = {
        aiProcessedAt: new Date(),
        aiModelUsed: 'gpt-4o'
      };
      
      // Store classification for non-actionable emails
      if (analysisResult.email_classification) {
        updateData.aiClassification = analysisResult.email_classification;
        updateData.aiClassificationDetails = JSON.stringify(analysisResult);
      }
      
      // Store task data for actionable emails
      if (analysisResult.tasks && Array.isArray(analysisResult.tasks)) {
        updateData.aiSuggestedTasksJson = JSON.stringify(analysisResult.tasks);
        updateData.aiTaskCount = analysisResult.tasks.length;
      }
      
      // Update using a more direct approach
      const aiClassification = updateData.aiClassification || null;
      const aiClassificationDetails = updateData.aiClassificationDetails || null;
      const aiSuggestedTasksJson = updateData.aiSuggestedTasksJson || null;
      const aiTaskCount = updateData.aiTaskCount || 0;
      
      // Use plain SQL to avoid any Drizzle ORM syntax issues
      await db.execute(sql`
        UPDATE emails 
        SET 
          "processed_for_tasks" = NOW(),
          "ai_processed_at" = NOW(),
          "ai_model_used" = 'gpt-4o',
          "ai_classification" = ${aiClassification},
          "ai_classification_details" = ${aiClassificationDetails},
          "ai_suggested_tasks_json" = ${aiSuggestedTasksJson},
          "ai_task_count" = ${aiTaskCount}
        WHERE "id" = ${emailId}
      `);
        
      console.log(`Enhanced AI analysis stored for email ID ${emailId}`);
    } catch (error) {
      console.error(`Error storing AI analysis for email ${emailId}:`, error);
    }
  }
  
  /**
   * Create tasks in the database from AI-extracted task data
   * @param emailId ID of the email
   * @returns Count of tasks created
   */
  async createTasksFromEnhancedExtraction(emailId: number): Promise<number> {
    try {
      // Get email with AI-extracted task data
      const [email] = await db
        .select()
        .from(emails)
        .where(eq(emails.id, emailId));
        
      if (!email || !email.aiSuggestedTasksJson) {
        console.log(`No AI-suggested tasks found for email ID ${emailId}`);
        return 0;
      }
      
      // Parse the task data
      const taskData = JSON.parse(email.aiSuggestedTasksJson);
      
      if (!Array.isArray(taskData) || taskData.length === 0) {
        console.log(`No tasks to create for email ID ${emailId}`);
        return 0;
      }
      
      console.log(`Creating ${taskData.length} tasks from email ID ${emailId}`);
      
      let taskCount = 0;
      
      // Process each task
      for (const task of taskData) {
        try {
          // Map AI priority level to database priority
          let priorityLevel = 'medium';
          if (task.suggested_priority_level) {
            if (task.suggested_priority_level.includes('P1') || task.suggested_priority_level.includes('Critical')) {
              priorityLevel = 'high';
            } else if (task.suggested_priority_level.includes('P2') || task.suggested_priority_level.includes('High')) {
              priorityLevel = 'high';
            } else if (task.suggested_priority_level.includes('P4') || task.suggested_priority_level.includes('Low')) {
              priorityLevel = 'low';
            }
          }
          
          // Calculate confidence score (0-100)
          const confidenceScore = task.confidence_in_task_extraction 
            ? Math.floor(task.confidence_in_task_extraction * 100) 
            : 85;
          
          // Parse date from extracted_deadline_text if possible
          let dueDate = null;
          if (task.extracted_deadline_text) {
            try {
              // Simplified approach for date parsing
              const dateText = task.extracted_deadline_text;
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
              console.log(`Could not parse date from: ${task.extracted_deadline_text}`);
            }
          }
          
          // Format the task data for database insertion with enhanced fields
          const taskRecord = {
            userId: 1, // Using the default user ID
            emailId: emailId,
            title: task.suggested_title || 'Task from email',
            description: task.detailed_description || '',
            detailedDescription: task.detailed_description || '',
            sourceSnippet: task.source_snippet || '',
            priority: priorityLevel,
            category: task.suggested_category || null,
            actorsInvolved: task.actors_involved || [],
            estimatedEffortMinutes: task.estimated_effort_minutes || null,
            isCompleted: false,
            aiGenerated: true,
            aiConfidence: confidenceScore,
            aiModel: 'gpt-4o',
            originalAiSuggestionJson: JSON.stringify(task), // Store the complete AI suggestion
            needsReview: confidenceScore < 90, // Mark for human review if confidence is low
            isRecurringSuggestion: task.is_recurring_hint || false,
            aiSuggestedReminderText: task.reminder_suggestion_text || null,
            dueDate: dueDate,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // Insert the task into the database
          try {
            const insertResult = await db.insert(tasks).values(taskRecord).returning();
            if (insertResult.length > 0) {
              taskCount++;
              console.log(`Created task ID ${insertResult[0].id}: ${taskRecord.title}`);
            }
          } catch (insertError: any) {
            console.error(`Error inserting task: ${insertError.message}`);
            // If category enum value is invalid, retry without it
            if (insertError.message.includes('invalid input value for enum')) {
              console.log('Retrying task insertion without category');
              const retryRecord = { ...taskRecord, category: null };
              const retryResult = await db.insert(tasks).values(retryRecord).returning();
              if (retryResult.length > 0) {
                taskCount++;
                console.log(`Created task ID ${retryResult[0].id}: ${retryRecord.title} (without category)`);
              }
            }
          }
        } catch (taskError) {
          console.error(`Error processing task: ${taskError}`);
        }
      }
      
      // Mark email as processed for tasks
      await db
        .update(emails)
        .set({ 
          processedForTasks: new Date(),
          taskCount: taskCount
        })
        .where(eq(emails.id, emailId));
      
      return taskCount;
    } catch (error) {
      console.error(`Error creating tasks from enhanced extraction for email ${emailId}:`, error);
      return 0;
    }
  }
  
  /**
   * Process a batch of emails for task extraction
   * @param options Configuration options for batch processing
   * @returns Processing statistics
   */
  async processBatchEmails(options: {
    limit?: number;
    daysBack?: number | null;
    unprocessedOnly?: boolean;
  } = {}): Promise<{
    processed: number;
    taskCount: number;
    error?: string;
  }> {
    const { 
      limit = 10, 
      daysBack = null, 
      unprocessedOnly = true 
    } = options;
    
    try {
      console.log(`Starting enhanced batch email processing with options: limit=${limit}, daysBack=${daysBack || 'all'}, unprocessedOnly=${unprocessedOnly}`);
      
      // Build the query based on options
      let query = db.select().from(emails);
      
      if (unprocessedOnly) {
        query = query.where(sql`(processed_for_tasks IS NULL OR task_count = 0)`);
      }
      
      // Add date filter if daysBack is specified
      if (daysBack && daysBack > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        query = query.where(sql`${emails.timestamp} >= ${cutoffDate.toISOString()}`);
      }
      
      // Complete the query with sorting and limit
      const emailBatch = await query.orderBy(sql`timestamp DESC`).limit(limit);
      
      console.log(`Found ${emailBatch.length} emails to process`);
      
      let totalProcessed = 0;
      let totalTasksCreated = 0;
      
      for (const email of emailBatch) {
        try {
          console.log(`Processing email ID ${email.id}: ${email.subject || 'No Subject'}`);
          
          // Extract task data
          const extractionResult = await this.extractEnhancedTasksFromEmail(email.id);
          
          // Skip non-actionable emails
          if (extractionResult.email_classification) {
            console.log(`Email ID ${email.id} classified as ${extractionResult.email_classification}: ${extractionResult.explanation}`);
            totalProcessed++;
            continue;
          }
          
          // Create tasks from extraction
          const tasksCreated = await this.createTasksFromEnhancedExtraction(email.id);
          
          totalProcessed++;
          totalTasksCreated += tasksCreated;
          
          console.log(`Created ${tasksCreated} tasks from email ID ${email.id}`);
        } catch (emailError) {
          console.error(`Error processing email ID ${email.id}:`, emailError);
        }
      }
      
      console.log(`Enhanced batch processing complete: Processed ${totalProcessed} emails, created ${totalTasksCreated} tasks`);
      
      return {
        processed: totalProcessed,
        taskCount: totalTasksCreated
      };
    } catch (error: any) {
      console.error('Error in batch email processing:', error);
      return {
        processed: 0,
        taskCount: 0,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const enhancedTaskExtractionService = new EnhancedTaskExtractionService();