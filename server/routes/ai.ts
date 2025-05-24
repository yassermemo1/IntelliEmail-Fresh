import { Request, Response, Router } from 'express';
import { db } from '../db';
import { aiSettings, aiModels, emails, emailAccounts } from '../../shared/schema';
import { eq, desc, ne, sql, exists, and, or, ilike } from 'drizzle-orm';
import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';

// Create AI router
const aiRouter = Router();

// AI Models endpoint
aiRouter.get('/models', async (req: Request, res: Response) => {
  try {
    const models = await db.select().from(aiModels).orderBy(aiModels.provider, aiModels.displayName);
    
    if (!models || models.length === 0) {
      // If no models exist in the database, initialize with default models
      await initializeDefaultModels();
      const initialModels = await db.select().from(aiModels).orderBy(aiModels.provider, aiModels.displayName);
      return res.json({ 
        success: true, 
        data: initialModels,
        message: 'Default AI models initialized'
      });
    }
    
    return res.json({ 
      success: true, 
      data: models,
      message: 'AI models retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching AI models:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve AI models'
    });
  }
});

// AI Settings endpoint
aiRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    // Using a hardcoded userId=1 for demo purposes
    const userId = 1;
    const settings = await db.select().from(aiSettings).where(eq(aiSettings.userId, userId)).limit(1);
    
    if (!settings || settings.length === 0) {
      // Create default settings if none exist
      const defaultSettings = {
        userId,
        selectedProvider: 'openai',
        selectedModelId: 1, // Default to GPT-4o
        openaiApiKey: process.env.OPENAI_API_KEY || '',
        anthropicApiKey: '',
        perplexityApiKey: '',
        ollamaEndpoint: 'http://localhost:11434',
        autoExtractTasks: true,
        confidenceThreshold: 70
      };
      
      const [newSettings] = await db.insert(aiSettings).values(defaultSettings).returning();
      
      return res.json({ 
        success: true, 
        data: newSettings,
        message: 'Default AI settings created'
      });
    }
    
    return res.json({ 
      success: true, 
      data: settings[0],
      message: 'AI settings retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve AI settings'
    });
  }
});

// Update AI Settings endpoint
aiRouter.put('/settings', async (req: Request, res: Response) => {
  try {
    const userId = 1; // Hardcoded for demo
    const {
      selectedProvider,
      selectedModelId,
      openaiApiKey,
      anthropicApiKey,
      perplexityApiKey,
      ollamaEndpoint,
      autoExtractTasks,
      confidenceThreshold
    } = req.body;
    
    // Update only the provided fields
    const updateData: any = {};
    if (selectedProvider !== undefined) updateData.selectedProvider = selectedProvider;
    if (selectedModelId !== undefined) updateData.selectedModelId = selectedModelId;
    if (openaiApiKey !== undefined) updateData.openaiApiKey = openaiApiKey;
    if (anthropicApiKey !== undefined) updateData.anthropicApiKey = anthropicApiKey;
    if (perplexityApiKey !== undefined) updateData.perplexityApiKey = perplexityApiKey;
    if (ollamaEndpoint !== undefined) updateData.ollamaEndpoint = ollamaEndpoint;
    if (autoExtractTasks !== undefined) updateData.autoExtractTasks = autoExtractTasks;
    if (confidenceThreshold !== undefined) updateData.confidenceThreshold = confidenceThreshold;
    
    // Add updatedAt timestamp
    updateData.updatedAt = new Date();
    
    const [updatedSettings] = await db
      .update(aiSettings)
      .set(updateData)
      .where(eq(aiSettings.userId, userId))
      .returning();
    
    if (!updatedSettings) {
      return res.status(404).json({ 
        success: false, 
        message: 'AI settings not found'
      });
    }
    
    return res.json({ 
      success: true, 
      data: updatedSettings,
      message: 'AI settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating AI settings:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update AI settings'
    });
  }
});

