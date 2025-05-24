import { db } from "../db";
import { sql, eq, and, isNull } from "drizzle-orm";
import { AiService } from "./aiService";
import { emails, tasks } from "@shared/schema";
import { log } from "../vite";

/**
 * Service for handling batch processing of embedding generation
 * Optimized for efficiency and error handling during large batch operations
 */
export class BatchEmbeddingService {
  private aiService: AiService;
  
  constructor() {
    this.aiService = new AiService();
  }
  
  /**
   * Generate embeddings for emails that don't have them yet
   * Uses batched processing to be efficient and handle errors gracefully
   * 
   * @param accountId - Optional account ID to filter emails by
   * @param batchSize - Number of emails to process in each batch
   * @returns Statistics about the batch processing
   */
  async generateEmailEmbeddings(accountId?: number, batchSize = 50): Promise<{
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
  }> {
    let stats = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0
    };
    
    let processingComplete = false;
    
    log(`Starting batch embedding generation for emails${accountId ? ` from account ${accountId}` : ''}`);
    
    while (!processingComplete) {
      try {
        // Find emails without embeddings, limited by batch size
        const emailBatch = await db.select()
          .from(emails)
          .where(
            and(
              isNull(emails.embeddingVector),
              accountId ? eq(emails.accountId, accountId) : undefined
            )
          )
          .limit(batchSize)
          .orderBy(sql`${emails.id} ASC`);
        
        // Exit if no more emails to process
        if (emailBatch.length === 0) {
          processingComplete = true;
          break;
        }
        
        log(`Processing batch of ${emailBatch.length} emails`);
        
        // Process each email in the batch
        for (const email of emailBatch) {
          stats.processed++;
          
          try {
            // Prepare email text for embedding (combining relevant fields)
            const emailText = this.prepareEmailTextForEmbedding(email);
            
            if (!emailText || emailText.trim().length < 10) {
              log(`Skipping email ID ${email.id} due to insufficient content`);
              stats.skipped++;
              continue;
            }
            
            // Generate embedding
            const embedding = await this.aiService.generateEmbedding(emailText);
            
            // Store embedding in database
            await db.update(emails)
              .set({
                embeddingVector: embedding,
                embeddingGeneratedAt: new Date()
              })
              .where(eq(emails.id, email.id));
            
            stats.successful++;
            
            // Log progress periodically
            if (stats.processed % 10 === 0 || stats.processed === 1) {
              log(`Progress: ${stats.processed} emails processed, ${stats.successful} successful, ${stats.failed} failed`);
            }
          } catch (error) {
            stats.failed++;
            log(`Error generating embedding for email ${email.id}: ${error.message}`);
            
            // Continue with next email rather than failing the entire batch
            continue;
          }
        }
        
      } catch (error) {
        log(`Error during batch processing: ${error.message}`);
        // If there's an error fetching the batch, exit the loop
        processingComplete = true;
      }
    }
    
    log(`Batch processing complete: ${stats.processed} emails processed, ${stats.successful} successful, ${stats.failed} failed, ${stats.skipped} skipped`);
    
