import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Enhances the tasks table with additional fields for detailed task information,
 * better categorization, and reminder functionality
 */
export async function enhanceTasksTable() {
  try {
    console.log('[migration] Starting task enhancement migration');
    
    // Add the task_category enum type if it doesn't exist
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_category') THEN
          CREATE TYPE task_category AS ENUM (
            'FollowUp_ResponseNeeded',
            'Report_Generation_Submission',
            'Meeting_Coordination_Prep',
            'Review_Approval_Feedback',
            'Research_Investigation_Analysis',
            'Planning_Strategy_Development',
            'Client_Vendor_Communication',
            'Internal_Project_Task',
            'Administrative_Logistics',
            'Urgent_Action_Required',
            'Information_To_Digest_Review',
            'Personal_Reminder_Appt'
          );
        END IF;
      END
      $$;
    `);
    console.log('[migration] Task category enum created (if it didn\'t exist)');

    // Add new columns to the tasks table - adding one by one to handle potential errors gracefully
    const columnsToAdd = [
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS detailed_description TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_snippet TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category task_category",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actors_involved TEXT[]",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_effort_minutes INTEGER",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_recurring_suggestion BOOLEAN DEFAULT FALSE",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_suggested_reminder_text TEXT",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_settings_json JSONB",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS next_reminder_at TIMESTAMP",
      "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS original_ai_suggestion_json JSONB"
    ];

    for (const columnSql of columnsToAdd) {
      try {
        await db.execute(sql.raw(columnSql));
        console.log(`[migration] Added column: ${columnSql.split('ADD COLUMN IF NOT EXISTS ')[1].split(' ')[0]}`);
      } catch (error) {
        console.error(`[migration] Error adding column: ${columnSql}`, error);
      }
    }

    // Create an index on next_reminder_at for efficient reminder queries
    try {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS tasks_next_reminder_at_idx ON tasks (next_reminder_at)
        WHERE next_reminder_at IS NOT NULL;
      `);
      console.log('[migration] Created index on next_reminder_at');
    } catch (error) {
      console.error('[migration] Error creating next_reminder_at index:', error);
    }

    console.log('[migration] Task enhancement migration completed successfully');
    return 'Success';
  } catch (error) {
    console.error('[migration] Error during task enhancement migration:', error);
    return `Error: ${error.message}`;
  }
}