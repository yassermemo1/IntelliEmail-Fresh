import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { db } from '../db';
import { aiSettings, aiModels } from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Dynamic AI Service - Uses user-configured AI providers and models
 * Ensures all AI operations respect user preferences from ai_settings table
 */
export class DynamicAiService {
  private openaiClient: OpenAI | null = null;
  private anthropicClient: Anthropic | null = null;
  
  constructor() {
    // Initialize system default OpenAI client
    this.openaiClient = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  /**
   * Get user's AI configuration from database
   */
  private async getUserAiConfig(userId: number) {
    try {
      const [userSettings] = await db
        .select()
        .from(aiSettings)
        .where(eq(aiSettings.userId, userId))
        .limit(1);

      if (!userSettings) {
        console.log(`No AI settings found for user ${userId}, using system defaults`);
        return this.getSystemDefaults();
      }

      // Get the configured model details
      const modelInfo = await db
        .select()
        .from(aiModels)
        .where(eq(aiModels.id, userSettings.selectedModelId))
        .limit(1);
      
      const model = modelInfo[0];

      return {
        provider: userSettings.selectedProvider,
        modelId: model?.modelId || 'gpt-4o',
        apiKey: this.getApiKeyForProvider(userSettings),
        ollamaEndpoint: userSettings.ollamaEndpoint
      };
    } catch (error) {
      console.error('Error getting user AI config:', error);
      return this.getSystemDefaults();
    }
  }

  /**
   * Get API key for the selected provider
   */
  private getApiKeyForProvider(settings: any): string {
    switch (settings.selectedProvider) {
      case 'openai':
        return settings.openaiApiKey || process.env.OPENAI_API_KEY || '';
      case 'anthropic':
        return settings.anthropicApiKey || '';
      case 'perplexity':
        return settings.perplexityApiKey || '';
      default:
        return process.env.OPENAI_API_KEY || '';
    }
  }

  /**
   * System-wide default configuration
   */
  private getSystemDefaults() {
    return {
      provider: 'openai',
      modelId: 'gpt-4o',
      apiKey: process.env.OPENAI_API_KEY || '',
      ollamaEndpoint: 'http://localhost:11434'
    };
  }

  /**
   * Create AI client based on user configuration
   */
  private createAiClient(config: any) {
    switch (config.provider) {
      case 'anthropic':
        return new Anthropic({ apiKey: config.apiKey });
      
      case 'perplexity':
        return new OpenAI({
          apiKey: config.apiKey,
          baseURL: 'https://api.perplexity.ai'
        });
      
      case 'ollama':
        return new OpenAI({
          apiKey: 'ollama', // Ollama doesn't need real API key
          baseURL: config.ollamaEndpoint
        });
      
      default: // openai
        return new OpenAI({ apiKey: config.apiKey });
    }
  }

  /**
   * Main method: Generate AI completion using user's configured model
   */
  async generateCompletion(userId: number, messages: any[], options: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: any;
    systemPrompt?: string;
  } = {}) {
    const config = await this.getUserAiConfig(userId);
    
    console.log(`🤖 Using AI: ${config.provider} with model ${config.modelId} for user ${userId}`);
    
    try {
      const client = this.createAiClient(config);
      
      // Prepare messages with system prompt if provided
      const finalMessages = options.systemPrompt 
        ? [{ role: 'system', content: options.systemPrompt }, ...messages]
        : messages;

      if (config.provider === 'anthropic') {
        // Anthropic API format
        const response = await (client as Anthropic).messages.create({
          model: config.modelId,
          max_tokens: options.maxTokens || 1024,
          messages: finalMessages,
          temperature: options.temperature || 0.7
        });
        
        return {
          content: response.content[0]?.text || '',
          provider: config.provider,
          model: config.modelId
        };
      } else {
        // OpenAI-compatible API format (OpenAI, Perplexity, Ollama)
        const completionOptions: any = {
          model: config.modelId,
          messages: finalMessages,
          temperature: options.temperature || 0.7
        };

        if (options.maxTokens) completionOptions.max_tokens = options.maxTokens;
        if (options.responseFormat) completionOptions.response_format = options.responseFormat;

        const response = await (client as OpenAI).chat.completions.create(completionOptions);
        
        return {
          content: response.choices[0].message.content || '',
          provider: config.provider,
          model: config.modelId
        };
      }
    } catch (error) {
      console.error(`Error with ${config.provider} (${config.modelId}):`, error);
      
      // Fallback to system default
      if (config.provider !== 'openai') {
        console.log('Falling back to system default OpenAI');
        return this.generateCompletionWithFallback(messages, options);
      }
      throw error;
    }
  }

  /**
   * Fallback to system default OpenAI
   */
  private async generateCompletionWithFallback(messages: any[], options: any) {
    if (!this.openaiClient) {
      throw new Error('No OpenAI client available for fallback');
    }

    const finalMessages = options.systemPrompt 
      ? [{ role: 'system', content: options.systemPrompt }, ...messages]
      : messages;

    const completionOptions: any = {
      model: 'gpt-4o',
      messages: finalMessages,
      temperature: options.temperature || 0.7
    };

    if (options.maxTokens) completionOptions.max_tokens = options.maxTokens;
    if (options.responseFormat) completionOptions.response_format = options.responseFormat;

    const response = await this.openaiClient.chat.completions.create(completionOptions);
    
    return {
      content: response.choices[0].message.content || '',
      provider: 'openai',
      model: 'gpt-4o'
    };
  }

  /**
   * Generate embedding using configured embedding model
   */
  async generateEmbedding(userId: number, text: string): Promise<number[]> {
    // For now, use OpenAI for embeddings as it's most reliable
    // TODO: Add support for other embedding providers based on user config
    if (!this.openaiClient) {
      throw new Error('OpenAI client not available for embeddings');
    }

    const response = await this.openaiClient.embeddings.create({
      input: text,
      model: "text-embedding-ada-002"
    });

    return response.data[0].embedding;
  }
}

export const dynamicAiService = new DynamicAiService();