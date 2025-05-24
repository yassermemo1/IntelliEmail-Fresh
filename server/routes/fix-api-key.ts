import { Request, Response, Router } from 'express';
import { storage } from '../storage';
import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * Special route to fix API key validation issues
 * This route bypasses client-side validation and handles any API key format
 */
router.post('/update-openai-key', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API key is required'
      });
    }
    
    // Log key info for debugging (first 10 chars only for security)
    const logFile = path.join(process.cwd(), 'api-key-update.log');
    fs.writeFileSync(logFile, `Attempting to update OpenAI API key: ${apiKey.slice(0, 10)}...`);
    
    // Test the key directly with OpenAI
    try {
      const openai = new OpenAI({ apiKey });
      const response = await openai.models.list();
      
      if (response && Array.isArray(response.data)) {
        const modelCount = response.data.length;
        fs.appendFileSync(logFile, `\nAPI key is valid! Found ${modelCount} models`);
        
        // Get user from session
        const userId = req.session?.user?.id || 1; // Default to user ID 1 for testing
        
        // Update settings with the new API key
        const settings = await storage.getAiSettings(userId);
        
        if (settings) {
          // Update existing settings
          await storage.updateAiSettings(userId, { 
            openaiApiKey: apiKey,
            selectedProvider: 'openai' // Automatically select OpenAI as the provider
          });
          fs.appendFileSync(logFile, `\nSuccessfully updated settings for user ${userId}`);
        } else {
          // Create new settings if none exist
          fs.appendFileSync(logFile, `\nNo existing settings found for user ${userId}, creating new settings`);
          // Note: In practice, you should use the insertAiSettingsSchema here
          await storage.updateAiSettings(userId, {
            openaiApiKey: apiKey,
            selectedProvider: 'openai',
            llmProvider: 'openai' as any,
            confidenceThreshold: 70
          });
        }
        
        return res.json({
          success: true,
          message: `API key is valid! Found ${modelCount} models`,
          provider: 'openai',
          modelCount
        });
      } else {
        fs.appendFileSync(logFile, `\nAPI key validation failed - unexpected response format`);
        return res.status(400).json({
          success: false,
          message: 'API key validation failed - unexpected response format'
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      fs.appendFileSync(logFile, `\nAPI key validation error: ${errorMsg}`);
      
      return res.status(400).json({
        success: false,
        message: `API key validation error: ${errorMsg}`
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Error updating API key:', errorMsg);
    
    return res.status(500).json({
      success: false,
      message: errorMsg
    });
  }
});

/**
 * Get current API key status
 */
router.get('/key-status', async (req: Request, res: Response) => {
  try {
    const userId = req.session?.user?.id || 1; // Default to user ID 1 for testing
    const settings = await storage.getAiSettings(userId);
    
    if (!settings) {
      return res.json({
        hasOpenAiKey: false,
        hasAnthropicKey: false,
        hasPerplexityKey: false,
        selectedProvider: null
      });
    }
    
    return res.json({
      hasOpenAiKey: !!settings.openaiApiKey,
      hasAnthropicKey: !!settings.anthropicApiKey,
      hasPerplexityKey: !!settings.perplexityApiKey,
      selectedProvider: settings.selectedProvider
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Error getting key status:', errorMsg);
    
    return res.status(500).json({
      error: errorMsg
    });
  }
});

export default router;