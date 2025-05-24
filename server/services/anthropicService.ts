import Anthropic from "@anthropic-ai/sdk";
import { aiSettings } from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";

/**
 * Service for interacting with Anthropic Claude models
 */
export class AnthropicService {
  private async getApiKey(userId: number): Promise<string | null> {
    try {
      const settings = await db.query.aiSettings.findFirst({
        where: eq(aiSettings.userId, userId)
      });
      
      return settings?.anthropicApiKey || null;
    } catch (error) {
      console.error("Error retrieving Anthropic API key:", error);
      return null;
    }
  }
  
  /**
   * Create an Anthropic client instance
   */
  async createClient(userId: number): Promise<Anthropic | null> {
    const apiKey = await this.getApiKey(userId);
    
    if (!apiKey) {
      console.error("No Anthropic API key found for user", userId);
      return null;
    }
    
    return new Anthropic({
      apiKey
    });
  }
  
  /**
   * Test if the provided API key is valid
   */
  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      console.log("Testing Anthropic API key...");
      
      // Create a client with the provided key
      const anthropic = new Anthropic({
        apiKey
      });
      
      // Make a minimal API call to test authentication
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219", // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }]
      });
      
      return !!response;
    } catch (error) {
      console.error("Anthropic API key test failed:", error);
      return false;
    }
  }
  
  /**
   * Generate a text completion using Claude
   */
  async generateCompletion(userId: number, prompt: string, modelId: string = "claude-3-7-sonnet-20250219"): Promise<string | null> {
    try {
      const anthropic = await this.createClient(userId);
      
      if (!anthropic) {
        throw new Error("Could not create Anthropic client");
      }
      
      const response = await anthropic.messages.create({
        model: modelId,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }]
      });
      
      return response.content[0].text;
    } catch (error) {
      console.error("Error generating Anthropic completion:", error);
      return null;
    }
  }
}

export const anthropicService = new AnthropicService();