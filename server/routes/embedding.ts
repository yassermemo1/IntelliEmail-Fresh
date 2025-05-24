import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { aiModelService } from '../services';

const router = Router();

// Initialize OpenAI with the API key from environment variables
let openai: OpenAI;
try {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (error) {
  console.error('Error initializing OpenAI:', error);
}

/**
 * Generate embedding vectors using the current model
 * Default to OpenAI Ada embedding model for consistent 1536-dimensional vectors
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    if (!openai) {
      return res.status(500).json({ error: 'OpenAI client not initialized' });
    }

    // Generate the embedding
    console.log(`Generating embedding for text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    // Get embedding from OpenAI
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });
    
    // Extract the embedding vector
    const embedding = embeddingResponse.data[0].embedding;
    
    return res.json({ 
      embedding,
      model: "text-embedding-3-small",
      dimensions: embedding.length
    });
  } catch (error) {
    console.error('Error generating embedding:', error);
    return res.status(500).json({ 
      error: 'Failed to generate embedding',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Generate embedding vectors using a specific model
 */
router.post('/generate/:modelId', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // Get model information
    const model = await aiModelService.getModelById(parseInt(modelId));
    
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    
    if (model.provider !== 'openai') {
      return res.status(400).json({ error: 'Only OpenAI embedding models are supported' });
    }
    
    if (!openai) {
      return res.status(500).json({ error: 'OpenAI client not initialized' });
    }
    
    // Generate the embedding
    console.log(`Generating embedding for text with model ${model.displayName}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    const embeddingResponse = await openai.embeddings.create({
      model: model.modelId,
      input: text,
      encoding_format: "float",
    });
    
    // Extract the embedding vector
    const embedding = embeddingResponse.data[0].embedding;
    
    return res.json({ 
      embedding,
      model: model.modelId,
      dimensions: embedding.length
    });
  } catch (error) {
    console.error('Error generating embedding with custom model:', error);
    return res.status(500).json({ 
      error: 'Failed to generate embedding',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;