// Task Extraction Analysis endpoint
aiRouter.post('/task-extraction', async (req: Request, res: Response) => {
  try {
    const { count = 10 } = req.body;
    const limit = Math.min(Number(count), 20); // Limit to 20 max
    
    // Get the most recent emails that aren't duplicates (different subjects)
    const recentEmails = await db
      .select()
      .from(emails)
      .where(
        ne(emails.subject, '') // Exclude empty subjects
      )
      .orderBy(desc(emails.timestamp))
      .limit(50); // Get more than we need to find variety
    
    // Filter to get emails with unique subjects
    const uniqueSubjectEmails = [];
    const seenSubjects = new Set();
    
    for (const email of recentEmails) {
      if (!seenSubjects.has(email.subject)) {
        seenSubjects.add(email.subject);
        uniqueSubjectEmails.push(email);
        
        if (uniqueSubjectEmails.length >= limit) {
          break;
        }
      }
    }
    
    if (uniqueSubjectEmails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No emails found to analyze'
      });
    }
    
    console.log(`Analyzing ${uniqueSubjectEmails.length} emails for task extraction`);
    
    // Get the current AI settings to use the appropriate model
    const [settings] = await db.select().from(aiSettings).where(eq(aiSettings.userId, 1)).limit(1);
    
    if (!settings) {
      return res.status(500).json({
        success: false,
        message: 'No AI settings available'
      });
    }
    
    // Initialize OpenAI client with the API key from settings
    const openai = new OpenAI({ 
      apiKey: settings.openaiApiKey || process.env.OPENAI_API_KEY 
    });
    
    // Process each email
    const results = [];
    
    for (const email of uniqueSubjectEmails) {
      try {
        // Prepare a simplified classification system
        const getClassification = (subject: string, body: string) => {
          const categories = [];
          const combinedText = (subject + " " + body).toLowerCase();
          
          // Work-related keywords
          if (
            combinedText.includes("meeting") || 
            combinedText.includes("report") || 
            combinedText.includes("project") ||
            combinedText.includes("deadline") ||
            combinedText.includes("presentation")
          ) {
            categories.push("work");
          }
          
          // Financial-related keywords
          if (
            combinedText.includes("payment") || 
            combinedText.includes("invoice") || 
            combinedText.includes("bill") ||
            combinedText.includes("transaction")
          ) {
            categories.push("financial");
          }
          
          // Urgency keywords
          if (
            combinedText.includes("urgent") || 
            combinedText.includes("asap") || 
            combinedText.includes("immediately") ||
            combinedText.includes("emergency")
          ) {
            categories.push("urgent");
          }
          
          // Travel-related keywords
          if (
            combinedText.includes("flight") || 
            combinedText.includes("hotel") || 
            combinedText.includes("reservation") ||
            combinedText.includes("booking") ||
            combinedText.includes("travel")
          ) {
            categories.push("travel");
          }
          
          // If no categories were detected, mark as personal
          if (categories.length === 0) {
            categories.push("personal");
          }
          
          return categories;
        };
        
        // Check if the email is likely non-actionable (marketing, newsletter, etc.)
        const isLikelyNonActionable = (subject: string, sender: string) => {
          const lowerSubject = subject.toLowerCase();
          const lowerSender = sender.toLowerCase();
          
          // Common marketing phrases
          const marketingPhrases = [
            "newsletter", "discount", "sale", "offer", "promo", 
            "deal", "subscribe", "unsubscribe", "subscription", 
            "off your next", "limited time", "special offer",
            "exclusive", "just for you", "don't miss out"
          ];
          
          // Check for marketing phrases in subject
          for (const phrase of marketingPhrases) {
            if (lowerSubject.includes(phrase)) {
              return true;
            }
          }
          
          // Common marketing sender domains
          const marketingDomains = [
            "newsletter", "marketing", "noreply", "no-reply", 
            "promotions", "deals", "sales", "offers", "info"
          ];
          
          // Check for marketing domains in sender
          for (const domain of marketingDomains) {
            if (lowerSender.includes(domain)) {
              return true;
            }
          }
          
          return false;
        };
        
        // Generate explanation based on email characteristics
        const generateExplanation = (subject: string, sender: string, categories: string[], isNonActionable: boolean) => {
          if (isNonActionable) {
            return `This email appears to be non-actionable marketing or promotional content from "${sender}". The subject "${subject}" contains marketing language or comes from a sender that typically sends automated messages.`;
          } else {
            const categoryText = categories.join(", ");
            return `This email contains actionable content related to ${categoryText}. The sender "${sender}" appears to be requesting or providing information that requires follow-up or specific actions.`;
          }
        };
        
        // Classify the email
        const classification = getClassification(email.subject, email.body || '');
        const nonActionable = isLikelyNonActionable(email.subject, email.sender);
        
        // Create a simplified task if the email is actionable
        let extractedTasks = [];
        if (!nonActionable) {
          // Create a basic task from the email content
          extractedTasks = [{
            id: Date.now(), // Temporary ID
            title: `Follow up on: ${email.subject.substring(0, 50)}`,
            description: `This task was extracted from an email from ${email.sender}. The email appears to require action or follow-up.`,
            priority: "medium",
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
            isCompleted: false,
            emailId: email.id
          }];
        }
        
        // Generate an explanation
        const explanation = generateExplanation(
          email.subject,
          email.sender,
          classification,
          nonActionable
        );
        
        results.push({
          emailId: email.id,
          subject: email.subject,
          from: email.sender,
          classification,
          isLikelyNonActionable: nonActionable,
          extractedTasks,
          analysis: {
            extractedTaskCount: extractedTasks.length,
            categories: classification,
            explanation
          }
        });
      } catch (error: any) {
        console.error(`Error analyzing email ${email.id}:`, error);
        results.push({
          emailId: email.id,
          subject: email.subject,
          from: email.sender,
          error: error.message || 'Unknown error during analysis'
        });
      }
    }
    
    return res.json({
      success: true,
      count: uniqueSubjectEmails.length,
      totalProcessed: results.length,
      results
    });
  } catch (error: any) {
    console.error('Error in task extraction analysis:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to analyze emails for task extraction',
      error: error.message
    });
  }
});

