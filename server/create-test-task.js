import { db } from './db.ts';
import { tasks } from '../shared/schema.ts';

async function createTestTask() {
  try {
    const task = {
      userId: 1,
      emailId: 1, // Use a valid email ID from your database
      title: "Test Enhanced Task",
      description: "This is a test of our enhanced task schema",
      detailed_description: "This is a detailed analysis of the task extracted from the email. The task requires follow-up with the marketing team regarding the Q3 planning session. Multiple teams need to be coordinated for this initiative.",
      source_snippet: "As discussed in our meeting yesterday, we need to finalize the Q3 plans by next Friday. Could you please coordinate with the marketing and sales teams?",
      priority: "high",
      category: "Meeting_Coordination_Prep",
      actors_involved: ["Marketing Team", "Sales Team"],
      estimated_effort_minutes: 45,
      isCompleted: false,
      aiGenerated: true,
      aiConfidence: 92,
      aiModel: "gpt-4o",
      originalAiSuggestionJson: {
        suggested_title: "Coordinate Q3 Planning Session",
        detailed_description: "Organize meeting with marketing and sales teams to finalize Q3 plans before the deadline next Friday",
        source_snippet: "As discussed in our meeting yesterday, we need to finalize the Q3 plans by next Friday. Could you please coordinate with the marketing and sales teams?",
        suggested_priority_level: "P2_High",
        extracted_deadline_text: "by next Friday",
        suggested_category: "Meeting_Coordination_Prep",
        actors_involved: ["Marketing Team", "Sales Team"],
        estimated_effort_minutes: 45,
        is_recurring_hint: false,
        reminder_suggestion_text: "remind me 2 days before the Friday deadline",
        confidence_in_task_extraction: 0.92
      },
      needsReview: true,
      isRecurringSuggestion: false,
      aiSuggestedReminderText: "remind me 2 days before the Friday deadline",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log("Attempting to insert enhanced task...");
    const result = await db.insert(tasks).values(task).returning();
    
    console.log(`Task created successfully with ID: ${result[0].id}`);
    console.log("Task details:", result[0]);
    
    return result[0];
  } catch (error) {
    console.error("Error creating test task:", error);
    throw error;
  }
}

// Execute the function
createTestTask()
  .then(() => {
    console.log("Test task creation complete");
    process.exit(0);
  })
  .catch(error => {
    console.error("Test task creation failed:", error);
    process.exit(1);
  });