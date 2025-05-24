/**
 * Simple task extraction test endpoint
 * This provides a direct and simplified version of the task extraction API
 */

const { db } = require('./db');
const { emails, tasks } = require('../shared/schema');
const { eq, desc, isNull, and, sql } = require('drizzle-orm');

// Simple extraction function that just marks emails as processed
async function simpleExtraction(options = {}) {
  const {
    limit = 10,
    daysBack = null,
    unprocessedOnly = true,
  } = options;
  
  console.log(`Starting simplified extraction with params:`, { limit, daysBack, unprocessedOnly });
  
  try {
    // Build the query based on options
    let query = db.select().from(emails);
    
    if (unprocessedOnly) {
      query = query.where(isNull(emails.processedForTasks));
    }
    
    // Add date filter if daysBack is specified
    if (daysBack && daysBack > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);
      query = query.where(sql`${emails.timestamp} >= ${cutoffDate.toISOString()}`);
    }
    
    // Complete the query with sorting and limit
    const recentEmails = await query.orderBy(desc(emails.timestamp)).limit(limit);
    
    console.log(`Found ${recentEmails.length} emails to process`);
    
    // Just mark emails as processed without actual task creation
    for (const email of recentEmails) {
      await db
        .update(emails)
        .set({ processedForTasks: new Date() })
        .where(eq(emails.id, email.id));
    }
    
    // Return consistent format
    return {
      success: true,
      data: {
        processed: recentEmails.length,
        taskCount: 0
      },
      message: `Marked ${recentEmails.length} emails as processed (test mode - no tasks created)`
    };
  } catch (error) {
    console.error("Test extraction error:", error);
    return {
      success: false,
      error: error.message || "Unknown error in test extraction",
      message: `Test extraction failed: ${error.message || "Unknown error"}`
    };
  }
}

module.exports = { simpleExtraction };