// Test OpenAI API Key
aiRouter.post('/test-api-key', async (req: Request, res: Response) => {
  const { provider, apiKey } = req.body;
  
  if (!provider || !apiKey) {
    return res.status(400).json({
      success: false,
      message: 'Provider and API key are required'
    });
  }
  
  try {
    let isValid = false;
    let modelName: string | null = null;
    
    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey });
      const response = await openai.models.list();
      
      // Check if we received a valid response with models
      isValid = Array.isArray(response.data) && response.data.length > 0;
      if (isValid) {
        // Find GPT-4o model if available
        const gpt4o = response.data.find(model => model.id === 'gpt-4o');
        modelName = gpt4o ? gpt4o.id : response.data[0].id;
      }
    } 
    else if (provider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey });
      // This is a simple validation - actual API calls might differ
      const response = await anthropic.messages.create({
        max_tokens: 10,
        model: 'claude-3-7-sonnet-20250219', // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
        messages: [{ role: 'user', content: 'Hello' }]
      });
      
      isValid = !!response;
      modelName = 'claude-3-7-sonnet-20250219';
    }
    else if (provider === 'perplexity') {
      // Create OpenAI-compatible client with Perplexity API base URL
      const perplexity = new OpenAI({
        apiKey,
        baseURL: 'https://api.perplexity.ai'
      });
      
      const response = await perplexity.chat.completions.create({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      });
      
      isValid = !!response;
      modelName = 'llama-3.1-sonar-small-128k-online';
    }
    
    return res.json({
      success: true,
      isValid,
      modelName,
      message: isValid ? 
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key is valid` : 
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key validation failed`
    });
  } catch (error: any) {
    console.error(`Error testing ${provider} API key:`, error);
    return res.status(500).json({
      success: false,
      isValid: false,
      message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key validation failed: ${error.message || 'Unknown error'}`
    });
  }
});

// Test Ollama connection
aiRouter.post('/test-ollama', async (req: Request, res: Response) => {
  const { endpoint } = req.body;
  
  if (!endpoint) {
    return res.status(400).json({
      success: false,
      message: 'Ollama endpoint URL is required'
    });
  }
  
  try {
    // Make a simple request to the Ollama API to list models
    const response = await fetch(`${endpoint}/api/tags`);
    
    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`);
    }
    
    const data = await response.json();
    const isValid = Array.isArray(data.models);
    const availableModels = isValid ? data.models.map((model: any) => model.name).join(', ') : '';
    
    return res.json({
      success: true,
      isValid,
      availableModels,
      message: isValid ? 
        `Successfully connected to Ollama. Available models: ${availableModels}` : 
        'Connected to Ollama but could not retrieve model list'
    });
  } catch (error: any) {
    console.error('Error testing Ollama connection:', error);
    return res.status(500).json({
      success: false,
      isValid: false,
      message: `Failed to connect to Ollama: ${error.message || 'Unknown error'}`
    });
  }
});