    return stats;
  }
  
  /**
   * Generate embeddings for tasks that don't have them yet
   * Uses batched processing to be efficient and handle errors gracefully
   * 
   * @param userId - Optional user ID to filter tasks by
   * @param batchSize - Number of tasks to process in each batch
   * @returns Statistics about the batch processing
   */
  async generateTaskEmbeddings(userId?: number, batchSize = 50): Promise<{
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
  }> {
    let stats = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0
    };
    
    let processingComplete = false;
    
    log(`Starting batch embedding generation for tasks${userId ? ` from user ${userId}` : ''}`);
    
    while (!processingComplete) {
      try {
        // Find tasks without embeddings, limited by batch size
        const taskBatch = await db.select()
          .from(tasks)
          .where(
            and(
              isNull(tasks.embeddingVector),
              userId ? eq(tasks.userId, userId) : undefined
            )
          )
          .limit(batchSize)
          .orderBy(sql`${tasks.id} ASC`);
        
        // Exit if no more tasks to process
        if (taskBatch.length === 0) {
          processingComplete = true;
          break;
        }
        
        log(`Processing batch of ${taskBatch.length} tasks`);
        
        // Process each task in the batch
        for (const task of taskBatch) {
          stats.processed++;
          
          try {
            // Prepare task text for embedding
            const taskText = this.prepareTaskTextForEmbedding(task);
            
            if (!taskText || taskText.trim().length < 10) {
              log(`Skipping task ID ${task.id} due to insufficient content`);
              stats.skipped++;
              continue;
            }
            
            // Generate embedding
            const embedding = await this.aiService.generateEmbedding(taskText);
            
            // Store embedding in database
            await db.update(tasks)
              .set({
                embeddingVector: embedding,
                embeddingGeneratedAt: new Date()
              })
              .where(eq(tasks.id, task.id));
            
            stats.successful++;
            
            // Log progress periodically
            if (stats.processed % 10 === 0 || stats.processed === 1) {
              log(`Progress: ${stats.processed} tasks processed, ${stats.successful} successful, ${stats.failed} failed`);
            }
          } catch (error) {
            stats.failed++;
            log(`Error generating embedding for task ${task.id}: ${error.message}`);
            
            // Continue with next task rather than failing the entire batch
            continue;
          }
        }
        
      } catch (error) {
        log(`Error during batch processing: ${error.message}`);
        // If there's an error fetching the batch, exit the loop
        processingComplete = true;
      }
    }
    
    log(`Batch processing complete: ${stats.processed} tasks processed, ${stats.successful} successful, ${stats.failed} failed, ${stats.skipped} skipped`);
    
    return stats;
  }
  
  /**
   * Prepare email text for embedding generation
   * Combines and cleans relevant fields to create optimal embedding input
   */
  private prepareEmailTextForEmbedding(email: any): string {
    // Use cleaned content if available, otherwise use raw content
    const content = email.cleanContent || email.textContent || email.htmlContent || '';
    
    let text = '';
    
    // Add subject (high importance)
    if (email.subject) {
      text += `Subject: ${email.subject}\n\n`;
    }
    
    // Add sender (medium importance)
    if (email.sender) {
      text += `From: ${email.sender}\n`;
    }
    
    // Add recipients (low importance)
    if (email.recipients) {
      text += `To: ${email.recipients}\n`;
    }
    
    // Add date (low importance)
    if (email.timestamp) {
      text += `Date: ${new Date(email.timestamp).toISOString()}\n\n`;
    }
    
    // Add main content (highest importance)
    text += content;
    
    // For OpenAI embeddings, truncate to avoid token limits
    // Text-embedding-3-small has ~8k token limit, but we're being conservative
    return this.truncateTextForEmbedding(text);
  }
  
  /**
   * Prepare task text for embedding generation
   * Combines and cleans relevant fields to create optimal embedding input
   */
  private prepareTaskTextForEmbedding(task: any): string {
    let text = '';
    
    // Add title (high importance)
    if (task.title) {
      text += `Title: ${task.title}\n\n`;
    }
    
    // Add description (high importance)
    if (task.description) {
      text += `${task.description}\n\n`;
    }
    
    // Add priority (medium importance)
    if (task.priority) {
      text += `Priority: ${task.priority}\n`;
    }
    
    // Add status (medium importance)
    if (task.status) {
      text += `Status: ${task.status}\n`;
    }
    
    // Add due date (medium importance)
    if (task.dueDate) {
      text += `Due Date: ${new Date(task.dueDate).toISOString()}\n`;
    }
    
    // Add source email context if available
    if (task.sourceContext) {
      text += `\nSource Context: ${task.sourceContext}\n`;
    }
    
    // For OpenAI embeddings, truncate to avoid token limits
    return this.truncateTextForEmbedding(text);
  }
  
  /**
   * Truncate text to stay within embedding model token limits
   * Ensures we don't exceed OpenAI's token limits while keeping the most important content
   */
  private truncateTextForEmbedding(text: string): string {
    // Very conservative truncation at 10,000 characters
    // This should keep us well under the ~8,000 token limit for OpenAI's text-embedding-3-small
    const maxLength = 10000;
    
    if (text.length <= maxLength) {
      return text;
    }
    
    // If truncation needed, log it
    log(`Truncating text from ${text.length} to ${maxLength} characters for embedding generation`);
    
    // Simple truncation strategy - more sophisticated chunking could be implemented here
    return text.substring(0, maxLength);
  }
}

export const batchEmbeddingService = new BatchEmbeddingService();