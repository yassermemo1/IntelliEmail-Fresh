import { db } from "../db";
import { feedback, userTaskInteractions, users } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { log } from "../vite";
import { feedbackService } from "./feedbackService";

/**
 * Schema for the user_adaptation_profiles table
 * This will be created in the database if it doesn't exist
 */
interface UserAdaptationProfile {
  id: number;
  userId: number;
  priorityPreferences: Record<string, any>;
  categoryPreferences: Record<string, any>;
  dueDatePreferences: Record<string, any>;
  senderPatterns: Record<string, any>;
  subjectPatterns: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schema for suggested rules based on adaptation patterns
 */
interface SuggestedRule {
  id?: number;
  userId: number;
  ruleType: string; // 'priority', 'category', 'dueDate'
  pattern: string; // 'sender:example.com', 'subject:contains:meeting'
  action: string; // 'set_priority:high', 'set_category:work'
  confidence: number; // 0-100
  examples: any[]; // Array of examples used to generate this rule
  status: string; // 'suggested', 'accepted', 'declined'
  createdAt?: Date;
}

/**
 * Service for the Adaptive Learning System
 * This analyzes feedback and interactions to adapt AI behavior to user preferences
 */
export class AdaptationLearningService {
  private profileCache: Map<number, UserAdaptationProfile> = new Map();
  
  /**
   * Initialize the adaptation learning service
   * This creates necessary tables if they don't exist
   */
  async initialize() {
    try {
      // Check if user_adaptation_profiles table exists
      const profileTableExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'user_adaptation_profiles'
        );
      `);
      
      const exists = profileTableExists.rows?.[0]?.exists || false;
      
      if (!exists) {
        log("Creating user_adaptation_profiles table...");
        await db.execute(sql`
          CREATE TABLE user_adaptation_profiles (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            priority_preferences JSONB NOT NULL DEFAULT '{}',
            category_preferences JSONB NOT NULL DEFAULT '{}',
            due_date_preferences JSONB NOT NULL DEFAULT '{}',
            sender_patterns JSONB NOT NULL DEFAULT '{}',
            subject_patterns JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          
          CREATE INDEX user_adaptation_profiles_user_id_idx ON user_adaptation_profiles(user_id);
        `);
      }
      
      // Check if suggested_rules table exists
      const rulesTableExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'suggested_rules'
        );
      `);
      
      const rulesExist = rulesTableExists.rows?.[0]?.exists || false;
      
      if (!rulesExist) {
        log("Creating suggested_rules table...");
        await db.execute(sql`
          CREATE TABLE suggested_rules (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            rule_type TEXT NOT NULL,
            pattern TEXT NOT NULL,
            action TEXT NOT NULL,
            confidence INTEGER NOT NULL,
            examples JSONB NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'suggested',
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
          );
          
          CREATE INDEX suggested_rules_user_id_idx ON suggested_rules(user_id);
        `);
      }
      
      log("Adaptation Learning Service initialized successfully");
      return true;
    } catch (error) {
      log(`Error initializing Adaptation Learning Service: ${error.message}`, "error");
      return false;
    }
  }
  
