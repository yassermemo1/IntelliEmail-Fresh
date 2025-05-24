import { Request, Response } from "express";
import { AiService } from "../services/aiService";
import { AiModelService } from "../services/aiModelService";
import { OpenAI } from "openai";
import { Anthropic } from "@anthropic-ai/sdk";

/**
 * Test connections to all configured AI providers
 * @param req Request object
 * @param res Response object
 */
export async function testAllConnections(req: Request, res: Response) {
  const results = [];
  const aiService = new AiService();
  const aiModelService = new AiModelService();
  
  try {
    // Get current AI settings
    const settings = await aiModelService.getAiSettings(1); // Default user ID 1
    
    if (!settings) {
      return res.status(500).json({
        success: false,
        message: "Could not retrieve AI settings"
      });
    }
    
    // Test OpenAI connection
    try {
      const openaiResult = { 
        provider: "openai", 
        status: "error" as const, 
        message: "No API key configured",
        isKeyValid: false
      };
      
      if (settings.openaiApiKey) {
        const openai = new OpenAI({
          apiKey: settings.openaiApiKey
        });
        
        try {
          // Test the API key with a simple models list request
          await openai.models.list();
          openaiResult.status = "success";
          openaiResult.message = "Successfully connected to OpenAI API";
          openaiResult.isKeyValid = true;
        } catch (err: any) {
          console.error("OpenAI connection error:", err);
          openaiResult.message = err.message || "Failed to connect to OpenAI API";
        }
      }
      
      results.push(openaiResult);
    } catch (error) {
      console.error("Error testing OpenAI connection:", error);
      results.push({
        provider: "openai",
        status: "error" as const,
        message: "Error testing connection",
        isKeyValid: false
      });
    }
    
    // Test Anthropic connection
    try {
      const anthropicResult = { 
        provider: "anthropic", 
        status: "error" as const, 
        message: "No API key configured",
        isKeyValid: false
      };
      
      if (settings.anthropicApiKey) {
        const anthropic = new Anthropic({
          apiKey: settings.anthropicApiKey
        });
        
        try {
          // Test the API key with a simple models list request
          await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 10,
            messages: [{ role: "user", content: "Hello" }]
          });
          anthropicResult.status = "success";
          anthropicResult.message = "Successfully connected to Anthropic API";
          anthropicResult.isKeyValid = true;
        } catch (err: any) {
          console.error("Anthropic connection error:", err);
          anthropicResult.message = err.message || "Failed to connect to Anthropic API";
        }
      }
      
      results.push(anthropicResult);
    } catch (error) {
      console.error("Error testing Anthropic connection:", error);
      results.push({
        provider: "anthropic",
        status: "error" as const,
        message: "Error testing connection",
        isKeyValid: false
      });
    }
    
    // Test Perplexity connection
    try {
      const perplexityResult = { 
        provider: "perplexity", 
        status: "error" as const, 
        message: "No API key configured",
        isKeyValid: false
      };
      
      if (settings.perplexityApiKey) {
        // For Perplexity, we'll use a direct fetch request since there's no official Node.js SDK
        try {
          const response = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${settings.perplexityApiKey}`
            },
            body: JSON.stringify({
              model: "sonar-small-online",
              messages: [{ role: "user", content: "Hello" }],
              max_tokens: 10
            })
          });
          
          if (response.ok) {
            perplexityResult.status = "success";
            perplexityResult.message = "Successfully connected to Perplexity API";
            perplexityResult.isKeyValid = true;
          } else {
            const errorData = await response.json();
            perplexityResult.message = errorData.error?.message || `API returned status ${response.status}`;
          }
        } catch (err: any) {
          console.error("Perplexity connection error:", err);
          perplexityResult.message = err.message || "Failed to connect to Perplexity API";
        }
      }
      
      results.push(perplexityResult);
    } catch (error) {
      console.error("Error testing Perplexity connection:", error);
      results.push({
        provider: "perplexity",
        status: "error" as const,
        message: "Error testing connection",
        isKeyValid: false
      });
    }
    
    // Test Ollama connection
    try {
      const ollamaResult = { 
        provider: "ollama", 
        status: "error" as const, 
        message: "No Ollama endpoint configured or server not running"
      };
      
      if (settings.ollamaEndpoint) {
        try {
          // Test with a simple version check
          const response = await fetch(`${settings.ollamaEndpoint}/api/version`);
          
          if (response.ok) {
            const data = await response.json();
            ollamaResult.status = "success";
            ollamaResult.message = `Successfully connected to Ollama ${data.version || 'server'}`;
          } else {
            // Try tags endpoint as a fallback
            const tagsResponse = await fetch(`${settings.ollamaEndpoint}/api/tags`);
            
            if (tagsResponse.ok) {
              ollamaResult.status = "success";
              ollamaResult.message = "Successfully connected to Ollama server";
            } else {
              ollamaResult.message = `Ollama server not available at ${settings.ollamaEndpoint}`;
            }
          }
        } catch (err: any) {
          console.error("Ollama connection error:", err);
          ollamaResult.message = err.message || `Failed to connect to Ollama at ${settings.ollamaEndpoint}`;
        }
      }
      
      results.push(ollamaResult);
    } catch (error) {
      console.error("Error testing Ollama connection:", error);
      results.push({
        provider: "ollama",
        status: "error" as const,
        message: "Error testing connection"
      });
    }
    
    return res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error("Error testing connections:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to test AI connections"
    });
  }
}