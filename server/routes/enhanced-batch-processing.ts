import { Router } from 'express';
import { Request, Response } from 'express';
import { enhancedTaskExtractionService } from '../services/enhancedTaskExtraction';

const router = Router();

/**
 * Trigger enhanced batch processing of emails for task extraction
 * This route processes a batch of emails using our enhanced AI model
 * with detailed task extraction and classification capabilities
 */
router.post('/process-batch', async (req: Request, res: Response) => {
  try {
    const { 
      limit = 10,
      daysBack = null,
      unprocessedOnly = true,
      specificEmailIds = []
    } = req.body;
    
    console.log('Enhanced batch processing requested with options:', {
      limit,
      daysBack: daysBack || 'all time',
      unprocessedOnly,
      specificEmailIds: specificEmailIds.length > 0 ? specificEmailIds : 'none'
    });
    
    // If specific email IDs were provided, process only those
    if (specificEmailIds && specificEmailIds.length > 0) {
      const results = {
        processed: 0,
        taskCount: 0,
        emailResults: []
      };
      
      for (const emailId of specificEmailIds) {
        try {
          console.log(`Processing specified email ID: ${emailId}`);
          
          // Extract task data
          const extractionResult = await enhancedTaskExtractionService.extractEnhancedTasksFromEmail(emailId);
          
          let emailResult: any = {
            emailId,
            status: 'processed'
          };
          
          // Skip non-actionable emails
          if (extractionResult.email_classification) {
            console.log(`Email ID ${emailId} classified as ${extractionResult.email_classification}: ${extractionResult.explanation}`);
            emailResult.classification = extractionResult.email_classification;
            emailResult.explanation = extractionResult.explanation;
            emailResult.tasksCreated = 0;
          } else {
            // Create tasks from extraction
            const tasksCreated = await enhancedTaskExtractionService.createTasksFromEnhancedExtraction(emailId);
            
            results.taskCount += tasksCreated;
            emailResult.tasksCreated = tasksCreated;
            emailResult.taskData = extractionResult.tasks || [];
          }
          
          results.processed++;
          results.emailResults.push(emailResult);
        } catch (emailError: any) {
          console.error(`Error processing email ID ${emailId}:`, emailError);
          results.emailResults.push({
            emailId,
            status: 'error',
            error: emailError.message
          });
        }
      }
      
      return res.json({
        success: true,
        message: `Processed ${results.processed} specified emails and created ${results.taskCount} tasks`,
        data: results
      });
    } else {
      // Process a batch based on the provided options
      const result = await enhancedTaskExtractionService.processBatchEmails({
        limit: parseInt(limit.toString()),
        daysBack: daysBack ? parseInt(daysBack.toString()) : null,
        unprocessedOnly: !!unprocessedOnly
      });
      
      return res.json({
        success: true,
        message: `Successfully processed ${result.processed} emails and created ${result.taskCount} tasks`,
        data: result
      });
    }
  } catch (error: any) {
    console.error('Enhanced batch processing failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Enhanced batch processing failed',
      error: error.message
    });
  }
});

/**
 * Process a single email with the enhanced task extraction
 */
router.post('/process-email/:id', async (req: Request, res: Response) => {
  try {
    const emailId = parseInt(req.params.id);
    
    if (isNaN(emailId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email ID'
      });
    }
    
    console.log(`Processing single email ID ${emailId} with enhanced extraction`);
    
    // Extract task data
    const extractionResult = await enhancedTaskExtractionService.extractEnhancedTasksFromEmail(emailId);
    
    // For non-actionable emails, just return the classification
    if (extractionResult.email_classification) {
      return res.json({
        success: true,
        emailId,
        classification: extractionResult.email_classification,
        explanation: extractionResult.explanation,
        tasksCreated: 0
      });
    }
    
    // Create tasks from extraction
    const tasksCreated = await enhancedTaskExtractionService.createTasksFromEnhancedExtraction(emailId);
    
    return res.json({
      success: true,
      emailId,
      tasksCreated,
      taskData: extractionResult.tasks || []
    });
  } catch (error: any) {
    console.error(`Error in processing email:`, error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process email',
      error: error.message
    });
  }
});

export default router;