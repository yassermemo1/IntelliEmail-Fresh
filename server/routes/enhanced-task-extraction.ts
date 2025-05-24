import { Router } from 'express';
import { db } from '../db';
import { emails, tasks } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

// Initialize OpenAI with the API key from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const router = Router();

/**
 * Enhanced task extraction API endpoint
 * This route allows testing our improved task extraction on any email
 * It supports either direct email content or retrieving an email by ID
 */
router.post('/extract-tasks-enhanced', async (req, res) => {
  try {
    const { emailId, emailContent, emailSubject, emailSender } = req.body;
    
    // Validate input - need either emailId or emailContent
    if (!emailId && !emailContent) {
      return res.status(400).json({ 
        error: 'Either emailId or emailContent is required' 
      });
    }
    
    let emailData: any = {};
    
    // If emailId is provided, fetch the email from the database
    if (emailId) {
      const emailResult = await db.select().from(emails).where(eq(emails.id, emailId));
      
      if (!emailResult || emailResult.length === 0) {
        return res.status(404).json({ error: 'Email not found' });
      }
      
      emailData = emailResult[0];
    } else {
      // Use the provided content
      emailData = {
        subject: emailSubject || 'No Subject',
        sender: emailSender || 'Unknown Sender',
        body: emailContent,
        timestamp: new Date()
      };
    }
    
    // Enhanced AI prompt for better task extraction with rich metadata
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
    
    Email Subject: ${emailData.subject || 'No Subject'}
    From: ${emailData.sender || emailData.from || 'Unknown Sender'}
    Date: ${emailData.timestamp ? new Date(emailData.timestamp).toISOString() : 'Unknown Date'}
    
    Content:
    ${emailData.body || emailData.textContent || emailData.htmlContent || 'No content available'}
    `;
    
    console.log('Using GPT-4o model for enhanced task extraction');
    
    // Call OpenAI with the enhanced prompt
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
    
    // If email is marketing/promotional or non-actionable, return that classification
    if (result.email_classification) {
      return res.json({
        email_id: emailId,
        email_subject: emailData.subject,
        classification: result.email_classification,
        explanation: result.explanation,
        tasks: []
      });
    }
    
    // Process extracted tasks if found
    const createdTasks = [];
    
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
          emailId: emailId || null,
          title: taskData.suggested_title || 'Task from email',
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
          aiModel: 'gpt-4o',
          originalAiSuggestionJson: JSON.stringify(taskData), // Store the complete AI suggestion
          needsReview: true, // Mark for human review
          isRecurringSuggestion: taskData.is_recurring_hint || false,
          aiSuggestedReminderText: taskData.reminder_suggestion_text || null,
          dueDate: dueDate,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        try {
          // Only insert into database if emailId is provided
          if (emailId) {
            const insertResult = await db.insert(tasks).values(taskRecord).returning();
            if (insertResult.length > 0) {
              createdTasks.push({
                ...taskRecord,
                id: insertResult[0].id,
                created: true
              });
            }
          } else {
            // Just return the task without creating in database
            createdTasks.push({
              ...taskRecord,
              created: false
            });
          }
        } catch (insertError: any) {
          console.error(`Error inserting task: ${insertError.message}`);
          // If category enum value is invalid, retry without it
          if (insertError.message.includes('invalid input value for enum')) {
            console.log('Retrying task insertion without category');
            const retryRecord = { ...taskRecord, category: null };
            
            if (emailId) {
              const retryResult = await db.insert(tasks).values(retryRecord).returning();
              if (retryResult.length > 0) {
                createdTasks.push({
                  ...retryRecord,
                  id: retryResult[0].id,
                  created: true,
                  note: 'Category removed due to database constraints'
                });
              }
            } else {
              createdTasks.push({
                ...retryRecord,
                created: false,
                note: 'Category would be removed due to database constraints'
              });
            }
          } else {
            // Add to response but mark as error
            createdTasks.push({
              ...taskRecord,
              created: false,
              error: insertError.message
            });
          }
        }
      }
    }
    
    // Return detailed result of task extraction
    return res.json({
      email_id: emailId,
      email_subject: emailData.subject,
      classification: result.email_classification || 'contains_tasks',
      raw_ai_response: result,
      tasks: createdTasks,
      tasks_created: createdTasks.filter(t => t.created).length,
      tasks_identified: result.tasks?.length || 0
    });
    
  } catch (error: any) {
    console.error('Error in enhanced task extraction:', error);
    return res.status(500).json({ 
      error: 'Task extraction failed', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;