import { db } from './db.ts';
import { emails, tasks } from '../shared/schema.ts';
import { eq, desc, sql } from 'drizzle-orm';
import OpenAI from 'openai';

// Initialize OpenAI with the API key from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyzes a batch of real emails and extracts tasks with enhanced metadata
 */
async function analyzeRealEmails(batchSize = 10) {
  try {
    // Get a batch of real emails to analyze
    const emailBatch = await db.select()
      .from(emails)
      .orderBy(desc(emails.timestamp))
      .limit(batchSize);
    
    console.log(`Processing ${emailBatch.length} real emails for task extraction`);
    
    let tasksCreated = 0;
    let marketingCount = 0;
    let nonActionableCount = 0;
    
    for (const email of emailBatch) {
      console.log(`Analyzing email ID ${email.id}: ${email.subject}`);
      
      try {
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
        
        Return your response in valid JSON format.
        `;
        
        const userPrompt = `
        Please analyze this email and extract any actionable tasks:
        
        Email Subject: ${email.subject || 'No Subject'}
        From: ${email.sender || email.from || 'Unknown Sender'}
        Date: ${email.timestamp ? new Date(email.timestamp).toISOString() : (email.date ? new Date(email.date).toISOString() : 'Unknown Date')}
        
        Content:
        ${email.body || email.textContent || email.htmlContent || 'No content available'}
        `;
        
        console.log(`Using GPT-4o model for enhanced task extraction`);
        
        // Call OpenAI to analyze the email with the enhanced prompt
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
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
        
        // Check if the email is marketing/promotional or non-actionable
        if (result.email_classification) {
          if (result.email_classification === 'marketing_promotional') {
            marketingCount++;
            console.log(`Email ID ${email.id} classified as marketing/promotional: ${result.explanation}`);
          } else if (result.email_classification === 'non_actionable') {
            nonActionableCount++;
            console.log(`Email ID ${email.id} classified as non-actionable: ${result.explanation}`);
          }
          continue;
        }
        
        // Process extracted tasks if found
        if (result.tasks && Array.isArray(result.tasks) && result.tasks.length > 0) {
          for (const taskData of result.tasks) {
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
                // Simplified approach for date parsing
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
              title: taskData.suggested_title || 'Task from email',
              description: taskData.detailed_description || '',
              detailed_description: taskData.detailed_description || '',
              source_snippet: taskData.source_snippet || '',
              priority: priorityLevel,
              category: taskData.suggested_category || null,
              actors_involved: taskData.actors_involved || [],
              estimated_effort_minutes: taskData.estimated_effort_minutes || null,
              isCompleted: false,
              aiGenerated: true,
              aiConfidence: confidenceScore,
              aiModel: 'gpt-4o',
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
              const insertResult = await db.insert(tasks).values(taskRecord).returning();
              if (insertResult.length > 0) {
                tasksCreated++;
                console.log(`Created task ID ${insertResult[0].id}: ${taskRecord.title}`);
              }
            } catch (insertError) {
              console.error(`Error inserting task: ${insertError.message}`);
              // If category enum value is invalid, retry without it
              if (insertError.message.includes('invalid input value for enum')) {
                console.log('Retrying task insertion without category');
                const retryRecord = { ...taskRecord, category: null };
                const retryResult = await db.insert(tasks).values(retryRecord).returning();
                if (retryResult.length > 0) {
                  tasksCreated++;
                  console.log(`Created task ID ${retryResult[0].id}: ${retryRecord.title} (without category)`);
                }
              }
            }
          }
        } else {
          console.log(`No tasks extracted from email ID ${email.id}`);
        }
      } catch (emailError) {
        console.error(`Error processing email ID ${email.id}:`, emailError);
      }
    }
    
    console.log(`
    Task Extraction Summary:
    ------------------------
    Emails processed: ${emailBatch.length}
    Tasks created: ${tasksCreated}
    Marketing/promotional emails: ${marketingCount}
    Non-actionable emails: ${nonActionableCount}
    `);
    
    return {
      emailsProcessed: emailBatch.length,
      tasksCreated,
      marketingCount,
      nonActionableCount
    };
  } catch (error) {
    console.error('Error analyzing emails:', error);
    throw error;
  }
}

// Execute the function with a smaller batch size for testing
analyzeRealEmails(5)
  .then((results) => {
    console.log('Batch analysis complete', results);
    process.exit(0);
  })
  .catch(error => {
    console.error('Batch analysis failed:', error);
    process.exit(1);
  });