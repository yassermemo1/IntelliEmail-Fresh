import { 
  users, type User, type InsertUser,
  emailAccounts, type EmailAccount, type InsertEmailAccount,
  emails, type Email, type InsertEmail,
  tasks, type Task, type InsertTask,
  aiSettings, type AiSettings, type InsertAiSettings,
  feedback, type Feedback, type InsertFeedback
} from "@shared/schema";
import { db } from "./db";
import { eq, and, like, desc, asc, sql, inArray } from "drizzle-orm";

// IStorage interface for CRUD operations
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Email account operations
  getEmailAccounts(userId: number): Promise<EmailAccount[]>;
  getEmailAccount(id: number): Promise<EmailAccount | undefined>;
  createEmailAccount(account: InsertEmailAccount): Promise<EmailAccount>;
  updateEmailAccount(id: number, data: Partial<InsertEmailAccount>): Promise<EmailAccount>;
  deleteEmailAccount(id: number): Promise<boolean>;
  
  // Email operations
  getEmails(accountId: number, limit?: number, offset?: number): Promise<Email[]>;
  getEmail(id: number): Promise<Email | undefined>;
  createEmail(email: InsertEmail): Promise<Email>;
  updateEmail(id: number, data: Partial<InsertEmail>): Promise<Email>;
  
  // Task operations
  getTasks(userId: number, limit?: number, offset?: number): Promise<Task[]>;
  getTasksByPriority(userId: number, priority: string): Promise<Task[]>;
  getTasksRequiringReview(userId: number): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, data: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: number): Promise<boolean>;
  
  // AI settings operations
  getAiSettings(userId: number): Promise<AiSettings | undefined>;
  updateAiSettings(userId: number, data: Partial<InsertAiSettings>): Promise<AiSettings>;
  
  // Feedback operations
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;
  
  // Search operations 
  searchTasks(userId: number, query: string): Promise<Task[]>;
  searchEmails(userId: number, query: string): Promise<Email[]>;
  
  // Vector search (semantic search)
  semanticSearchTasks(userId: number, embedding: number[], limit?: number): Promise<Task[]>;
  semanticSearchEmails(userId: number, embedding: number[], limit?: number): Promise<Email[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  // Email account operations
  async getEmailAccounts(userId: number): Promise<EmailAccount[]> {
    return db.select().from(emailAccounts).where(eq(emailAccounts.userId, userId));
  }
  
  async getEmailAccount(id: number): Promise<EmailAccount | undefined> {
    const [account] = await db.select().from(emailAccounts).where(eq(emailAccounts.id, id));
    return account || undefined;
  }
  
  async createEmailAccount(account: InsertEmailAccount): Promise<EmailAccount> {
    const [newAccount] = await db.insert(emailAccounts).values(account).returning();
    return newAccount;
  }
  
  async updateEmailAccount(id: number, data: Partial<InsertEmailAccount>): Promise<EmailAccount> {
    const [updatedAccount] = await db
      .update(emailAccounts)
      .set({ ...data })
      .where(eq(emailAccounts.id, id))
      .returning();
    return updatedAccount;
  }
  
  async deleteEmailAccount(id: number): Promise<boolean> {
    const result = await db.delete(emailAccounts).where(eq(emailAccounts.id, id));
    return true;
  }
  
  // Email operations
  async getEmails(accountId: number, limit = 50, offset = 0): Promise<Email[]> {
    return db
      .select()
      .from(emails)
      .where(eq(emails.accountId, accountId))
      .orderBy(desc(emails.timestamp))
      .limit(limit)
      .offset(offset);
  }
  
  async getEmail(id: number): Promise<Email | undefined> {
    const [email] = await db.select().from(emails).where(eq(emails.id, id));
    return email || undefined;
  }
  
  async createEmail(email: any): Promise<Email> {
    const [newEmail] = await db.insert(emails).values(email).returning();
    return newEmail;
  }
  
  async updateEmail(id: number, data: Partial<InsertEmail>): Promise<Email> {
    const [updatedEmail] = await db
      .update(emails)
      .set(data)
      .where(eq(emails.id, id))
      .returning();
    return updatedEmail;
  }
  
  // Task operations
  async getTasks(userId: number, limit = 50, offset = 0): Promise<Task[]> {
    return db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(asc(tasks.dueDate), desc(tasks.createdAt))
      .limit(limit)
      .offset(offset);
  }
  
  async getTasksByPriority(userId: number, priority: string): Promise<Task[]> {
    return db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), sql`tasks.priority::text = ${priority}`))
      .orderBy(asc(tasks.dueDate), desc(tasks.createdAt));
  }
  
  async getTasksRequiringReview(userId: number): Promise<Task[]> {
    return db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.needsReview, true)))
      .orderBy(desc(tasks.createdAt));
  }
  
  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }
  
  async createTask(task: any): Promise<Task> {
    // Create the task in the database
    const [newTask] = await db.insert(tasks).values(task).returning();
    
    // Task embedding will be generated asynchronously via the taskEmbeddingService,
    // but we return immediately to not block the API
    import('./services').then(services => {
      services.taskEmbeddingService.generateEmbeddingForTask(newTask.id)
        .then(success => {
          if (success) {
            console.log(`Successfully generated embedding for new task ${newTask.id}`);
          } else {
            console.error(`Failed to generate embedding for new task ${newTask.id}`);
          }
        })
        .catch(error => {
          console.error(`Error generating embedding for new task ${newTask.id}:`, error);
        });
    });
    
    return newTask;
  }
  
  async updateTask(id: number, data: any): Promise<Task> {
    // Update the task in the database
    const [updatedTask] = await db
      .update(tasks)
      .set({ 
        ...data, 
        updatedAt: new Date(),
        completedAt: data.isCompleted ? new Date() : null
      })
      .where(eq(tasks.id, id))
      .returning();
    
    // Regenerate embedding if title or description is updated
    // as these fields are important for semantic search
    if (data.title || data.description) {
      import('./services').then(services => {
        services.taskEmbeddingService.generateEmbeddingForTask(updatedTask.id)
          .then(success => {
            if (success) {
              console.log(`Successfully regenerated embedding for updated task ${updatedTask.id}`);
            } else {
              console.error(`Failed to regenerate embedding for updated task ${updatedTask.id}`);
            }
          })
          .catch(error => {
            console.error(`Error regenerating embedding for updated task ${updatedTask.id}:`, error);
          });
      });
    }
    
    return updatedTask;
  }
  
  async deleteTask(id: number): Promise<boolean> {
    await db.delete(tasks).where(eq(tasks.id, id));
    return true;
  }
  
  // AI settings operations
  async getAiSettings(userId: number): Promise<AiSettings | undefined> {
    const [settings] = await db.select().from(aiSettings).where(eq(aiSettings.userId, userId));
    return settings || undefined;
  }
  
  async updateAiSettings(userId: number, data: Partial<InsertAiSettings>): Promise<AiSettings> {
    const existingSettings = await this.getAiSettings(userId);
    
    if (existingSettings) {
      const [updatedSettings] = await db
        .update(aiSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(aiSettings.userId, userId))
        .returning();
      return updatedSettings;
    } else {
      const [newSettings] = await db
        .insert(aiSettings)
        .values({ ...data, userId } as InsertAiSettings)
        .returning();
      return newSettings;
    }
  }
  
  // Feedback operations
  async createFeedback(feedbackData: InsertFeedback): Promise<Feedback> {
    const [newFeedback] = await db.insert(feedback).values(feedbackData).returning();
    return newFeedback;
  }
  
  // Search operations
  async searchTasks(userId: number, query: string): Promise<Task[]> {
    return db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          sql`to_tsvector('english', ${tasks.title} || ' ' || COALESCE(${tasks.description}, '')) @@ to_tsquery('english', ${query.replace(/ /g, ' & ')})`
        )
      )
      .orderBy(desc(tasks.createdAt))
      .limit(50);
  }
  
  async searchEmails(userId: number, query: string): Promise<Email[]> {
    // First get user's email accounts
    const userAccounts = await this.getEmailAccounts(userId);
    const accountIds = userAccounts.map(account => account.id);
    
    if (accountIds.length === 0) return [];
    
    return db
      .select()
      .from(emails)
      .where(
        and(
          inArray(emails.accountId, accountIds),
          sql`to_tsvector('english', ${emails.subject} || ' ' || ${emails.body}) @@ to_tsquery('english', ${query.replace(/ /g, ' & ')})`
        )
      )
      .orderBy(desc(emails.timestamp))
      .limit(50);
  }
  
  // Vector search operations
  async semanticSearchTasks(userId: number, embedding: number[], limit = 10): Promise<Task[]> {
    try {
      // Format the vector for cosine similarity search
      const vectorString = `[${embedding.join(',')}]`;
      
      // Use direct SQL for vector search with proper cosine distance operator <=>
      // This matches our HNSW index with vector_cosine_ops
      const result = await db.execute(sql`
        SELECT t.*
        FROM tasks t
        WHERE t.user_id = ${userId}
          AND t.embedding_vector IS NOT NULL
        ORDER BY t.embedding_vector <=> ${vectorString}::vector(768)
        LIMIT ${limit}
      `);
      
      return result.rows;
    } catch (error) {
      console.error("Error in semantic search for tasks:", error);
      return [];
    }
  }
  
  async semanticSearchEmails(userId: number, embedding: number[], limit = 10): Promise<Email[]> {
    try {
      // First get user's email accounts
      const userAccounts = await this.getEmailAccounts(userId);
      const accountIds = userAccounts.map(account => account.id);
      
      if (accountIds.length === 0) return [];
      
      // Format the vector for cosine similarity search
      const vectorString = `[${embedding.join(',')}]`;
      
      // Use direct SQL for vector search with proper cosine distance operator <=>
      // This matches our HNSW index with vector_cosine_ops
      const result = await db.execute(sql`
        SELECT e.*
        FROM emails e
        WHERE e.account_id = ANY(${accountIds})
          AND e.embedding_vector IS NOT NULL
        ORDER BY e.embedding_vector <=> ${vectorString}::vector(768)
        LIMIT ${limit}
      `);
      
      return result.rows;
    } catch (error) {
      console.error("Error in semantic search for emails:", error);
      return [];
    }
  }
}

export const storage = new DatabaseStorage();
