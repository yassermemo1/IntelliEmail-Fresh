import { db } from "../db";
import { feedback, userTaskInteractions, tasks, emails } from "@shared/schema";
import { eq } from "drizzle-orm";
import { log } from "../vite";

export interface TaskWithEmail {
  task: any;
  email?: any;
}

/**
 * Service for handling feedback and user interactions
 * This is the foundation for the Adaptive Learning System
 */
export class FeedbackService {
  /**
   * Log a HITL review action (approval, rejection, or modification)
   */
  async logHitlReviewAction(
    userId: number,
    taskId: number,
    action: "approved" | "rejected" | "modified",
    originalTask: any,
    correctedTask?: any
  ) {
    try {
      // Get related email ID if applicable
      const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      const relatedEmailId = task[0]?.emailId || null;

      // Determine feedback type based on action
      const feedbackType = `hitl_task_${action}`;
      
      // Create feedback entry
      const newFeedback = await db.insert(feedback).values({
        userId,
        taskId,
        relatedEmailId,
        feedbackType,
        sourceType: "hitl_review",
        originalTask: originalTask,
        correctedTask: correctedTask || originalTask,
        metadata: {
          timestamp: new Date().toISOString(),
          confidence: originalTask.aiConfidence || null,
        }
      }).returning();

      log(`Logged HITL review action: ${action} for task ${taskId}`);
      return newFeedback[0];
    } catch (error) {
      log(`Error logging HITL review action: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * Log a direct task modification by the user
   */
  async logTaskModification(
    userId: number,
    taskId: number,
    interactionType: string,
    previousValue: any,
    newValue: any
  ) {
    try {
      // Get task to check if it was AI-generated and get source email
      const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      
      if (!task.length) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      const taskData = task[0];
      const taskWasAiGenerated = taskData.aiGenerated || false;
      const sourceEmailId = taskData.emailId || null;
      
      // Create user task interaction entry
      const newInteraction = await db.insert(userTaskInteractions).values({
        userId,
        taskId,
        interactionType,
        previousValue,
        newValue,
        sourceEmailId,
        taskWasAiGenerated
      }).returning();

      log(`Logged task modification: ${interactionType} for task ${taskId}`);
      return newInteraction[0];
    } catch (error) {
      log(`Error logging task modification: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * Log task lifecycle events (completion, deletion)
   */
  async logTaskLifecycleEvent(
    userId: number,
    taskId: number,
    eventType: "completed" | "deleted",
    previousState: any
  ) {
    try {
      // Get task to check if it was AI-generated and get source email
      const task = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      
      if (!task.length) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      
      const taskData = task[0];
      const taskWasAiGenerated = taskData.aiGenerated || false;
      const sourceEmailId = taskData.emailId || null;
      
      // For completed tasks, we log the change from incomplete to complete
      // For deleted tasks, we log the deletion event
      const interactionType = `task_${eventType}`;
      const newState = eventType === "completed" 
        ? { ...previousState, isCompleted: true } 
        : { deleted: true };
      
      // Create user task interaction entry
      const newInteraction = await db.insert(userTaskInteractions).values({
        userId,
        taskId,
        interactionType,
        previousValue: previousState,
        newValue: newState,
        sourceEmailId,
        taskWasAiGenerated
      }).returning();

      log(`Logged task lifecycle event: ${eventType} for task ${taskId}`);
      return newInteraction[0];
    } catch (error) {
      log(`Error logging task lifecycle event: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * Get feedback for a specific user
   */
  async getUserFeedback(userId: number, limit = 100) {
    try {
      const userFeedback = await db.select()
        .from(feedback)
        .where(eq(feedback.userId, userId))
        .orderBy(feedback.timestamp)
        .limit(limit);
      
      return userFeedback;
    } catch (error) {
      log(`Error getting user feedback: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * Get task interactions for a specific user
   */
  async getUserTaskInteractions(userId: number, limit = 100) {
    try {
      const interactions = await db.select()
        .from(userTaskInteractions)
        .where(eq(userTaskInteractions.userId, userId))
        .orderBy(userTaskInteractions.createdAt)
        .limit(limit);
      
      return interactions;
    } catch (error) {
      log(`Error getting user task interactions: ${error.message}`, "error");
      throw error;
    }
  }

  /**
   * Get feedback and user interactions for a specific task
   */
  async getTaskFeedbackAndInteractions(taskId: number) {
    try {
      const taskFeedback = await db.select()
        .from(feedback)
        .where(eq(feedback.taskId, taskId))
        .orderBy(feedback.timestamp);
      
      const taskInteractions = await db.select()
        .from(userTaskInteractions)
        .where(eq(userTaskInteractions.taskId, taskId))
        .orderBy(userTaskInteractions.createdAt);
      
      return {
        feedback: taskFeedback,
        interactions: taskInteractions
      };
    } catch (error) {
      log(`Error getting task feedback and interactions: ${error.message}`, "error");
      throw error;
    }
  }
}

export const feedbackService = new FeedbackService();