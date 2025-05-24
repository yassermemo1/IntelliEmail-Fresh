import OpenAI from "openai";
import { aiSettings } from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";

/**
 * Service for interacting with Perplexity AI models
 */
export class PerplexityService {
  private async getApiKey(userId: number): Promise<string | null> {
    try {
      const settings = await db.query.aiSettings.findFirst({
        where: eq(aiSettings.userId, userId)
      });
      
      return settings?.perplexityApiKey || null;
    } catch (error) {
      console.error("Error retrieving Perplexity API key:", error);
      return null;
    }
  }
  
  /**
   * Create a Perplexity client instance
   */
  async createClient(userId: number): Promise<OpenAI | null> {
    const apiKey = await this.getApiKey(userId);
    
    if (!apiKey) {
      console.error("No Perplexity API key found for user", userId);
      return null;
    }
    
    return new OpenAI({ 
      baseURL: "https://api.perplexity.ai/v1",
      apiKey
    });
  }
  
  /**
   * Test if the provided API key is valid
   */
  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      console.log("Testing Perplexity API key...");
      
      // Create a client with the provided key
      const perplexity = new OpenAI({ 
        baseURL: "https://api.perplexity.ai/v1",
        apiKey
      });
      
      // Make a minimal API call to test authentication
      const response = await perplexity.chat.completions.create({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 10
      });
      
      return !!response;
    } catch (error) {
      console.error("Perplexity API key test failed:", error);
      return false;
    }
  }
  
  /**
   * Generate a text completion using Perplexity's models
   */
  async generateCompletion(userId: number, prompt: string, modelId: string = "llama-3.1-sonar-small-128k-online"): Promise<string | null> {
    try {
      const perplexity = await this.createClient(userId);
      
      if (!perplexity) {
        throw new Error("Could not create Perplexity client");
      }
      
      const response = await perplexity.chat.completions.create({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0.7,
        search_domain_filter: [],  // Allow search across the web
        return_related_questions: false
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      console.error("Error generating Perplexity completion:", error);
      return null;
    }
  }
}

export const perplexityService = new PerplexityService();