  /**
   * Process feedback and interactions for a user to update their adaptation profile
   * This is the core learning function that analyzes patterns
   */
  async processUserFeedback(userId: number) {
    try {
      log(`Processing feedback for user ${userId}...`);
      
      // Get all feedback and interactions for the user
      const userFeedback = await feedbackService.getUserFeedback(userId, 500);
      const userInteractions = await feedbackService.getUserTaskInteractions(userId, 500);
      
      // Get or create user profile
      let profile = await this.getUserProfile(userId);
      if (!profile) {
        profile = await this.createUserProfile(userId);
      }
      
      // Process priority preferences from feedback
      const priorityPreferences = this.analyzePriorityPreferences(userFeedback, userInteractions);
      
      // Process category preferences from feedback
      const categoryPreferences = this.analyzeCategoryPreferences(userFeedback, userInteractions);
      
      // Process due date preferences from feedback
      const dueDatePreferences = this.analyzeDueDatePreferences(userFeedback, userInteractions);
      
      // Process sender patterns
      const senderPatterns = this.analyzeSenderPatterns(userFeedback, userInteractions);
      
      // Process subject patterns
      const subjectPatterns = this.analyzeSubjectPatterns(userFeedback, userInteractions);
      
      // Update user profile
      await this.updateUserProfile(userId, {
        priorityPreferences,
        categoryPreferences,
        dueDatePreferences,
        senderPatterns,
        subjectPatterns
      });
      
      // Generate rule suggestions based on patterns
      const suggestedRules = this.generateRuleSuggestions(
        userId, 
        priorityPreferences,
        categoryPreferences,
        dueDatePreferences,
        senderPatterns,
        subjectPatterns
      );
      
      // Store suggested rules
      if (suggestedRules.length > 0) {
        await this.storeSuggestedRules(suggestedRules);
      }
      
      log(`Successfully processed feedback for user ${userId}`);
      return {
        success: true,
        userProfile: await this.getUserProfile(userId),
        suggestedRules: await this.getSuggestedRules(userId)
      };
    } catch (error) {
      log(`Error processing user feedback: ${error.message}`, "error");
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Apply user adaptation profile to enhance an AI prompt
   * This adds personalization context to guide the AI
   */
  applyAdaptationToPrompt(userId: number, prompt: string, context: any = {}): string {
    // Get user profile from cache or use empty defaults
    const profile = this.profileCache.get(userId) || {
      priorityPreferences: {},
      categoryPreferences: {},
      dueDatePreferences: {},
      senderPatterns: {},
      subjectPatterns: {}
    };
    
    // Extract context elements
    const sender = context.sender || '';
    const subject = context.subject || '';
    const emailContent = context.emailContent || '';
    
    // Build personalization context
    let personalizationContext = "User preferences:\n";
    
    // Add priority preferences if they exist
    if (Object.keys(profile.priorityPreferences).length > 0) {
      personalizationContext += "Priority preferences:\n";
      for (const [pattern, data] of Object.entries(profile.priorityPreferences)) {
        personalizationContext += `- Pattern "${pattern}": prefer priority "${data.priority}" (confidence: ${data.confidence}%)\n`;
      }
    }
    
    // Add category preferences if they exist
    if (Object.keys(profile.categoryPreferences).length > 0) {
      personalizationContext += "\nCategory preferences:\n";
      for (const [pattern, data] of Object.entries(profile.categoryPreferences)) {
        personalizationContext += `- Pattern "${pattern}": prefer category "${data.category}" (confidence: ${data.confidence}%)\n`;
      }
    }
    
    // Add due date preferences if they exist
    if (Object.keys(profile.dueDatePreferences).length > 0) {
      personalizationContext += "\nDue date preferences:\n";
      for (const [pattern, data] of Object.entries(profile.dueDatePreferences)) {
        personalizationContext += `- Pattern "${pattern}": prefer due in ${data.daysFromNow} days (confidence: ${data.confidence}%)\n`;
      }
    }
    
    // Check for specific sender matches
    if (sender && Object.keys(profile.senderPatterns).length > 0) {
      for (const [pattern, data] of Object.entries(profile.senderPatterns)) {
        if (sender.includes(pattern)) {
          personalizationContext += `\nMatched sender pattern "${pattern}":\n`;
          if (data.priority) {
            personalizationContext += `- Suggested priority: ${data.priority}\n`;
          }
          if (data.category) {
            personalizationContext += `- Suggested category: ${data.category}\n`;
          }
          if (data.dueDate) {
            personalizationContext += `- Suggested due date: ${data.dueDate}\n`;
          }
        }
      }
    }
    
    // Check for specific subject matches
    if (subject && Object.keys(profile.subjectPatterns).length > 0) {
      for (const [pattern, data] of Object.entries(profile.subjectPatterns)) {
        if (subject.includes(pattern)) {
          personalizationContext += `\nMatched subject pattern "${pattern}":\n`;
          if (data.priority) {
            personalizationContext += `- Suggested priority: ${data.priority}\n`;
          }
          if (data.category) {
            personalizationContext += `- Suggested category: ${data.category}\n`;
          }
          if (data.dueDate) {
            personalizationContext += `- Suggested due date: ${data.dueDate}\n`;
          }
        }
      }
    }
    
    // Add personalization context to prompt
    return `${prompt}\n\n${personalizationContext}`;
  }
  
  /**
   * Apply user adaptation profile when generating tasks
   * This is used after AI generates task to adjust based on learned patterns
   */
  applyAdaptationToTask(userId: number, task: any, context: any = {}): any {
    // Get user profile from cache or use empty defaults
    const profile = this.profileCache.get(userId) || {
      priorityPreferences: {},
      categoryPreferences: {},
      dueDatePreferences: {},
      senderPatterns: {},
      subjectPatterns: {}
    };
    
    // Extract context elements
    const sender = context.sender || '';
    const subject = context.subject || '';
    
    // Create a copy of the task to modify
    const adaptedTask = { ...task };
    
    // Check for sender patterns
    if (sender && Object.keys(profile.senderPatterns).length > 0) {
      for (const [pattern, data] of Object.entries(profile.senderPatterns)) {
        if (sender.includes(pattern) && data.confidence > 75) {
          if (data.priority) adaptedTask.priority = data.priority;
          if (data.category) {
            adaptedTask.categories = adaptedTask.categories || [];
            if (!adaptedTask.categories.includes(data.category)) {
              adaptedTask.categories.push(data.category);
            }
          }
          if (data.dueDate && data.dueDate === 'tomorrow') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            adaptedTask.dueDate = tomorrow;
          } else if (data.dueDate && data.dueDate === 'next_week') {
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            adaptedTask.dueDate = nextWeek;
          }
        }
      }
    }
    
    // Check for subject patterns
    if (subject && Object.keys(profile.subjectPatterns).length > 0) {
      for (const [pattern, data] of Object.entries(profile.subjectPatterns)) {
        if (subject.includes(pattern) && data.confidence > 75) {
          if (data.priority) adaptedTask.priority = data.priority;
          if (data.category) {
            adaptedTask.categories = adaptedTask.categories || [];
            if (!adaptedTask.categories.includes(data.category)) {
              adaptedTask.categories.push(data.category);
            }
          }
          if (data.dueDate) {
            // Apply due date pattern
            // Implementation depends on how due date is stored
          }
        }
      }
    }
    
    return adaptedTask;
  }
  
  /**
   * Get all suggested rules for a user
   */
  async getSuggestedRules(userId: number): Promise<SuggestedRule[]> {
    try {
      const rules = await db.execute(sql`
        SELECT * FROM suggested_rules
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `);
      
      return rules.rows || [];
    } catch (error) {
      log(`Error getting suggested rules: ${error.message}`, "error");
      return [];
    }
  }
  
  /**
   * Accept or decline a suggested rule
   */
  async updateRuleStatus(ruleId: number, status: 'accepted' | 'declined'): Promise<boolean> {
    try {
      await db.execute(sql`
        UPDATE suggested_rules
        SET status = ${status}
        WHERE id = ${ruleId}
      `);
      
      return true;
    } catch (error) {
      log(`Error updating rule status: ${error.message}`, "error");
      return false;
    }
  }
  
  /**
   * Reset the user adaptation profile
   */
  async resetUserProfile(userId: number): Promise<boolean> {
    try {
      await db.execute(sql`
        DELETE FROM user_adaptation_profiles
        WHERE user_id = ${userId}
      `);
      
      this.profileCache.delete(userId);
      
      return true;
    } catch (error) {
      log(`Error resetting user profile: ${error.message}`, "error");
      return false;
    }
  }
  
  /**
   * Get user adaptation profile
   */
  private async getUserProfile(userId: number): Promise<UserAdaptationProfile | null> {
    try {
      // Check cache first
      if (this.profileCache.has(userId)) {
        return this.profileCache.get(userId);
      }
      
      // Get from database
      const result = await db.execute(sql`
        SELECT * FROM user_adaptation_profiles
        WHERE user_id = ${userId}
      `);
      
      if (result.rows && result.rows.length > 0) {
        const profile = result.rows[0];
        
        // Convert from database column names to camelCase
        const formattedProfile = {
          id: profile.id,
          userId: profile.user_id,
          priorityPreferences: profile.priority_preferences,
          categoryPreferences: profile.category_preferences,
          dueDatePreferences: profile.due_date_preferences,
          senderPatterns: profile.sender_patterns,
          subjectPatterns: profile.subject_patterns,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at
        };
        
        // Store in cache
        this.profileCache.set(userId, formattedProfile);
        
        return formattedProfile;
      }
      
      return null;
    } catch (error) {
      log(`Error getting user profile: ${error.message}`, "error");
      return null;
    }
  }
  
  /**
   * Create a new user adaptation profile
   */
  private async createUserProfile(userId: number): Promise<UserAdaptationProfile> {
    try {
      const result = await db.execute(sql`
        INSERT INTO user_adaptation_profiles (
          user_id,
          priority_preferences,
          category_preferences,
          due_date_preferences,
          sender_patterns,
          subject_patterns
        ) VALUES (
          ${userId},
          '{}',
          '{}',
          '{}',
          '{}',
          '{}'
        )
        RETURNING *
      `);
      
      const profile = result.rows[0];
      
      // Convert from database column names to camelCase
      const formattedProfile = {
        id: profile.id,
        userId: profile.user_id,
        priorityPreferences: profile.priority_preferences,
        categoryPreferences: profile.category_preferences,
        dueDatePreferences: profile.due_date_preferences,
        senderPatterns: profile.sender_patterns,
        subjectPatterns: profile.subject_patterns,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at
      };
      
      // Store in cache
      this.profileCache.set(userId, formattedProfile);
      
      return formattedProfile;
    } catch (error) {
      log(`Error creating user profile: ${error.message}`, "error");
      throw error;
    }
  }
  
  /**
   * Update user adaptation profile
   */
  private async updateUserProfile(userId: number, updates: any): Promise<boolean> {
    try {
      // Update in database
      await db.execute(sql`
        UPDATE user_adaptation_profiles
        SET
          priority_preferences = ${JSON.stringify(updates.priorityPreferences)},
          category_preferences = ${JSON.stringify(updates.categoryPreferences)},
          due_date_preferences = ${JSON.stringify(updates.dueDatePreferences)},
          sender_patterns = ${JSON.stringify(updates.senderPatterns)},
          subject_patterns = ${JSON.stringify(updates.subjectPatterns)},
          updated_at = NOW()
        WHERE user_id = ${userId}
      `);
      
      // Update in cache
      const cachedProfile = this.profileCache.get(userId);
      if (cachedProfile) {
        const updatedProfile = {
          ...cachedProfile,
          priorityPreferences: updates.priorityPreferences,
          categoryPreferences: updates.categoryPreferences,
          dueDatePreferences: updates.dueDatePreferences,
          senderPatterns: updates.senderPatterns,
          subjectPatterns: updates.subjectPatterns,
          updatedAt: new Date()
        };
        
        this.profileCache.set(userId, updatedProfile);
      }
      
      return true;
    } catch (error) {
      log(`Error updating user profile: ${error.message}`, "error");
      return false;
    }
  }
  
  /**
   * Store suggested rules in the database
   */
  private async storeSuggestedRules(rules: SuggestedRule[]): Promise<boolean> {
    try {
      for (const rule of rules) {
        await db.execute(sql`
          INSERT INTO suggested_rules (
            user_id,
            rule_type,
            pattern,
            action,
            confidence,
            examples,
            status
          ) VALUES (
            ${rule.userId},
            ${rule.ruleType},
            ${rule.pattern},
            ${rule.action},
            ${rule.confidence},
            ${JSON.stringify(rule.examples)},
            ${rule.status}
          )
        `);
      }
      
      return true;
    } catch (error) {
      log(`Error storing suggested rules: ${error.message}`, "error");
      return false;
    }
  }
  
  /**
   * Analyze user feedback data to extract priority preferences
   */
  private analyzePriorityPreferences(userFeedback: any[], userInteractions: any[]): Record<string, any> {
    // Start with empty preferences object
    const priorityPreferences: Record<string, any> = {};
    
    // Process HITL feedback where priority was changed
    const priorityFeedback = userFeedback.filter(f => 
      f.feedbackType === 'hitl_task_modified' && 
      f.originalTask?.priority !== f.correctedTask?.priority
    );
    
    // Process direct task interactions where priority was changed
    const priorityInteractions = userInteractions.filter(i => 
      i.interactionType === 'task_priority_changed'
    );
    
    // Combine both sources
    const allPriorityChanges = [
      ...priorityFeedback.map(f => ({
        taskId: f.taskId,
        oldPriority: f.originalTask?.priority,
        newPriority: f.correctedTask?.priority,
        emailId: f.relatedEmailId,
        sourceType: 'hitl'
      })),
      ...priorityInteractions.map(i => ({
        taskId: i.taskId,
        oldPriority: i.previousValue?.priority,
        newPriority: i.newValue?.priority,
        emailId: i.sourceEmailId,
        sourceType: 'direct'
      }))
    ];
    
    // Group by patterns (simplified implementation)
    // In a real implementation, this would use NLP/ML to detect patterns
    const patternCounts: Record<string, any> = {};
    
    for (const change of allPriorityChanges) {
      // Skip invalid changes
      if (!change.oldPriority || !change.newPriority) continue;
      
      // Create a pattern key - in practice, this would be more sophisticated
      const patternKey = `${change.oldPriority}_to_${change.newPriority}`;
      
      if (!patternCounts[patternKey]) {
        patternCounts[patternKey] = {
          count: 0,
          examples: [],
          priority: change.newPriority
        };
      }
      
      patternCounts[patternKey].count++;
      
      // Add example if we don't have too many
      if (patternCounts[patternKey].examples.length < 5) {
        patternCounts[patternKey].examples.push({
          taskId: change.taskId,
          emailId: change.emailId,
          sourceType: change.sourceType
        });
      }
    }
    
    // Convert to confidence scores
    for (const [pattern, data] of Object.entries(patternCounts)) {
      const count = data.count;
      // Simple confidence calculation - would be more sophisticated in practice
      const confidence = Math.min(Math.round((count / 3) * 100), 95);
      
      if (confidence >= 60) {
        priorityPreferences[pattern] = {
          priority: data.priority,
          confidence,
          examples: data.examples,
          count
        };
      }
    }
    
    return priorityPreferences;
  }
  
  /**
   * Analyze user feedback data to extract category preferences
   */
  private analyzeCategoryPreferences(userFeedback: any[], userInteractions: any[]): Record<string, any> {
    // Implementation similar to analyzePriorityPreferences
    return {};
  }
  
  /**
   * Analyze user feedback data to extract due date preferences
   */
  private analyzeDueDatePreferences(userFeedback: any[], userInteractions: any[]): Record<string, any> {
    // Implementation similar to analyzePriorityPreferences
    return {};
  }
  
  /**
   * Analyze user feedback data to extract sender patterns
   */
  private analyzeSenderPatterns(userFeedback: any[], userInteractions: any[]): Record<string, any> {
    // Implementation would extract sender domains and email addresses
    // and correlate them with user preferences
    return {};
  }
  
  /**
   * Analyze user feedback data to extract subject patterns
   */
  private analyzeSubjectPatterns(userFeedback: any[], userInteractions: any[]): Record<string, any> {
    // Implementation would use NLP to extract keywords and patterns from subjects
    // and correlate them with user preferences
    return {};
  }
  
  /**
   * Generate rule suggestions based on identified patterns
   */
  private generateRuleSuggestions(
    userId: number,
    priorityPreferences: Record<string, any>,
    categoryPreferences: Record<string, any>,
    dueDatePreferences: Record<string, any>,
    senderPatterns: Record<string, any>,
    subjectPatterns: Record<string, any>
  ): SuggestedRule[] {
    const suggestedRules: SuggestedRule[] = [];
    
    // Generate rules from priority preferences
    for (const [pattern, data] of Object.entries(priorityPreferences)) {
      if (data.confidence >= 80) {
        suggestedRules.push({
          userId,
          ruleType: 'priority',
          pattern,
          action: `set_priority:${data.priority}`,
          confidence: data.confidence,
          examples: data.examples,
          status: 'suggested'
        });
      }
    }
    
    // Generate rules from other preferences (similar pattern)
    
    return suggestedRules;
  }
}

// Import sql function
import { sql } from "drizzle-orm";

// Create and export instance
export const adaptationLearningService = new AdaptationLearningService();