/**
 * Test routes for Ollama integration
 */
import express, { Request, Response } from 'express';
import { ollamaService } from '../services/ollamaService';

const router = express.Router();

/**
 * Test Ollama connection
 */
router.get('/connection', async (req: Request, res: Response) => {
  try {
    // Try a real connection to the Ollama server
    console.log('Testing Ollama connection with endpoint:', ollamaService.getEndpoint());
    
    const connected = await ollamaService.checkConnection();
    
    return res.json({
      success: connected,
      message: connected 
        ? 'Successfully connected to Ollama server' 
        : 'Failed to connect to Ollama server'
    });
  } catch (error) {
    console.error('Error testing Ollama connection:', error);
    return res.status(500).json({
      success: false,
      message: 'Error testing Ollama connection: ' + (error.message || 'Unknown error')
    });
  }
});

/**
 * Get available Ollama models
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    // Get real models from Ollama server
    const models = await ollamaService.getModels();
    
    return res.json({
      success: true,
      models: models,
      count: models.length
    });
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching Ollama models: ' + (error.message || 'Unknown error')
    });
  }
});

/**
 * Configure Ollama endpoint
 */
router.post('/configure', async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Endpoint URL is required'
      });
    }
    
    ollamaService.configure(endpoint);
    
    // Test the connection
    const connected = await ollamaService.checkConnection();
    
    return res.json({
      success: connected,
      message: connected 
        ? `Successfully connected to Ollama at ${endpoint}` 
        : `Failed to connect to Ollama at ${endpoint}`
    });
  } catch (error) {
    console.error('Error configuring Ollama connection:', error);
    return res.status(500).json({
      success: false,
      message: 'Error configuring Ollama connection'
    });
  }
});

/**
 * Test Ollama completion
 */
router.post('/completion-test', async (req: Request, res: Response) => {
  try {
    const { model, prompt } = req.body;
    
    if (!model || !prompt) {
      return res.status(400).json({
        success: false,
        message: 'Model and prompt are required'
      });
    }
    
    // Try to get a real completion from the Ollama server
    try {
      const completion = await ollamaService.generateCompletion(model, prompt);
      
      return res.json({
        success: true,
        completion: completion,
        model
      });
    } catch (ollama_error) {
      console.error('Ollama completion error:', ollama_error);
      
      return res.status(400).json({
        success: false,
        message: `Failed to generate completion: ${ollama_error.message || 'Ollama server error'}`,
        error: 'Make sure your Ollama server is running and the model is available'
      });
    }
  } catch (error) {
    console.error('Error testing Ollama completion:', error);
    return res.status(500).json({
      success: false,
      message: 'Error testing Ollama completion: ' + (error.message || 'Unknown error')
    });
  }
});

/**
 * Test task extraction from email
 */
router.post('/extract-tasks', async (req: Request, res: Response) => {
  try {
    const { model, subject, body, sender } = req.body;
    
    if (!model || !subject || !body) {
      return res.status(400).json({
        success: false,
        message: 'Model, subject, and body are required'
      });
    }
    
    const tasks = await ollamaService.extractTasks(model, subject, body, sender || 'Unknown Sender');
    
    return res.json({
      success: true,
      tasks,
      count: tasks.length,
      model
    });
  } catch (error) {
    console.error('Error extracting tasks with Ollama:', error);
    return res.status(500).json({
      success: false,
      message: 'Error extracting tasks with Ollama'
    });
  }
});

export default router;