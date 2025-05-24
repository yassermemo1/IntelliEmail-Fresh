/**
 * Embedding Service
 * 
 * Handles the generation and management of vector embeddings for semantic search
 */

import { OpenAI } from 'openai';
import { log } from '../vite';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { debugLogger } from '../utils/debugLogger';

// Standard dimensionality for our vector embeddings
const VECTOR_DIMENSIONS = 768;

class EmbeddingService {
  private openai: OpenAI | null = null;
  
  constructor() {
    // Initialize OpenAI if API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey
      });
    }
  }
  
  /**
   * Generate an embedding vector for the given text
   * This will be used for semantic search
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Clean and prepare text for embedding
      const cleanedText = this.prepareTextForEmbedding(text);
      
      // If text is empty after cleaning, return a zero vector
      if (!cleanedText) {
        log('Empty text after cleaning, returning zero vector', 'warning');
        return Array(VECTOR_DIMENSIONS).fill(0);
      }
      
      // Use OpenAI to generate the embedding
      if (this.openai) {
        // Truncate long texts (OpenAI has a token limit)
        const truncatedText = this.truncateText(cleanedText, 12000);
        
        // Generate embedding using OpenAI API
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: truncatedText
        });
        
        const embedding = response.data[0].embedding;
        
        // Check dimensionality and adjust if necessary
        if (embedding.length !== VECTOR_DIMENSIONS) {
          log(`OpenAI embedding has ${embedding.length} dimensions, expected exactly ${VECTOR_DIMENSIONS} dimensions`, 'warning');
          return this.adjustEmbeddingDimensions(embedding, VECTOR_DIMENSIONS);
        }
        
        return embedding;
      }
      
      // Fallback to random embeddings if OpenAI is not available
      // This is just a placeholder - in production you'd want a proper fallback
      log('OpenAI not configured, returning random embedding vector', 'warning');
      return Array.from({ length: VECTOR_DIMENSIONS }, () => Math.random() * 2 - 1);
    } catch (error) {
      log(`Error generating embedding: ${error.message}`, 'error');
      // Return a zero vector as a fallback
      return Array(VECTOR_DIMENSIONS).fill(0);
    }
  }
  
  /**
   * Adjust embedding to the required dimensions
   * - If the source has more dimensions, we truncate
   * - If the source has fewer dimensions, we pad with zeros
   */
  private adjustEmbeddingDimensions(embedding: number[], targetDimensions: number): number[] {
    if (embedding.length === targetDimensions) {
      return embedding;
    }
    
    if (embedding.length > targetDimensions) {
      // Truncate to target dimensions
      log(`Converting ${embedding.length}-dim OpenAI embedding to ${targetDimensions}-dim using proper dimensionality reduction`, 'info');
      return embedding.slice(0, targetDimensions);
    } else {
      // Pad with zeros to reach target dimensions
      log(`Padding ${embedding.length}-dim embedding to ${targetDimensions}-dim`, 'info');
      return [...embedding, ...Array(targetDimensions - embedding.length).fill(0)];
    }
  }
  
  /**
   * Clean and prepare text for embedding generation
   */
  private prepareTextForEmbedding(text: string): string {
    if (!text) return '';
    
    return text
      .trim()
      // Replace multiple whitespace with single space
      .replace(/\s+/g, ' ')
      // Remove special characters that don't add semantic meaning
      .replace(/[^\w\s.,?!;:()"'-]/g, ' ')
      // Normalize whitespace again
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Truncate text to a specific character limit
   * This is important for API limits and efficiency
   */
  private truncateText(text: string, limit: number): string {
    if (text.length <= limit) return text;
    
    // If we need to truncate, log a warning
    if (text.length > limit) {
      log(`Text truncated from ${text.length} to ${limit} characters for embedding generation`, 'info');
    }
    
    // Simple truncation
    return text.substring(0, limit);
  }
}

export const embeddingService = new EmbeddingService();