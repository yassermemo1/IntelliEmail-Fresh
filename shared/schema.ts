import { pgTable, text, serial, integer, boolean, jsonb, timestamp, uniqueIndex, pgEnum, foreignKey, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";
// Using pgvector native vector type for embeddings

// Base user schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Email account related schemas
export const accountTypeEnum = pgEnum("account_type", ["gmail", "exchange"]);
export const authMethodEnum = pgEnum("auth_method", ["app_password", "oauth", "basic"]);

export const emailAccounts = pgTable("email_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accountType: accountTypeEnum("account_type").notNull(),
  authMethod: authMethodEnum("auth_method").notNull(),
  emailAddress: text("email_address").notNull(),
  credentials: jsonb("credentials").notNull(), // Store encrypted credentials including tokens for OAuth
  displayName: text("display_name"), // User-friendly name for the account
  serverSettings: jsonb("server_settings"), // Store server settings, especially for Exchange/EWS accounts
  lastSynced: timestamp("last_synced"),
  isActive: boolean("is_active").default(true).notNull(),
  syncEnabled: boolean("sync_enabled").default(true).notNull(), // Allow users to disable sync for specific accounts
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEmailAccountSchema = createInsertSchema(emailAccounts).omit({
  id: true,
  lastSynced: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmailAccount = z.infer<typeof insertEmailAccountSchema>;
export type EmailAccount = typeof emailAccounts.$inferSelect;

// Email schema
export const emails = pgTable("emails", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => emailAccounts.id).notNull(),
  messageId: text("message_id").notNull(),
  sender: text("sender").notNull(),
  recipients: text("recipients").array().notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  bodyHtml: text("body_html"),
  threadId: text("thread_id"),
  timestamp: timestamp("timestamp").notNull(),
  processed: boolean("processed").default(false).notNull(),
  is_cleaned: boolean("is_cleaned").default(false).notNull(),
  is_rag_processed: boolean("is_rag_processed").default(false).notNull(),
  metadata: jsonb("metadata"),
  isRead: boolean("is_read").default(false).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  // AI processing fields - using text for schema definition, proper pgvector handled in migrations
  embeddingVector: text("embedding_vector"),
  aiExtractedSummary: text("ai_extracted_summary"),
  aiSuggestedTasksJson: jsonb("ai_suggested_tasks_json"),
  aiExtractedDeadlinesJson: jsonb("ai_extracted_deadlines_json"),
  aiExtractedEntitiesJson: jsonb("ai_extracted_entities_json"),
  aiSentiment: text("ai_sentiment"),
  aiSuggestedCategory: text("ai_suggested_category"),
  aiProcessingConfidence: integer("ai_processing_confidence"),
  aiClassificationDetailsJson: jsonb("ai_classification_details_json"),
  embeddingGeneratedAt: timestamp("embedding_generated_at"),
  aiFeaturesExtractedAt: timestamp("ai_features_extracted_at"),
  tasksGeneratedAt: timestamp("tasks_generated_at"),
  // Full-text search vector
  searchVector: text("search_vector"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    accountMessageIdIdx: uniqueIndex("account_message_id_idx").on(table.accountId, table.messageId),
  };
});

export const insertEmailSchema = createInsertSchema(emails, {
  isRead: z.boolean().default(false),
  isArchived: z.boolean().default(false),
  processed: z.boolean().default(false),
}).omit({
  id: true,
  embeddingVector: true,
  embeddingGeneratedAt: true,
  aiFeaturesExtractedAt: true,
  tasksGeneratedAt: true,
  createdAt: true,
  updatedAt: true
});

export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emails.$inferSelect;

// Priority enum
export const priorityEnum = pgEnum("priority", ["high", "medium", "low"]);

// Task category enum
export const taskCategoryEnum = pgEnum("task_category", [
  "FollowUp_ResponseNeeded",
  "Report_Generation_Submission",
  "Meeting_Coordination_Prep",
  "Review_Approval_Feedback",
  "Research_Investigation_Analysis",
  "Planning_Strategy_Development",
  "Client_Vendor_Communication",
  "Internal_Project_Task",
  "Administrative_Logistics",
  "Urgent_Action_Required",
  "Information_To_Digest_Review",
  "Personal_Reminder_Appt"
]);

// Tasks schema with enhanced fields for reminders and rich details
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  emailId: integer("email_id").references(() => emails.id),
  title: text("title").notNull(),
  description: text("description"),
  detailedDescription: text("detailed_description"), // Enhanced description with more context
  sourceSnippet: text("source_snippet"), // Original text from email that suggested this task
  dueDate: timestamp("due_date"),
  priority: priorityEnum("priority").default("medium").notNull(),
  category: taskCategoryEnum("category"), // Using the new category enum
  actorsInvolved: text("actors_involved").array(), // People/departments related to the task
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  estimatedEffortMinutes: integer("estimated_effort_minutes"), // Time estimation for the task
  
  // AI generation fields
  aiGenerated: boolean("ai_generated").default(false).notNull(),
  aiConfidence: integer("ai_confidence"),
  aiModel: text("ai_model"),
  originalAiSuggestionJson: jsonb("original_ai_suggestion_json"), // Store the entire AI task suggestion
  needsReview: boolean("needs_review").default(false).notNull(),
  
  // Reminder and recurrence fields
  isRecurringSuggestion: boolean("is_recurring_suggestion").default(false),
  aiSuggestedReminderText: text("ai_suggested_reminder_text"),
  reminderSettingsJson: jsonb("reminder_settings_json"), // User-defined reminder settings
  nextReminderAt: timestamp("next_reminder_at"), // When to send the next reminder
  
  // Entity and embedding information
  entities: jsonb("entities"),
  embeddingVector: text("embedding_vector"),
  
  // Full-text search vector
  searchVector: text("search_vector"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTaskSchema = createInsertSchema(tasks, {
  isCompleted: z.boolean().default(false),
  aiGenerated: z.boolean().default(false),
  needsReview: z.boolean().default(false),
  isRecurringSuggestion: z.boolean().default(false),
  actorsInvolved: z.array(z.string()).optional(),
  category: z.enum(taskCategoryEnum.enumValues).optional(),
}).omit({
  id: true, 
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  embeddingVector: true,
  searchVector: true,
  nextReminderAt: true,
});

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// AI Settings
export const llmProviderEnum = pgEnum("llm_provider", ["ollama", "openai", "anthropic", "perplexity"]);

// AI Models table to store available models
export const aiModels = pgTable("ai_models", {
  id: serial("id").primaryKey(),
  provider: llmProviderEnum("provider").notNull(),
  modelId: text("model_id").notNull(), // e.g., "gpt-4o", "llama3", "claude-3-opus"
  displayName: text("display_name").notNull(), // Friendly name to display in UI
  description: text("description"),
  capabilities: jsonb("capabilities").default({}).notNull(), // What this model is good at
  contextLength: integer("context_length"), // Max tokens the model can handle
  isEmbeddingModel: boolean("is_embedding_model").default(false).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAiModelSchema = createInsertSchema(aiModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiModel = z.infer<typeof insertAiModelSchema>;
export type AiModel = typeof aiModels.$inferSelect;

// Enhanced AI Settings
export const aiSettings = pgTable("ai_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  selectedProvider: llmProviderEnum("selected_provider").default("openai").notNull(),
  selectedModelId: integer("selected_model_id").references(() => aiModels.id),
  embeddingModelId: integer("embedding_model_id").references(() => aiModels.id),
  // Store API keys as plain text (as requested)
  openaiApiKey: text("openai_api_key"),
  anthropicApiKey: text("anthropic_api_key"),
  perplexityApiKey: text("perplexity_api_key"),
  // Ollama settings
  ollamaEndpoint: text("ollama_endpoint").default("http://localhost:11434"),
  // Other settings
  confidenceThreshold: integer("confidence_threshold").default(70).notNull(),
  autoExtractTasks: boolean("auto_extract_tasks").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAiSettingsSchema = createInsertSchema(aiSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiSettings = z.infer<typeof insertAiSettingsSchema>;
export type AiSettings = typeof aiSettings.$inferSelect;

// Comprehensive Feedback for AI learning
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  taskId: integer("task_id").references(() => tasks.id),
  relatedEmailId: integer("related_email_id").references(() => emails.id),
  feedbackType: text("feedback_type").notNull(), // confirmed, edited, rejected, hitl_task_approved, hitl_task_rejected, hitl_task_modified
  sourceType: text("source_type"), // hitl_review, direct_edit
  originalTask: jsonb("original_task"), // ai_original_output_json
  correctedTask: jsonb("corrected_task"), // user_correction_json
  metadata: jsonb("metadata").default({}), // additional context about the feedback
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  timestamp: true,
});

// User task interactions for detailed activity tracking
export const userTaskInteractions = pgTable("user_task_interactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  interactionType: text("interaction_type").notNull(), // task_priority_changed, task_due_date_changed, task_completed, task_deleted, etc.
  previousValue: jsonb("previous_value_json"),
  newValue: jsonb("new_value_json"),
  sourceEmailId: integer("source_email_id").references(() => emails.id),
  taskWasAiGenerated: boolean("task_was_ai_generated").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserTaskInteractionSchema = createInsertSchema(userTaskInteractions).omit({
  id: true,
  createdAt: true,
});

export type InsertUserTaskInteraction = z.infer<typeof insertUserTaskInteractionSchema>;
export type UserTaskInteraction = typeof userTaskInteractions.$inferSelect;

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

// Email semantic links for storing relationships between emails
export const linkTypeEnum = pgEnum("link_type", ["thread", "subject", "semantic"]);

export const emailSemanticLinks = pgTable("email_semantic_links", {
  emailIdA: integer("email_id_a").references(() => emails.id).notNull(),
  emailIdB: integer("email_id_b").references(() => emails.id).notNull(),
  similarityScore: integer("similarity_score").notNull(), // Store as integer (0-100) for better indexing
  linkType: linkTypeEnum("link_type").default("semantic").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    // Ensure that we don't have duplicate pairs (a->b and b->a)
    // Convention: emailIdA is always the smaller ID
    pkIdx: uniqueIndex("email_semantic_links_pk_idx").on(table.emailIdA, table.emailIdB),
    // Index for fast lookups by emailIdA
    emailAIdx: uniqueIndex("email_a_idx").on(table.emailIdA),
    // Index for fast lookups by emailIdB
    emailBIdx: uniqueIndex("email_b_idx").on(table.emailIdB)
  };
});

export const insertEmailSemanticLinkSchema = createInsertSchema(emailSemanticLinks).omit({
  createdAt: true,
});

export type InsertEmailSemanticLink = z.infer<typeof insertEmailSemanticLinkSchema>;
export type EmailSemanticLink = typeof emailSemanticLinks.$inferSelect;
