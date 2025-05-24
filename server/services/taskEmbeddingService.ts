import { db } from "../db";
import { tasks } from "@shared/schema";
import { eq, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { log } from "../vite";
import { aiService } from "./aiService";

/**
 * Service for managing task embeddings
 * Ensures all tasks have proper 768-dimension embeddings for semantic search
 */
export class TaskEmbeddingService {
  /**
   * Generate embedding for a single task
   * @param taskId The ID of the task to generate embedding for
   */
  async generateEmbeddingForTask(taskId: number): Promise<boolean> {
    try {
      // Fetch the task
      const [task] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId));
      
      if (!task) {
        log(`Task not found with ID: ${taskId}`, "error");
        return false;
      }

      // Skip if the task already has an embedding
      if (task.embeddingVector) {
        log(`Task ${taskId} already has an embedding, skipping.`);
        return true;
      }

      // Prepare the text for embedding
      const taskText = this.prepareTaskTextForEmbedding(task);
      
      if (!taskText || taskText.trim().length < 5) {
        log(`Task ${taskId} has insufficient content for embedding generation.`);
        return false;
      }

      // Generate the embedding
      const embedding = await aiService.generateEmbedding(taskText);
      
      // Format the vector string properly for pgvector with 768 dimensions
      const vectorString = `[${embedding.join(',')}]`;
      
      // Update the task with the embedding
      await db.execute(sql`
        UPDATE tasks
        SET 
          embedding_vector = ${vectorString}::vector(768),
          updated_at = NOW()
        WHERE id = ${taskId}
      `);
      
      log(`Successfully generated and stored embedding for task ${taskId} (${embedding.length} dimensions)`);
      return true;
    } catch (error) {
      log(`Error generating embedding for task ${taskId}: ${error.message}`, "error");
      return false;
    }
  }

  /**
   * Generate embeddings for all tasks that don't have them yet
   * @param limit Maximum number of tasks to process
   * @returns Statistics about the processing
   */
  async generateEmbeddingsForTasks(limit: number = 100): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    const stats = {
      processed: 0,
      successful: 0,
      failed: 0
    };

    try {
      // Find tasks without embeddings
      const tasksWithoutEmbeddings = await db
        .select()
        .from(tasks)
        .where(isNull(tasks.embeddingVector))
        .limit(limit);

      log(`Found ${tasksWithoutEmbeddings.length} tasks without embeddings`);

      // Process each task
      for (const task of tasksWithoutEmbeddings) {
        stats.processed++;
        
        try {
          // Prepare the text for embedding
          const taskText = this.prepareTaskTextForEmbedding(task);
          
          if (!taskText || taskText.trim().length < 5) {
            log(`Skipping task ${task.id} due to insufficient content`);
            stats.failed++;
            continue;
          }

          // Generate the embedding
          const embedding = await aiService.generateEmbedding(taskText);
          
          // Format the vector string properly for pgvector with 768 dimensions
          const vectorString = `[${embedding.join(',')}]`;
          
          // Update the task with the embedding
          await db.execute(sql`
            UPDATE tasks
            SET 
              embedding_vector = ${vectorString}::vector(768),
              updated_at = NOW()
            WHERE id = ${task.id}
          `);
          
          log(`Successfully generated and stored embedding for task ${task.id} (${embedding.length} dimensions)`);
          stats.successful++;
        } catch (error) {
          log(`Error generating embedding for task ${task.id}: ${error.message}`, "error");
          stats.failed++;
        }
      }

      return stats;
    } catch (error) {
      log(`Error in batch embedding generation: ${error.message}`, "error");
      return stats;
    }
  }

  /**
   * Prepare task text for embedding generation
   * @param task The task object
   * @returns Formatted text suitable for embedding generation
   */
  private prepareTaskTextForEmbedding(task: any): string {
    let text = '';
    
    // Add title (high importance)
    if (task.title) {
      text += `Title: ${task.title}\n\n`;
    }
    
    // Add description (high importance)
    if (task.description) {
      text += `Description: ${task.description}\n\n`;
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
    
    // Add completion status
    if (task.isCompleted !== undefined) {
      text += `Completed: ${task.isCompleted ? 'Yes' : 'No'}\n`;
    }
    
    // Add source email ID if available
    if (task.emailId) {
      text += `Source Email ID: ${task.emailId}\n`;
    }
    
    return text;
  }
}

export const taskEmbeddingService = new TaskEmbeddingService();