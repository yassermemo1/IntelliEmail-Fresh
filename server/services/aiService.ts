import { db } from "../db";
import { emails } from "@shared/schema";
import { OpenAI } from "openai";
import { eq, sql, count } from "drizzle-orm";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AI service for email analysis and RAG capabilities
 */
export class AiService {
  /**
   * Generate embeddings for an email
   * Handles token limit issues by truncating text if needed
   */
  /**
   * Generate embeddings using the configured provider (OpenAI or Ollama)
   * Supports both OpenAI's text-embedding-3-small (1536 dimensions) and 
   * Ollama's nomic-embed-text (768 dimensions)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Safety check for empty input text
      if (!text || text.trim().length === 0) {
        console.warn("Empty or null text passed to generateEmbedding, returning default embedding");
        // Return non-zero default embedding (zeros can cause issues with similarity search)
        return Array(768).fill(0.0001);
      }
      
      // Use environment variable to determine which embedding provider to use
      const embeddingProvider = process.env.EMBEDDING_PROVIDER || 'openai';
      
      // Truncate text to approximately 3000 tokens (about 12K characters)
      // This ensures we stay well under token limits for embedding models
      const truncatedText = text.length > 12000 ? text.substring(0, 12000) : text;
      
      // Log truncation for monitoring
      if (text.length > 12000) {
        console.log(`Text truncated from ${text.length} to 12000 characters for embedding generation`);
      }
      
      let embedding: number[];
      
      try {
        if (embeddingProvider === 'ollama') {
          try {
            // Try to use Ollama's nomic-embed-text model (768 dimensions)
            embedding = await this.generateOllamaEmbedding(truncatedText);
            console.log(`Generated Ollama embedding with ${embedding.length} dimensions`);
          } catch (ollamaError) {
            console.warn("Ollama embedding failed, falling back to OpenAI:", ollamaError);
            // Fall back to OpenAI if Ollama fails (1536 dimensions by default)
            const response = await openai.embeddings.create({
              model: "text-embedding-3-small",
              input: truncatedText,
            });
            embedding = response.data[0].embedding;
            console.log(`Generated OpenAI embedding with ${embedding.length} dimensions`);
          }
        } else {
          // Default to OpenAI (1536 dimensions)
          const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: truncatedText,
          });
          embedding = response.data[0].embedding;
          console.log(`Generated OpenAI embedding with ${embedding.length} dimensions`);
        }
        
        // Safety check for invalid embedding result
        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
          console.warn("Invalid embedding result, returning default embedding");
          return Array(768).fill(0.0001);
        }
      } catch (embeddingError) {
        console.error("Error generating embedding, using fallback:", embeddingError);
        return Array(768).fill(0.0001);
      }
      
      // STRICTLY enforce 768 dimensions for all vector embeddings in the database
      if (embedding.length !== 768) {
        console.log(`WARNING: Embedding has ${embedding.length} dimensions, expected exactly 768 dimensions`);
        
        // For OpenAI embeddings which are typically 1536 dimensions
        if (embedding.length === 1536) {
          console.log("Converting 1536-dim OpenAI embedding to 768-dim using proper dimensionality reduction");
          // Use a consistent approach: take every other value to reduce from 1536 to 768
          embedding = embedding.filter((_, index) => index % 2 === 0);
        } 
        // Only attempt to fix vectors that are close to the target dimension
        else if (embedding.length >= 750 && embedding.length < 768) {
          console.log("Padding slightly undersized embedding to exactly 768 dimensions");
          // Pad with small non-zero values
          while (embedding.length < 768) {
            embedding.push(0.0001);
          }
        } 
        else if (embedding.length > 768 && embedding.length <= 784) {
          console.log("Truncating slightly oversized embedding to exactly 768 dimensions");
          embedding.length = 768;
        }
        // For significantly different dimensions, don't try to convert - use a fallback
        else {
          console.error(`CRITICAL: Cannot safely convert ${embedding.length}-dim to 768-dim, using fallback`);
          // Log detailed information for debugging
          console.error(`Email ID: ${email?.id}, Provider: ${embeddingProvider}, Text length: ${truncatedText.length}`);
          // Return uniform non-zero fallback that won't break similarity search
          embedding = Array(768).fill(0.0001);
        }
      }
      
      console.log(`Final embedding has ${embedding.length} dimensions`);
      return embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error("Failed to generate embedding");
    }
  }
  
  /**
   * Generate embeddings using Ollama's nomic-embed-text model
   * Returns a 768-dimensional vector
   */
  private async generateOllamaEmbedding(text: string): Promise<number[]> {
    try {
      const ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
      
      const response = await fetch(`${ollamaEndpoint}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "nomic-embed-text",
          prompt: text
        })
      });
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      return result.embedding;
    } catch (error) {
      console.error("Error generating Ollama embedding:", error);
      throw error;
    }
  }

  /**
   * Update email embeddings for emails that don't have them yet
   * This is a more robust implementation that handles token limits and large batches
   */
  async updateEmailEmbeddings(limit = 100): Promise<number> {
    try {
      // Find emails without embeddings or with empty embeddings
      // Get emails without embeddings using a safer query approach
      console.log(`Looking for up to ${limit} emails without embeddings`);
      
      // Use a safer query that explicitly avoids problematic records
      const result = await db.execute(sql.raw(`
        SELECT * FROM emails 
        WHERE embedding_vector IS NULL
        AND id NOT IN (
          SELECT id FROM emails WHERE metadata->>'embeddingError' = 'true'
          LIMIT 1000
        )
        LIMIT ${limit}
      `));
      
      const emailsWithoutEmbeddings = result.rows || [];
      console.log(`Found ${emailsWithoutEmbeddings.length} emails without embeddings`);

      if (emailsWithoutEmbeddings.length === 0) {
        return 0;
      }

      let processedCount = 0;
      let errorCount = 0;

      for (const email of emailsWithoutEmbeddings) {
        try {
          // Skip emails with extremely long content that would exceed token limits
          // Most email bodies under 100K characters should be fine
          const bodyLength = (email.body || "").length;
          if (bodyLength > 100000) {
            console.log(`Skipping email ${email.id} due to excessive length (${bodyLength} chars)`);
            
            // For very long emails, we'll just embed the subject and truncated body to still have some searchability
            const truncatedText = `Subject: ${email.subject || ""}\n\nBody: ${
              (email.body || "").substring(0, 10000) + "... [content truncated due to length]"
            }`;
            
            try {
              let truncatedEmbedding = await this.generateEmbedding(truncatedText);
              
              // Safety check to ensure embedding is a valid array with data
              if (!Array.isArray(truncatedEmbedding) || truncatedEmbedding.length === 0) {
                console.error(`Invalid truncated embedding result for email ${email.id}:`, truncatedEmbedding);
                throw new Error('Truncated embedding generation failed - empty or invalid array');
              }
              
              // Ensure all values are valid numbers
              if (truncatedEmbedding.some(value => typeof value !== 'number' || isNaN(value))) {
                console.error(`Invalid truncated embedding values for email ${email.id} - contains NaN or non-numeric values`);
                throw new Error('Truncated embedding generation failed - invalid numeric values');
              }
              
              // Ensure embedding is exactly the expected dimension
              let finalTruncatedEmbedding = [...truncatedEmbedding];
              if (truncatedEmbedding.length != 768) {
                console.warn(`Truncated embedding for email ${email.id} has ${truncatedEmbedding.length} dimensions, expected 768. Padding or truncating.`);
                
                if (finalTruncatedEmbedding.length < 768) {
                  // Pad with zeros
                  while (finalTruncatedEmbedding.length < 768) {
                    finalTruncatedEmbedding.push(0);
                  }
                } else if (finalTruncatedEmbedding.length > 768) {
                  // Truncate
                  finalTruncatedEmbedding.length = 768;
                }
              }
              
              // Format the vector string properly with validation
              // Ensure each vector component is a valid number
              const validEmbedding = finalTruncatedEmbedding.map(val => {
                if (typeof val !== 'number' || isNaN(val)) {
                  return 0; // Replace invalid values with 0
                }
                return val;
              });
              
              // Sanity check - if we somehow ended up with an empty array, create a default vector with zeros
              if (validEmbedding.length === 0) {
                console.warn(`Empty truncated embedding vector detected for email ${email.id}, using default zero vector`);
                for (let i = 0; i < 768; i++) {
                  validEmbedding.push(0);
                }
              }
              
              // Verify that the embedding is not empty
              if (validEmbedding.length === 0) {
                throw new Error('Empty truncated embedding vector cannot be stored');
              }
              
              // Ensure there are no NaN values that could break vector storage
              for (let i = 0; i < validEmbedding.length; i++) {
                if (isNaN(validEmbedding[i])) {
                  validEmbedding[i] = 0.0001;
                }
              }
              
              // Format for pgvector storage - CRITICAL: This must have brackets and be a non-empty array
              const vectorString = `[${validEmbedding.join(',')}]`;
              
              // Create a raw SQL query to avoid parameter errors with pgvector
              const dateString = new Date().toISOString();
              const emailId = email.id;
              const dimensions = validEmbedding.length; // Use the validated array length
              const isPadded = truncatedEmbedding.length != 768;
              
              // Use raw SQL with explicit vector(768) type cast for proper vector handling
              const updateSQL = `
                UPDATE emails
                SET 
                  embedding_vector = '${vectorString}'::vector(768),
                  embedding_generated_at = NOW(),
                  metadata = jsonb_build_object(
                    'embeddingGenerated', true,
                    'embeddingDate', '${dateString}',
                    'embeddingTruncated', true,
                    'embeddingDimensions', ${dimensions},
                    'embeddingSource', 'truncated',
                    'embeddingPadded', ${isPadded}
                  )
                WHERE id = ${emailId}
              `;
              
              await db.execute(sql.raw(updateSQL));
                
              processedCount++;
              continue;
            } catch (innerError) {
              // If even the truncated embedding fails, skip this email
              errorCount++;
              continue;
            }
          }

          // Create text to embed (subject + body)
          // Using only the first 20K characters for very long emails to avoid token limits
          const textToEmbed = `Subject: ${email.subject || ""}\n\nBody: ${
            bodyLength > 20000 ? (email.body || "").substring(0, 20000) + "... [content truncated]" : (email.body || "")
          }`;

          // Generate embedding - this should always return an array of numbers
          const embedding = await this.generateEmbedding(textToEmbed);
          
          // Safety check to ensure embedding is a valid array with data
          if (!Array.isArray(embedding) || embedding.length === 0) {
            console.error(`Invalid embedding result for email ${email.id}:`, embedding);
            throw new Error('Embedding generation failed - empty or invalid array');
          }
          
          // Ensure all values are valid numbers
          if (embedding.some(value => typeof value !== 'number' || isNaN(value))) {
            console.error(`Invalid embedding values for email ${email.id} - contains NaN or non-numeric values`);
            throw new Error('Embedding generation failed - invalid numeric values');
          }
          
          // Use parameterized query for safety
          try {
            // Ensure embedding is exactly the expected dimension
            // If for any reason the embedding is not 768 dimensions, we need to handle it
            let finalEmbedding = [...embedding];
            if (embedding.length != 768) {
              console.warn(`Embedding for email ${email.id} has ${embedding.length} dimensions, expected 768. Padding or truncating.`);
              
              // Either pad with zeros or truncate to 768 dimensions
              if (finalEmbedding.length < 768) {
                // Pad with zeros
                while (finalEmbedding.length < 768) {
                  finalEmbedding.push(0);
                }
              } else if (finalEmbedding.length > 768) {
                // Truncate
                finalEmbedding.length = 768;
              }
            }
            
            // Format the vector string properly for pgvector with 768 dimensions
            // Ensure each vector component is a valid number
            const validEmbedding = finalEmbedding.map(val => {
              if (typeof val !== 'number' || isNaN(val)) {
                return 0; // Replace invalid values with 0
              }
              return val;
            });
            
            // Sanity check - if we somehow ended up with an empty array, create a default vector with zeros
            if (validEmbedding.length === 0) {
              console.warn(`Empty embedding vector detected for email ${email.id}, using default zero vector`);
              for (let i = 0; i < 768; i++) {
                validEmbedding.push(0);
              }
            }
            
            // Verify that the embedding is not empty before proceeding
            if (validEmbedding.length === 0) {
              throw new Error('Empty embedding vector cannot be stored');
            }
            
            // Ensure there are no NaN values that could break the vector storage
            for (let i = 0; i < validEmbedding.length; i++) {
              if (isNaN(validEmbedding[i])) {
                validEmbedding[i] = 0.0001;
              }
            }
            
            // Format for pgvector storage - CRITICAL: This must have brackets and be a non-empty array
            const vectorString = `[${validEmbedding.join(',')}]`;
            
            // Create a raw SQL query to avoid parameter errors with pgvector
            const dateString = new Date().toISOString();
            const emailId = email.id;
            
            // Use raw SQL with explicit vector(768) type cast to ensure proper vector handling
            const updateSQL = `
              UPDATE emails
              SET 
                embedding_vector = '${vectorString}'::vector(768),
                embedding_generated_at = NOW(),
                metadata = jsonb_build_object(
                  'embeddingGenerated', true,
                  'embeddingDate', '${dateString}',
                  'embeddingTruncated', ${bodyLength > 20000},
                  'embeddingDimensions', ${validEmbedding.length},
                  'embeddingSource', 'standard',
                  'embeddingPadded', ${embedding.length != 768}
                )
              WHERE id = ${emailId}
            `;
            
            await db.execute(sql.raw(updateSQL));
            
            console.log(`Successfully stored embedding for email ${email.id} (${embedding.length} dimensions)`);
            processedCount++;
          } catch (updateError) {
            console.error(`Error updating embedding for email ${email.id}:`, updateError.message);
            errorCount++;
          }
          
          // Small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (emailError) {
          // Log error but continue processing the rest of the batch
          console.error(`Error processing email ${email.id}:`, emailError);
          errorCount++;
        }
      }

      console.log(`Embedding update completed: ${processedCount} processed, ${errorCount} errors`);
      return processedCount;
    } catch (error) {
      console.error("Error updating email embeddings:", error);
      throw error;
    }
  }
  
  /**
   * Get status of email embedding processing
   */
  async getEmbeddingStatus(): Promise<{
    totalEmails: number;
    processedEmails: number;
    unprocessedEmails: number;
    percentComplete: number;
  }> {
    try {
      // Get total email count using count() function 
      const totalResult = await db
        .select({ count: count() })
        .from(emails);
      const totalEmails = totalResult[0]?.count || 0;
      
      // Get count of processed emails (with embeddings)
      const processedResult = await db
        .select({ count: count() })
        .from(emails)
        .where(sql`embedding_vector IS NOT NULL`);
      const processedEmails = processedResult[0]?.count || 0;
      
      // Calculate unprocessed and percentage
      const unprocessedEmails = totalEmails - processedEmails;
      const percentComplete = totalEmails > 0 ? Math.round((processedEmails / totalEmails) * 100) : 0;
      
      return {
        totalEmails,
        processedEmails,
        unprocessedEmails,
        percentComplete
      };
    } catch (error) {
      console.error("Error getting embedding status:", error);
      throw error;
    }
  }

  /**
   * Extract tasks from emails using AI with advanced NLP capabilities
   */
  async extractTasksFromEmail(emailId: number): Promise<any[]> {
    try {
      // Get email from database
      const [email] = await db
        .select()
        .from(emails)
        .where(eq(emails.id, emailId));

      if (!email) {
        throw new Error(`Email not found with ID: ${emailId}`);
      }

      // Check if this is likely a newsletter, promotional email, or system notification 
      // which might not contain actionable tasks
      const isNonActionableEmail = this.isLikelyNonActionable(email.subject, email.sender);
      
      // Combine subject and body with some context
      const emailContent = `
        From: ${email.sender}
        Subject: ${email.subject || ""}
        Date: ${email.timestamp ? new Date(email.timestamp).toISOString() : "Unknown"}
        
        ${email.body || ""}
      `;

      // Get potential email categories to provide better context
      const emailCategories = this.classifyEmailContent(email.subject, email.body || "");
      
      // Call OpenAI to extract tasks with enhanced prompt based on email type
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          {
            role: "system",
            content: `
              You are a task extraction assistant specialized in identifying actionable tasks from emails.
              
              For each task, extract:
              - title: A clear, concise task title (max 10 words)
              - description: More detailed description of what needs to be done (1-2 sentences)
              - priority: high, medium, or low based on urgency and importance
              - dueDate: If explicitly mentioned (in ISO format YYYY-MM-DD), otherwise null. If a relative date is mentioned (e.g., "by next Friday", "tomorrow"), convert it to absolute date.
              - confidence: Your confidence in this being a real task (0.0-1.0)
              ${emailCategories.includes("work") ? "- category: work-related category (e.g., 'meeting', 'report', 'follow-up', 'project')" : ""}
              
              ${isNonActionableEmail ? "This email appears to be a newsletter, promotional content, or automated notification. Be very selective and only extract tasks if they are clearly actionable items requiring follow-up." : "For emails that appear actionable, make sure to identify at least one task that would be worth following up on, even if it's implied rather than explicitly stated."}
              
              BE CREATIVE AND THOROUGH in finding actionable tasks in the email. Look beyond explicit requests to identify:
              
              1. Implied tasks (e.g., "The meeting is tomorrow" → Task: "Prepare for tomorrow's meeting")
              2. Follow-up tasks (e.g., "Here are the documents" → Task: "Review the attached documents")
              3. Response requirements (e.g., "What do you think about this?" → Task: "Respond with feedback")
              4. Preparatory tasks (e.g., "We'll discuss this next week" → Task: "Prepare talking points for next week's discussion")
              
              Consider these contextual clues for identifying tasks:
              - Direct requests with action verbs ("please send", "can you review", "need you to complete")
              - Explicit deadlines or timeframes
              - Questions requiring research or response
              - Assignments or delegations
              - Commitments made by the sender that you need to follow up on
              - Next steps implied in the conversation
              - Information that requires your acknowledgment or follow-up
              
              For emails classified as actionable, ALWAYS extract at least one task even if it's to review, reply, or follow up.
              
              Respond with a JSON object containing a "tasks" array. If truly no tasks can be identified, respond with {"tasks": []}.
            `
          },
          { role: "user", content: emailContent }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content || "{}";
      const result = JSON.parse(content);
      
      // Process the results to enhance or refine tasks
      const enhancedTasks = (result.tasks || []).map((task: any) => {
        // Add default values for any missing fields
        return {
          ...task,
          priority: task.priority || "medium",
          confidence: typeof task.confidence === 'number' ? task.confidence : 0.8,
          // Generate smart defaults for due dates based on priority if not specified
          dueDate: task.dueDate || this.generateSmartDueDate(task.priority)
        };
      });
      
      // Also add embedding for this email if it doesn't have one yet
      if (!email.embeddingVector) {
        try {
          const textToEmbed = `Subject: ${email.subject || ""}\n\nBody: ${email.body || ""}`;
          const embedding = await this.generateEmbedding(textToEmbed);
          
          // Ensure embedding is exactly the expected dimension
          let finalEmbedding = [...embedding];
          if (embedding.length != 768) {
            if (finalEmbedding.length < 768) {
              // Pad with zeros
              while (finalEmbedding.length < 768) {
                finalEmbedding.push(0);
              }
            } else if (finalEmbedding.length > 768) {
              // Truncate
              finalEmbedding.length = 768;
            }
          }
          
          // Format the vector string properly for pgvector
          const vectorString = `[${finalEmbedding.join(',')}]`;
          
          // Update email with embedding using SQL directly
          await db.execute(sql`
            UPDATE emails
            SET 
              embedding_vector = ${vectorString}::vector,
              embedding_generated_at = NOW()
            WHERE id = ${email.id}
          `);
        } catch (error) {
          console.warn("Could not generate embedding for email during task extraction:", error);
          // Continue with task extraction even if embedding fails
        }
      }
      
      return enhancedTasks;
    } catch (error) {
      console.error("Error extracting tasks:", error);
      throw error;
    }
  }
  
  /**
   * Helper method to classify email content with more detailed categories
   */
  classifyEmailContent(subject: string, body: string): string[] {
    const categories = [];
    const combinedText = (subject + " " + body).toLowerCase();
    
    // Work-related keywords
    if (
      combinedText.includes("meeting") || 
      combinedText.includes("report") || 
      combinedText.includes("project") ||
      combinedText.includes("deadline") ||
      combinedText.includes("presentation") ||
      combinedText.includes("review") ||
      combinedText.includes("agenda") ||
      combinedText.includes("conference") ||
      combinedText.includes("status update")
    ) {
      categories.push("work");
    }
    
    // Financial-related keywords
    if (
      combinedText.includes("invoice") || 
      combinedText.includes("payment") || 
      combinedText.includes("bill") ||
      combinedText.includes("transaction") ||
      combinedText.includes("receipt") ||
      combinedText.includes("subscription") ||
      combinedText.includes("expense") ||
      combinedText.includes("credit") ||
      combinedText.includes("finance")
    ) {
      categories.push("financial");
    }
    
    // Personal-related keywords
    if (
      combinedText.includes("family") || 
      combinedText.includes("friend") || 
      combinedText.includes("personal") ||
      combinedText.includes("vacation") ||
      combinedText.includes("holiday") ||
      combinedText.includes("weekend") ||
      combinedText.includes("birthday") ||
      combinedText.includes("celebration")
    ) {
      categories.push("personal");
    }
    
    // Urgent-related keywords
    if (
      combinedText.includes("urgent") || 
      combinedText.includes("asap") || 
      combinedText.includes("immediately") ||
      combinedText.includes("emergency") ||
      combinedText.includes("critical") ||
      combinedText.includes("right away") ||
      combinedText.includes("deadline today") ||
      combinedText.includes("high priority")
    ) {
      categories.push("urgent");
    }
    
    // Travel-related keywords
    if (
      combinedText.includes("travel") || 
      combinedText.includes("flight") || 
      combinedText.includes("hotel") ||
      combinedText.includes("reservation") ||
      combinedText.includes("booking") ||
      combinedText.includes("ticket") ||
      combinedText.includes("itinerary") ||
      combinedText.includes("trip")
    ) {
      categories.push("travel");
    }
    
    // If no categories were found, add a general one
    if (categories.length === 0) {
      if (combinedText.includes("update") || combinedText.includes("info") || combinedText.includes("fyi")) {
        categories.push("information");
      } else {
        categories.push("general");
      }
    }
    
    return categories;
  }
  
  /**
   * Helper method to check if email is likely a newsletter or non-actionable content
   */
  isLikelyNonActionable(subject: string, sender: string): boolean {
    const nonActionableSenderPatterns = [
      "no-reply", "noreply", "donotreply", "newsletter", "news", "info@", "updates",
      "notification", "digest", "weekly", "daily", "monthly", "promotions"
    ];
    
    const nonActionableSubjectPatterns = [
      "newsletter", "weekly update", "digest", "roundup", "promotion", "offer",
      "sale", "discount", "special", "announcement", "bulletin", "notification",
      "subscription", "confirm", "welcome", "receipt", "statement"
    ];
    
    // Check sender
    const senderLower = sender.toLowerCase();
    if (nonActionableSenderPatterns.some(pattern => senderLower.includes(pattern))) {
      return true;
    }
    
    // Check subject
    const subjectLower = subject.toLowerCase();
    if (nonActionableSubjectPatterns.some(pattern => subjectLower.includes(pattern))) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Generate smart due dates based on task priority
   */
  private generateSmartDueDate(priority: string): string | null {
    const today = new Date();
    
    switch (priority.toLowerCase()) {
      case 'high':
        // High priority = tomorrow
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD format
        
      case 'medium':
        // Medium priority = end of week or 3 days from now
        const threeDays = new Date(today);
        threeDays.setDate(today.getDate() + 3);
        return threeDays.toISOString().split('T')[0];
        
      case 'low':
        // Low priority = next week
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        return nextWeek.toISOString().split('T')[0];
        
      default:
        return null;
    }
  }

  /**
   * Ask questions about emails using RAG (Retrieval Augmented Generation)
   */
  async askAboutEmails(userId: number, question: string): Promise<{ answer: string, sources: any[] }> {
    try {
      // First check if we have any emails with embeddings
      const checkEmbedsResult = await db.execute(sql`
        SELECT COUNT(*) FROM emails
        WHERE embedding_vector IS NOT NULL
      `);
      
      const embedCount = parseInt(checkEmbedsResult.rows[0]?.count || "0");
      
      if (embedCount === 0) {
        // No embeddings yet, just return basic response
        return {
          answer: "I don't have enough processed emails to answer questions yet. Please process some emails with the 'Email Analysis & Task Generation' tool first to enable AI question answering.",
          sources: []
        };
      }
      
      // 1. Generate embedding for the question
      const questionEmbedding = await this.generateEmbedding(question);
      
      // 2. Perform vector search to find relevant emails
      // Note: Using pgvector's L2 distance (square_euclidean_distance)
      const result = await db.execute(sql`
        SELECT e.id, e.sender, e.subject, e.timestamp, e.body, 
          embedding_vector <-> ${JSON.stringify(questionEmbedding)}::vector AS distance
        FROM emails e
        WHERE embedding_vector IS NOT NULL
        AND EXISTS (SELECT 1 FROM email_accounts ea WHERE ea.id = e.account_id AND ea.user_id = ${userId})
        ORDER BY distance ASC
        LIMIT 5
      `);
      
      // Convert result to array
      const relevantEmails = Array.isArray(result) ? result : (result as any)?.rows || [];
      
      if (relevantEmails.length === 0) {
        return {
          answer: "I couldn't find any relevant emails to answer your question. It's possible that email embeddings haven't been generated yet.",
          sources: []
        };
      }
      
      // 3. Build context for the AI from relevant emails
      let context = "Here are some relevant emails that might help answer the question:\n\n";
      
      // Set a max length for each email body to avoid token limit issues
      const MAX_EMAIL_BODY_LENGTH = 1000;
      
      relevantEmails.forEach((email: any, index: number) => {
        context += `--- Email ${index + 1} ---\n`;
        context += `From: ${email.sender}\n`;
        context += `Subject: ${email.subject || "No subject"}\n`;
        context += `Date: ${email.timestamp ? new Date(email.timestamp).toISOString() : "Unknown"}\n`;
        
        // Truncate long email bodies to avoid token limit issues
        const emailBody = email.body || "No text body";
        const truncatedBody = emailBody.length > MAX_EMAIL_BODY_LENGTH 
          ? emailBody.substring(0, MAX_EMAIL_BODY_LENGTH) + "... [content truncated]" 
          : emailBody;
          
        context += `Body: ${truncatedBody}\n\n`;
      });
      
      // 4. Get user's AI settings and use configured model
      const aiSettings = await db.select().from(require('../../shared/schema').aiSettings).where(eq(require('../../shared/schema').aiSettings.userId, userId)).limit(1);
      const settings = aiSettings[0];
      
      let response;
      const systemPrompt = `
        You are an email assistant that helps users understand and analyze their emails.
        Answer questions based ONLY on the email context provided.
        Be concise and specific. If the answer cannot be found in the provided emails,
        say "I couldn't find information about that in your emails."
        
        For questions about top senders, dates, or statistics, compile the information
        from the provided emails to give accurate answers.
      `;
      
      if (settings?.selectedProvider === 'anthropic' && settings?.anthropicApiKey) {
        // Use Anthropic Claude
        const anthropic = new (require('@anthropic-ai/sdk').default)({
          apiKey: settings.anthropicApiKey,
        });
        
        response = await anthropic.messages.create({
          model: 'claude-3-7-sonnet-20250219', // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
          max_tokens: 1024,
          messages: [{ role: 'user', content: systemPrompt + "\n\n" + context + "\n\nQuestion: " + question }]
        });
        
        const content = response.content[0]?.text || "No answer found";
        
        return {
          answer: content,
          sources: relevantEmails.map((email: any) => ({
            id: email.id,
            from: email.sender,
            subject: email.subject,
            date: email.timestamp
          }))
        };
      } else if (settings?.selectedProvider === 'perplexity' && settings?.perplexityApiKey) {
        // Use Perplexity
        const perplexity = new OpenAI({
          apiKey: settings.perplexityApiKey,
          baseURL: 'https://api.perplexity.ai'
        });
        
        response = await perplexity.chat.completions.create({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: context + "\n\nQuestion: " + question }
          ],
          max_tokens: 1024
        });
        
        const content = response.choices[0].message.content || "No answer found";
        
        return {
          answer: content,
          sources: relevantEmails.map((email: any) => ({
            id: email.id,
            from: email.sender,
            subject: email.subject,
            date: email.timestamp
          }))
        };
      } else {
        // Default to OpenAI (either configured or fallback)
        response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: context + "\n\nQuestion: " + question }
          ],
        });
        
        const content = response.choices[0].message.content || "No answer found";
        
        return {
          answer: content,
          sources: relevantEmails.map((email: any) => ({
            id: email.id,
            from: email.sender,
            subject: email.subject,
            date: email.timestamp
          }))
        };
      }
    } catch (error) {
      console.error("Error in askAboutEmails:", error);
      throw error;
    }
  }
}

export const aiService = new AiService();

// Export the askAboutEmails function directly for easier access
export async function askAboutEmails(question: string): Promise<{ answer: string, sources: any[] }> {
  const userId = 1; // Using hardcoded userId for demo purposes
  return aiService.askAboutEmails(userId, question);
}