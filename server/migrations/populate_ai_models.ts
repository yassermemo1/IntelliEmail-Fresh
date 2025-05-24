import { db } from "../db";
import { aiModels } from "../../shared/schema";

/**
 * Migration to populate the AI models table with default models
 */
export async function populateAiModels(): Promise<boolean> {
  try {
    console.log("Checking AI models table...");
    const existingModels = await db.select().from(aiModels);
    
    if (existingModels.length > 0) {
      console.log(`Found ${existingModels.length} existing AI models, skipping population`);
      return true;
    }
    
    console.log("No AI models found, populating with defaults...");
    
    // OpenAI models
    await db.insert(aiModels).values([
      {
        provider: 'openai',
        modelId: 'gpt-4o',
        displayName: 'GPT-4o',
        description: 'Most capable multimodal model for text and vision tasks with excellent instruction following.',
        capabilities: {
          text: true,
          images: true,
          files: true,
          function_calling: true
        },
        isEmbeddingModel: false,
        isDefault: true,
        contextLength: 128000
      },
      {
        provider: 'openai',
        modelId: 'gpt-4-turbo',
        displayName: 'GPT-4 Turbo',
        description: 'Powerful large language model with strong reasoning capabilities across a wide range of tasks.',
        capabilities: {
          text: true,
          images: false,
          files: true,
          function_calling: true
        },
        isEmbeddingModel: false,
        isDefault: false,
        contextLength: 128000
      },
      {
        provider: 'openai',
        modelId: 'gpt-3.5-turbo',
        displayName: 'GPT-3.5 Turbo',
        description: 'Fast and cost-effective model for simpler tasks and basic assistant functions.',
        capabilities: {
          text: true,
          images: false,
          files: false,
          function_calling: true
        },
        isEmbeddingModel: false,
        isDefault: false,
        contextLength: 16000
      },
      {
        provider: 'openai',
        modelId: 'text-embedding-3-large',
        displayName: 'Text Embedding 3 Large',
        description: 'High-performance text embedding model for semantic search and similarity tasks.',
        capabilities: {
          embeddings: true
        },
        isEmbeddingModel: true,
        isDefault: true
      }
    ]);

    // Anthropic models
    await db.insert(aiModels).values([
      {
        provider: 'anthropic',
        modelId: 'claude-3-7-sonnet-20250219',
        displayName: 'Claude 3.7 Sonnet',
        description: 'Latest Claude model with excellent performance for a wide range of tasks.',
        capabilities: {
          text: true,
          images: true,
          files: false,
          function_calling: true
        },
        isEmbeddingModel: false,
        isDefault: true,
        contextLength: 128000
      },
      {
        provider: 'anthropic',
        modelId: 'claude-3-opus-20240229',
        displayName: 'Claude 3 Opus',
        description: 'Most powerful Claude model with superior reasoning for complex tasks.',
        capabilities: {
          text: true,
          images: true,
          files: false,
          function_calling: true
        },
        isEmbeddingModel: false,
        isDefault: false,
        contextLength: 100000
      },
      {
        provider: 'anthropic',
        modelId: 'claude-3-sonnet-20240229',
        displayName: 'Claude 3 Sonnet',
        description: 'Balanced Claude model offering good performance at a lower cost than Opus.',
        capabilities: {
          text: true,
          images: true,
          files: false,
          function_calling: true
        },
        isEmbeddingModel: false,
        isDefault: false,
        contextLength: 100000
      }
    ]);

    // Perplexity models
    await db.insert(aiModels).values([
      {
        provider: 'perplexity',
        modelId: 'llama-3.1-sonar-small-128k-online',
        displayName: 'Llama 3.1 Sonar Small',
        description: 'Fast online model with search capabilities from Perplexity.',
        capabilities: {
          text: true,
          images: false,
          search: true
        },
        isEmbeddingModel: false,
        isDefault: true,
        contextLength: 128000
      },
      {
        provider: 'perplexity',
        modelId: 'llama-3.1-sonar-large-128k-online',
        displayName: 'Llama 3.1 Sonar Large',
        description: 'More powerful online model with search capabilities from Perplexity.',
        capabilities: {
          text: true,
          images: false,
          search: true
        },
        isEmbeddingModel: false,
        isDefault: false,
        contextLength: 128000
      }
    ]);

    // Ollama models
    await db.insert(aiModels).values([
      {
        provider: 'ollama',
        modelId: 'llama3:latest',
        displayName: 'Llama 3 (Local)',
        description: 'Open-source large language model running locally via Ollama.',
        capabilities: {
          text: true,
          images: false
        },
        isEmbeddingModel: false,
        isDefault: true,
        contextLength: 8000
      },
      {
        provider: 'ollama',
        modelId: 'llama3:8b',
        displayName: 'Llama 3 (8B)',
        description: 'Lightweight Llama 3 model for faster inference on consumer hardware.',
        capabilities: {
          text: true,
          images: false
        },
        isEmbeddingModel: false,
        isDefault: false,
        contextLength: 4000
      }
    ]);

    console.log("Successfully populated AI models table with default models");
    return true;
  } catch (error) {
    console.error("Error populating AI models:", error);
    return false;
  }
}