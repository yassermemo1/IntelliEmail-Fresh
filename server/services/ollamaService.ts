/**
 * Ollama Service
 * Provides integration with locally-hosted Ollama LLM server
 */
import axios from 'axios';

class OllamaService {
  private endpoint: string = 'http://localhost:11434';
  private isConfigured: boolean = true; // Consider Ollama service ready by default

  /**
   * Configure the Ollama endpoint
   */
  configure(endpoint: string) {
    this.endpoint = endpoint;
    this.isConfigured = true;
    return true;
  }
  
  /**
   * Get the current Ollama endpoint
   */
  getEndpoint(): string {
    return this.endpoint;
  }

  /**
   * Check if Ollama service is available
   */
  async checkConnection(): Promise<boolean> {
    try {
      console.log(`Attempting to connect to Ollama at: ${this.endpoint}`);
      
      // First try the version endpoint (most reliable)
      try {
        const versionResponse = await axios.get(`${this.endpoint}/api/version`, {
          timeout: 5000, // 5 second timeout
          headers: { 'Accept': 'application/json' }
        });
        
        if (versionResponse.status === 200) {
          console.log('Ollama connection successful via version endpoint');
          return true;
        }
      } catch (versionError) {
        console.log('Could not connect to version endpoint, trying tags endpoint');
      }
      
      // If version fails, try tags (models) endpoint
      try {
        const tagsResponse = await axios.get(`${this.endpoint}/api/tags`, {
          timeout: 5000,
          headers: { 'Accept': 'application/json' }
        });
        
        if (tagsResponse.status === 200) {
          console.log('Ollama connection successful via tags endpoint');
          return true;
        }
      } catch (tagsError) {
        console.log('Could not connect to tags endpoint either');
      }
      
      console.log('All Ollama connection attempts failed');
      return false;
    } catch (error) {
      console.error('Error connecting to Ollama:', error);
      return false;
    }
  }

  /**
   * Check if Ollama service is available for use
   */
  async isAvailable(): Promise<boolean> {
    return this.checkConnection();
  }
  
  /**
   * Get available models from Ollama
   */
  async getModels(): Promise<any[]> {
    try {
      console.log(`Fetching models from Ollama at: ${this.endpoint}`);
      const response = await axios.get(`${this.endpoint}/api/tags`, {
        timeout: 10000, // 10 second timeout for model list
        headers: { 'Accept': 'application/json' }
      });
      
      // Check the structure of the response
      if (response.data && Array.isArray(response.data.models)) {
        console.log(`Retrieved ${response.data.models.length} models from Ollama`);
        return response.data.models;
      } else if (response.data && Array.isArray(response.data)) {
        // Some Ollama versions might return the array directly
        console.log(`Retrieved ${response.data.length} models from Ollama (direct array)`);
        return response.data;
      } else {
        console.warn('Unexpected model data format from Ollama:', response.data);
        return [];
      }
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      return [];
    }
  }
  
  /**
   * Get available models from Ollama API for compatibility with aiModelService
   */
  async getAvailableModels(): Promise<any[]> {
    return this.getModels();
  }
  
  /**
   * Synchronize Ollama models to the database
   * Currently a stub function that returns 0 for compatibility
   */
  async syncModelsToDatabase(): Promise<number> {
    // In a full implementation, this would fetch models and add them to the database
    // For now, we'll just return 0 to indicate no models were synced
    console.log("Note: syncModelsToDatabase called but not fully implemented");
    return 0;
  }
  
  /**
   * Set the Ollama endpoint
   */
  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
    this.isConfigured = true;
  }

  /**
   * Generate text completion with Ollama
   */
  async generateCompletion(model: string, prompt: string, options: any = {}): Promise<string> {
    try {
      const response = await axios.post(`${this.endpoint}/api/generate`, {
        model,
        prompt,
        ...options
      });
      
      return response.data.response || '';
    } catch (error) {
      console.error('Error generating completion with Ollama:', error);
      throw new Error('Failed to generate completion with Ollama');
    }
  }

  /**
   * Generate embedding vector for text using Ollama
   */
  async generateEmbedding(model: string, text: string): Promise<number[]> {
    try {
      const response = await axios.post(`${this.endpoint}/api/embeddings`, {
        model,
        prompt: text
      });
      
      return response.data.embedding || [];
    } catch (error) {
      console.error('Error generating embedding with Ollama:', error);
      throw new Error('Failed to generate embedding with Ollama');
    }
  }

  /**
   * Format email text for summary generation
   */
  prepareEmailForSummary(subject: string, body: string, sender: string): string {
    return `
Email Subject: ${subject}
From: ${sender}

${body}
    `.trim();
  }

  /**
   * Generate email summary using Ollama
   */
  async summarizeEmail(model: string, subject: string, body: string, sender: string): Promise<string> {
    const formattedPrompt = this.prepareEmailForSummary(subject, body, sender);
    const prompt = `Summarize this email in 2-3 sentences, focusing on key points and any required actions:\n\n${formattedPrompt}`;
    
    return this.generateCompletion(model, prompt, {
      temperature: 0.3,
      max_tokens: 150
    });
  }

  /**
   * Extract tasks from email using Ollama
   */
  async extractTasks(model: string, subject: string, body: string, sender: string): Promise<string[]> {
    const formattedPrompt = this.prepareEmailForSummary(subject, body, sender);
    const prompt = `Extract any tasks, action items, or commitments from this email. Return each task as a separate list item. If there are no tasks, return "No tasks found.":\n\n${formattedPrompt}`;
    
    const result = await this.generateCompletion(model, prompt, {
      temperature: 0.2,
      max_tokens: 250
    });
    
    // Parse the result
    if (result.includes("No tasks found")) {
      return [];
    }
    
    // Extract tasks from the response
    const tasks = result
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•') || /^\d+\./.test(line.trim()))
      .map(line => line.replace(/^[-•\d\.]+\s*/, '').trim())
      .filter(line => line.length > 0);
    
    return tasks;
  }
}

export const ollamaService = new OllamaService();