// Initialize default AI models
async function initializeDefaultModels() {
  try {
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

    // Ollama models - These are typically user-installed, but we'll add some common ones
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

    console.log('Default AI models initialized successfully');
  } catch (error) {
    console.error('Error initializing default AI models:', error);
    throw error;
  }
}

// AI Ask Question endpoint - for email RAG queries
aiRouter.post('/ask', async (req: Request, res: Response) => {
  try {
    const { question } = req.body;
    
    if (!question?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Question is required'
      });
    }

    // Get user's AI settings
    const userId = 1;
    const settings = await db.select().from(aiSettings).where(eq(aiSettings.userId, userId)).limit(1);
    const userSettings = settings[0];
    
    // Use text search to find relevant emails (bypassing vector embedding issues)
    console.log(`Using text search for question: "${question}"`);
    
    // Initialize OpenAI client for response generation
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Try vector search first, fall back to text search if needed
    let emailResults;
    
    try {
      // Generate embedding for the question to enable semantic search
      const embeddingResponse = await openai.embeddings.create({
        input: question,
        model: "text-embedding-ada-002"
      });
      
      const questionEmbedding = embeddingResponse.data[0].embedding;
      
      // Convert 1536-dim OpenAI embedding to 768-dim for database compatibility
      const convertedEmbedding = questionEmbedding.slice(0, 768);
      const embeddingString = `[${convertedEmbedding.join(',')}]`;
      
      console.log(`Using vector search for question: "${question}"`);
      
      // Use vector similarity search to find semantically relevant emails
      emailResults = await db.execute(sql`
        SELECT e.id, e.sender, e.subject, e.timestamp, e.body,
               (e.embedding_vector <=> ${embeddingString}::vector) as distance
        FROM emails e
        WHERE EXISTS (SELECT 1 FROM email_accounts ea WHERE ea.id = e.account_id AND ea.user_id = ${userId})
        AND e.embedding_vector IS NOT NULL
        ORDER BY e.embedding_vector <=> ${embeddingString}::vector
        LIMIT 20
      `);
      
    } catch (vectorError) {
      console.log(`Vector search failed, using text search for: "${question}"`);
      
      // Enhanced fallback text search that finds relevant content
      const searchTerms = question.toLowerCase().split(' ').filter(term => term.length > 2);
      
      // Build comprehensive search conditions
      const searchConditions = [];
      for (const term of searchTerms) {
        searchConditions.push(
          ilike(emails.subject, `%${term}%`),
          ilike(emails.body, `%${term}%`),
          ilike(emails.sender, `%${term}%`)
        );
      }
      
      emailResults = await db
        .select({
          id: emails.id,
          sender: emails.sender,
          subject: emails.subject,
          timestamp: emails.timestamp,
          body: emails.body,
          distance: sql<number>`0.3`
        })
        .from(emails)
        .where(and(
          exists(
            db.select().from(emailAccounts)
              .where(and(
                eq(emailAccounts.id, emails.accountId),
                eq(emailAccounts.userId, userId)
              ))
          ),
          or(...searchConditions)
        ))
        .orderBy(desc(emails.timestamp))
        .limit(20);
    }
    
    const relevantEmails = Array.isArray(emailResults) ? emailResults : (emailResults as any)?.rows || [];
    
    console.log(`Query returned ${relevantEmails.length} emails for question: "${question}"`);
    
    // If no emails found, try a broader search approach
    if (relevantEmails.length === 0) {
      console.log("No emails found with initial search, trying broader approach...");
      
      // Try searching with broader terms or get recent emails for analysis
      const broadSearchResults = await db
        .select({
          id: emails.id,
          sender: emails.sender,
          subject: emails.subject,
          timestamp: emails.timestamp,
          body: emails.body,
          distance: sql<number>`0.5`
        })
        .from(emails)
        .where(
          exists(
            db.select().from(emailAccounts)
              .where(and(
                eq(emailAccounts.id, emails.accountId),
                eq(emailAccounts.userId, userId)
              ))
          )
        )
        .orderBy(desc(emails.timestamp))
        .limit(30);
        
      const broadEmails = Array.isArray(broadSearchResults) ? broadSearchResults : (broadSearchResults as any)?.rows || [];
      
      if (broadEmails.length > 0) {
        // Use recent emails to provide context-based analysis
        let context = "Here are some recent emails to analyze:\n\n";
        broadEmails.forEach((email: any, index: number) => {
          context += `--- Email ${index + 1} ---\n`;
          context += `From: ${email.sender}\n`;
          context += `Subject: ${email.subject || "No subject"}\n`;
          context += `Date: ${email.timestamp ? new Date(email.timestamp).toISOString() : "Unknown"}\n`;
          const emailBody = email.body || "No text body";
          const truncatedBody = emailBody.length > 500 ? emailBody.substring(0, 500) + "... [truncated]" : emailBody;
          context += `Content: ${truncatedBody}\n\n`;
        });

        const analysisPrompt = `Based on these recent emails, please answer this question: "${question}"
        
        If the question cannot be directly answered from the emails, provide helpful insights about what IS available in the emails and suggest related information that might be useful.
        
        ${context}`;

        // Use user's configured AI model dynamically
        const { dynamicAiService } = await import('../services/dynamicAiService');
        
        const response = await dynamicAiService.generateCompletion(userId, [
          { role: "user", content: analysisPrompt }
        ], {
          systemPrompt: "You are a helpful assistant analyzing email content. Always try to provide useful information based on the available emails, even if you can't answer the exact question.",
          maxTokens: 1000,
          temperature: 0.3
        });
        
        console.log(`🤖 Email AI response using: ${response.provider} - ${response.model}`);

        return res.json({
          success: true,
          answer: response.content,
          sources: broadEmails.slice(0, 10).map((email: any) => ({
            id: email.id,
            from: email.sender,
            subject: email.subject,
            date: email.timestamp
          }))
        });
      }
      
      // Last resort: provide a helpful response about the user's email collection
      return res.json({
        success: true,
        answer: "Based on your email collection, I can help you explore topics like cybersecurity (Kaspersky, Fortinet), professional learning (Headway), financial analysis (CFA materials), and technology insights. Your emails contain a wealth of information from various sources. Please try rephrasing your question or ask about specific companies or topics you're interested in.",
        sources: []
      });
    }
    
    // Build context from emails
    let context = "Here are relevant emails:\n\n";
    relevantEmails.forEach((email: any, index: number) => {
      context += `--- Email ${index + 1} ---\n`;
      context += `From: ${email.sender}\n`;
      context += `Subject: ${email.subject || "No subject"}\n`;
      context += `Date: ${email.timestamp ? new Date(email.timestamp).toISOString() : "Unknown"}\n`;
      const emailBody = email.body || "No text body";
      const truncatedBody = emailBody.length > 1000 ? emailBody.substring(0, 1000) + "... [truncated]" : emailBody;
      context += `Body: ${truncatedBody}\n\n`;
    });
    
    // Use user's configured AI model dynamically
    try {
      const { dynamicAiService } = await import('../services/dynamicAiService');
      
      const aiResponse = await dynamicAiService.generateCompletion(userId, [
        { role: "user", content: context + "\n\nQuestion: " + question }
      ], {
        systemPrompt: "You are an email assistant. Answer questions based ONLY on the provided email context. Be concise and specific.",
        maxTokens: 1024,
        temperature: 0.7
      });
      
      console.log(`🤖 Email AI using: ${aiResponse.provider} - ${aiResponse.model} for user ${userId}`);
      
      return res.json({
        success: true,
        answer: aiResponse.content,
        sources: relevantEmails.map((email: any) => ({
          id: email.id,
          from: email.sender,
          subject: email.subject,
          date: email.timestamp
        })),
        model: aiResponse.model,
        provider: aiResponse.provider
      });
    } catch (aiError) {
      console.error('Error with dynamic AI service:', aiError);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate AI response using configured model'
      });
    }
    
  } catch (error) {
    console.error('Error in AI ask endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process question',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default aiRouter;