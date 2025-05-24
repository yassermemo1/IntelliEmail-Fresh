import { db } from "../db";
import { emails, emailSemanticLinks } from "@shared/schema";
import { sql, and, eq, lt, ne, or } from "drizzle-orm";
import { Email } from "@shared/schema";

// Define the format for related emails
export interface RelatedEmail {
  id: number;
  subject: string;
  sender: string;
  timestamp: Date;
  relation_type: 'thread' | 'subject' | 'semantic';
  similarity_score?: number;
}

/**
 * Service to handle email chaining and relationship detection
 */
export class EmailChainService {
  /**
   * Find related emails for a given email ID
   * Uses a prioritized approach:
   * 1. Thread ID matching (highest priority) - emails in the same conversation thread
   * 2. Subject similarity - emails with similar cleaned subjects
   * 3. Semantic similarity - emails with similar content based on embeddings
   * 4. Pre-computed semantic links - stored strong relationships from past analysis
   * 
   * @param emailId - The ID of the email to find relations for
   * @param accountId - Optional filter by email account ID
   * @param maxResults - Maximum number of related emails to return (default 10)
   * @returns Array of related emails with metadata about relation type
   */
  async findRelatedEmails(emailId: number, accountId?: number, maxResults = 10): Promise<RelatedEmail[]> {
    try {
      // Get the original email
      const emailResults = await db.execute(sql`
        SELECT * FROM emails WHERE id = ${emailId}
      `);
      
      const emailList = Array.isArray(emailResults) ? emailResults : emailResults?.rows || [];
      if (emailList.length === 0) {
        return [];
      }
      
      const email = emailList[0];
      
      if (!email) {
        return [];
      }
      
      const result: RelatedEmail[] = [];
      const seenIds = new Set<number>([emailId]); // Track emails we've already added
      
      // Step 1: Check pre-computed semantic links (if available)
      try {
        const preComputedLinks = await this.getPreComputedLinks(emailId);
        console.log(`Found ${preComputedLinks.length} precomputed links for email ${emailId}`);
        
        if (preComputedLinks && preComputedLinks.length > 0) {
          for (const link of preComputedLinks) {
            const relatedId = parseInt(link.email_id_a) === emailId ? parseInt(link.email_id_b) : parseInt(link.email_id_a);
            if (!seenIds.has(relatedId)) {
            const relatedEmailResults = await db.execute(sql`
              SELECT id, subject, sender, timestamp FROM emails WHERE id = ${relatedId}
            `);
            
            const relatedEmailList = Array.isArray(relatedEmailResults) 
              ? relatedEmailResults 
              : relatedEmailResults?.rows || [];
            
            const relatedEmail = relatedEmailList.length > 0 ? relatedEmailList[0] : null;
            
            if (relatedEmail) {
              const relationType = 
                typeof link.link_type === 'string' && ['thread', 'subject', 'semantic'].includes(link.link_type) 
                  ? link.link_type as 'thread' | 'subject' | 'semantic'
                  : 'semantic';
                  
              result.push({
                id: relatedEmail.id,
                subject: relatedEmail.subject,
                sender: relatedEmail.sender,
                timestamp: relatedEmail.timestamp,
                relation_type: relationType,
                similarity_score: typeof link.similarity_score === 'number' ? link.similarity_score : null
              });
              seenIds.add(relatedEmail.id);
            }
          }
          
          // If we've reached our limit with pre-computed links, return early
          if (result.length >= maxResults) {
            return result;
          }
        }
      }
      } catch (error) {
        console.error("Error processing pre-computed links:", error);
        // Continue with other methods even if this one fails
      }
      
      // Step 2: Thread ID matching (highest priority)
      if (email.thread_id) {
        // Apply account filter if provided
        const accountFilter = accountId 
          ? sql` AND account_id = ${accountId}` 
          : sql``;
          
        const threadResults = await db.execute(sql`
          SELECT id, subject, sender, timestamp 
          FROM emails 
          WHERE thread_id = ${email.thread_id}
            AND id != ${emailId}
            ${accountFilter}
          ORDER BY timestamp DESC
          LIMIT ${maxResults - result.length}
        `);
        
        const threadMatches = Array.isArray(threadResults) 
          ? threadResults 
          : threadResults?.rows || [];
        
        for (const match of threadMatches) {
          if (!seenIds.has(match.id)) {
            result.push({
              id: match.id,
              subject: match.subject,
              sender: match.sender,
              timestamp: match.timestamp,
              relation_type: 'thread'
            });
            seenIds.add(match.id);
            
            // Store this relationship in the links table for future use
            await this.storeRelationship(
              emailId,
              match.id, 
              'thread',
              95 // High confidence for thread matches
            );
          }
        }
        
        // If we've found enough by thread ID, return early
        if (result.length >= maxResults) {
          return result;
        }
      }
      
      // Step 3: Subject line similarity (secondary priority)
      const cleanSubject = this.cleanSubject(email.subject || "");
      
      if (cleanSubject.length >= 3) {
        // Apply account filter if provided
        const accountFilter = accountId 
          ? sql` AND account_id = ${accountId}` 
          : sql``;
          
        const subjectResults = await db.execute(sql`
          SELECT id, subject, sender, timestamp,
                 similarity(${cleanSubject}, regexp_replace(subject, '^(re|fwd|fw|forward)(\\[\\d+\\])?:\\s*', '', 'i')) AS subj_similarity
          FROM emails 
          WHERE id != ${emailId}
            AND ${cleanSubject} % regexp_replace(subject, '^(re|fwd|fw|forward)(\\[\\d+\\])?:\\s*', '', 'i')
            AND NOT (thread_id = ${email.thread_id} AND ${email.thread_id} IS NOT NULL)
            ${accountFilter}
          ORDER BY subj_similarity DESC
          LIMIT ${maxResults - result.length}
        `);
        
        const subjectMatches = Array.isArray(subjectResults) 
          ? subjectResults 
          : subjectResults?.rows || [];
        
        for (const match of subjectMatches) {
          if (!seenIds.has(match.id)) {
            // Only include subject matches with good similarity (>0.6)
            if (match.subj_similarity >= 0.6) {
              result.push({
                id: match.id,
                subject: match.subject,
                sender: match.sender,
                timestamp: match.timestamp,
                relation_type: 'subject',
                similarity_score: Math.round(match.subj_similarity * 100)
              });
              seenIds.add(match.id);
              
              // Store this relationship in the links table for future use
              await this.storeRelationship(
                emailId,
                match.id, 
                'subject',
                Math.round(match.subj_similarity * 100)
              );
            }
          }
        }
        
        // If we've found enough with subject similarity, return early
        if (result.length >= maxResults) {
          return result;
        }
      }
      
      // Step 4: Semantic similarity (if embedding vectors are available)
      if (email.embedding_vector) {
        try {
          // Apply account filter if provided
          const accountFilter = accountId 
            ? sql` AND account_id = ${accountId}` 
            : sql``;
          
          // Handle embedding vector format for pgvector compatibility
          let vectorValue = null;
          
          if (typeof email.embedding_vector === 'string') {
            try {
              vectorValue = JSON.parse(email.embedding_vector);
              console.log(`Email ${emailId} has string embedding vector, parsed successfully`);
            } catch (e) {
              // Might already be a vector string representation
              vectorValue = email.embedding_vector;
              console.log(`Email ${emailId} has string embedding vector, using directly`);
            }
          } else if (Array.isArray(email.embedding_vector)) {
            vectorValue = email.embedding_vector;
            console.log(`Email ${emailId} has array embedding vector of length ${vectorValue.length}`);
          } else if (email.embedding_vector && typeof email.embedding_vector === 'object') {
            // PostgreSQL might return the vector as an object
            vectorValue = email.embedding_vector;
            console.log(`Email ${emailId} has object embedding vector`);
          }
          
          if (!vectorValue) {
            console.log(`Email ${emailId} has invalid embedding_vector format, skipping semantic search`);
          } else {
            // Convert to string for SQL, handling different formats
            const vectorString = Array.isArray(vectorValue) ? JSON.stringify(vectorValue) : vectorValue.toString();
            
            const semanticResults = await db.execute(sql`
              SELECT id, subject, sender, timestamp,
                    (1 - (embedding_vector <=> ${vectorString}::vector)) AS semantic_score
              FROM emails
              WHERE id != ${emailId}
                AND id <> ALL(${Array.from(seenIds)})
                AND embedding_vector IS NOT NULL
                ${accountFilter}
              ORDER BY semantic_score DESC
              LIMIT ${maxResults - result.length}
            `);
                
            const semanticMatches = Array.isArray(semanticResults) 
              ? semanticResults 
              : semanticResults?.rows || [];
            
            for (const match of semanticMatches) {
              if (!seenIds.has(match.id)) {
                // Only include semantic matches with good similarity (>0.7)
                if (match.semantic_score >= 0.7) {
                  result.push({
                    id: match.id,
                    subject: match.subject,
                    sender: match.sender,
                    timestamp: match.timestamp,
                    relation_type: 'semantic',
                    similarity_score: Math.round(match.semantic_score * 100)
                  });
                  seenIds.add(match.id);
                  
                  // Store high-confidence semantic relationships
                  if (match.semantic_score >= 0.8) {
                    await this.storeRelationship(
                      emailId,
                      match.id, 
                      'semantic',
                      Math.round(match.semantic_score * 100)
                    );
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing semantic search for email ${emailId}:`, error);
        }
      }
      
      return result;
    } catch (error) {
      console.error("Error finding related emails:", error);
      return [];
    }
  }
  
  /**
   * Get pre-computed semantic links for an email from the database
   */
  private async getPreComputedLinks(emailId: number): Promise<any[]> {
    try {
      const links = await db.execute(sql`
        SELECT email_id_a, email_id_b, similarity_score, link_type
        FROM email_semantic_links
        WHERE email_id_a = ${emailId} OR email_id_b = ${emailId}
        ORDER BY similarity_score DESC
      `);
      
      return Array.isArray(links) ? links : links?.rows || [];
    } catch (error) {
      console.error("Error getting pre-computed links:", error);
      return [];
    }
  }
  
  /**
   * Store a relationship between two emails
   * @param emailIdA - First email ID
   * @param emailIdB - Second email ID
   * @param linkType - Type of link (thread, subject, semantic)
   * @param similarityScore - Score representing how similar the emails are (0-100)
   */
  private async storeRelationship(
    emailIdA: number, 
    emailIdB: number, 
    linkType: 'thread' | 'subject' | 'semantic', 
    similarityScore: number
  ): Promise<void> {
    try {
      // Always store with lower ID first to avoid duplicates
      if (emailIdA > emailIdB) {
        [emailIdA, emailIdB] = [emailIdB, emailIdA];
      }
      
      // Check if the relationship already exists
      const existingLinks = await db.execute(sql`
        SELECT * FROM email_semantic_links
        WHERE email_id_a = ${emailIdA} AND email_id_b = ${emailIdB}
      `);
      
      const existingLinksArray = Array.isArray(existingLinks) ? existingLinks : existingLinks?.rows || [];
      const existingLink = existingLinksArray.length > 0 ? existingLinksArray[0] : null;
      
      if (existingLink) {
        // Only update if the new score is higher or it's a higher priority link type
        const linkTypePriority = { thread: 3, subject: 2, semantic: 1 };
        const existingPriority = linkTypePriority[existingLink.link_type] || 0;
        const newPriority = linkTypePriority[linkType] || 0;
        
        if (newPriority > existingPriority || 
            (newPriority === existingPriority && similarityScore > existingLink.similarity_score)) {
          await db.execute(sql`
            UPDATE email_semantic_links
            SET similarity_score = ${similarityScore}, link_type = ${linkType}::link_type
            WHERE email_id_a = ${emailIdA} AND email_id_b = ${emailIdB}
          `);
        }
      } else {
        // Insert new relationship
        await db.execute(sql`
          INSERT INTO email_semantic_links (email_id_a, email_id_b, similarity_score, link_type)
          VALUES (${emailIdA}, ${emailIdB}, ${similarityScore}, ${linkType}::link_type)
        `);
      }
    } catch (error) {
      console.error("Error storing relationship:", error);
    }
  }
  
  /**
   * Clean subject line for better matching
   * Removes Re:, Fwd:, etc. prefixes and normalizes whitespace
   */
  private cleanSubject(subject: string): string {
    return subject
      .toLowerCase()
      .replace(/^(re|fwd|fw|forward|aw)(\[\d+\])?:\s*/gi, '')
      .replace(/^\s+|\s+$/g, '')  // Trim whitespace
      .replace(/\s+/g, ' ');      // Normalize whitespace
  }
  
  /**
   * Update email relationships in the database based on semantic similarity
   * This method proactively identifies and stores semantic relationships between emails
   * 
   * @param accountId - Optional filter by email account ID
   * @param limit - Maximum number of emails to process
   * @param recentOnly - Only process recently updated emails
   * @returns Number of relationships found and stored
   */
  async updateEmailRelationships(accountId?: number, limit = 100, recentOnly = true): Promise<number> {
    try {
      console.log(`Starting email relationship update ${accountId ? 'for account ' + accountId : 'across all accounts'}, limit ${limit}, recentOnly: ${recentOnly}`);
      
      // Build the query for emails with embeddings that need relationship analysis
      let query = sql`
        SELECT id, account_id, subject, thread_id, timestamp, embedding_vector
        FROM emails 
        WHERE embedding_vector IS NOT NULL
      `;
      
      // Add account filter if provided
      if (accountId) {
        query = sql`${query} AND account_id = ${accountId}`;
      }
      
      // Add recency filter if requested
      if (recentOnly) {
        // Target emails that were recently updated or have few relationships
        query = sql`${query} AND (
          updated_at > NOW() - INTERVAL '7 days'
          OR NOT EXISTS (
            SELECT 1 FROM email_semantic_links
            WHERE email_id_a = emails.id OR email_id_b = emails.id
            LIMIT 5
          )
        )`;
      }
      
      // Add limit
      query = sql`${query} ORDER BY updated_at DESC LIMIT ${limit}`;
      
      // Execute the query
      const emailsToProcess = await db.execute(query);
      const emails = Array.isArray(emailsToProcess) 
        ? emailsToProcess 
        : emailsToProcess?.rows || [];
      
      console.log(`Found ${emails.length} emails to analyze for relationships`);
      
      let relationshipsCount = 0;
      
      // Process each email to find semantic relationships
      for (const email of emails) {
        // Find semantically similar emails using vector similarity
        // Only process emails with valid embedding vectors
        if (!email.embedding_vector) {
          console.log(`Email ${email.id} doesn't have valid embedding_vector, skipping semantic analysis`);
          continue;
        }
        
        // Handle embedding vector format for pgvector compatibility
        let vectorValue = null;
        
        if (typeof email.embedding_vector === 'string') {
          try {
            vectorValue = JSON.parse(email.embedding_vector);
            console.log(`Email ${email.id} has string embedding vector, parsed successfully`);
          } catch (e) {
            // Might already be a vector string representation
            vectorValue = email.embedding_vector;
            console.log(`Email ${email.id} has string embedding vector, using directly`);
          }
        } else if (Array.isArray(email.embedding_vector)) {
          vectorValue = email.embedding_vector;
          console.log(`Email ${email.id} has array embedding vector of length ${vectorValue.length}`);
        } else if (email.embedding_vector && typeof email.embedding_vector === 'object') {
          // PostgreSQL might return the vector as an object
          vectorValue = email.embedding_vector;
          console.log(`Email ${email.id} has object embedding vector`);
        }
        
        if (!vectorValue) {
          console.log(`Email ${email.id} has invalid embedding_vector format, skipping`);
          continue;
        }
        
        try {
          // Convert to string for SQL, handling different formats
          const vectorString = Array.isArray(vectorValue) ? JSON.stringify(vectorValue) : vectorValue.toString();
          
          // Use the vector as text and cast it properly in the query
          const similarEmails = await db.execute(sql`
            SELECT id, subject,
                  (1 - (embedding_vector <=> ${vectorString}::vector)) AS similarity
            FROM emails
            WHERE id != ${email.id}
              AND embedding_vector IS NOT NULL
              ${accountId ? sql` AND account_id = ${accountId}` : sql``}
              AND (1 - (embedding_vector <=> ${vectorString}::vector)) > 0.85
            ORDER BY similarity DESC
            LIMIT 10
          `);
          
          const similarResults = Array.isArray(similarEmails) 
            ? similarEmails 
            : similarEmails?.rows || [];
        
          // Store high-confidence relationships
          for (const similar of similarResults) {
            // Convert similarity to a score from 0-100
            const similarityScore = Math.round(similar.similarity * 100);
            
            // Only store strong relationships (similarity > 0.85)
            if (similarityScore >= 85) {
              // Store the relationship
              await this.storeRelationship(
                email.id,
                similar.id,
                'semantic',
                similarityScore
              );
              
              relationshipsCount++;
            }
          }
        } catch (error) {
          console.error(`Error processing semantic similarity for email ${email.id}:`, error);
        }
      }
      
      console.log(`Stored ${relationshipsCount} semantic relationships`);
      return relationshipsCount;
    } catch (error) {
      console.error("Error updating email relationships:", error);
      return 0;
    }
  }
  
  /**
   * Get detailed statistics about email relationships in the system
   * Includes overall counts, distribution of similarity scores, and sample links
   */
  async getRelationshipStats(): Promise<{
    totalLinks: number;
    threadLinks: number;
    subjectLinks: number;
    semanticLinks: number;
    highConfidenceLinks: number;
    recentLinks?: number;
    similarityDistribution?: any[];
    sampleLinks?: any[];
  }> {
    try {
      // Get overall statistics about relationship links
      const statsResult = await db.execute(sql`
        SELECT 
          COUNT(*) AS total_links,
          COUNT(*) FILTER (WHERE link_type = 'thread') AS thread_links,
          COUNT(*) FILTER (WHERE link_type = 'subject') AS subject_links,
          COUNT(*) FILTER (WHERE link_type = 'semantic') AS semantic_links,
          COUNT(*) FILTER (WHERE similarity_score >= 90) AS high_confidence_links,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') AS recent_links
        FROM email_semantic_links
      `);
      
      // Handle different result formats (array or rows property)
      const stats = Array.isArray(statsResult) && statsResult.length > 0 
        ? statsResult[0] 
        : (statsResult?.rows && statsResult.rows.length > 0 ? statsResult.rows[0] : {});
      
      // Get distribution of similarity scores for semantic links
      const distributionResult = await db.execute(sql`
        WITH score_ranges AS (
          SELECT 
            CASE 
              WHEN similarity_score < 85 THEN 'Below 85'
              WHEN similarity_score BETWEEN 85 AND 89 THEN '85-89'
              WHEN similarity_score BETWEEN 90 AND 94 THEN '90-94'
              WHEN similarity_score BETWEEN 95 AND 97 THEN '95-97'
              WHEN similarity_score BETWEEN 98 AND 100 THEN '98-100'
              ELSE 'Unknown'
            END as range_name,
            COUNT(*) as count
          FROM email_semantic_links
          WHERE link_type = 'semantic'
          GROUP BY range_name
        )
        SELECT range_name, count FROM score_ranges
        ORDER BY 
          CASE 
            WHEN range_name = 'Below 85' THEN 1
            WHEN range_name = '85-89' THEN 2
            WHEN range_name = '90-94' THEN 3
            WHEN range_name = '95-97' THEN 4
            WHEN range_name = '98-100' THEN 5
            ELSE 6
          END
      `);
      
      const distribution = Array.isArray(distributionResult) 
        ? distributionResult 
        : distributionResult?.rows || [];
      
      // Get a sample of recent links for inspection/debugging
      const sampleResult = await db.execute(sql`
        SELECT 
          esl.email_id_a, 
          esl.email_id_b, 
          esl.similarity_score, 
          esl.link_type,
          esl.created_at,
          e1.subject as subject_a,
          e2.subject as subject_b,
          e1.thread_id as thread_id_a,
          e2.thread_id as thread_id_b
        FROM email_semantic_links esl
        JOIN emails e1 ON esl.email_id_a = e1.id
        JOIN emails e2 ON esl.email_id_b = e2.id
        ORDER BY esl.created_at DESC
        LIMIT 5
      `);
      
      const sampleLinks = Array.isArray(sampleResult) 
        ? sampleResult 
        : sampleResult?.rows || [];
      
      return {
        totalLinks: parseInt(stats?.total_links || '0'),
        threadLinks: parseInt(stats?.thread_links || '0'),
        subjectLinks: parseInt(stats?.subject_links || '0'),
        semanticLinks: parseInt(stats?.semantic_links || '0'),
        highConfidenceLinks: parseInt(stats?.high_confidence_links || '0'),
        recentLinks: parseInt(stats?.recent_links || '0'),
        similarityDistribution: distribution,
        sampleLinks: sampleLinks
      };
    } catch (error) {
      console.error("Error getting relationship stats:", error);
      return {
        totalLinks: 0,
        threadLinks: 0,
        subjectLinks: 0,
        semanticLinks: 0,
        highConfidenceLinks: 0
      };
    }
  }
}

export const emailChainService = new EmailChainService();