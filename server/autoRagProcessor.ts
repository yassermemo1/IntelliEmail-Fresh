import { aiService } from "./services";
import { log } from "./vite";

// Configuration
const PROCESSING_INTERVAL_MS = 5 * 60 * 1000; // Process every 5 minutes
const BATCH_SIZE = 250; // Process 250 emails per batch (increased from 100)
let processingInterval: NodeJS.Timeout | null = null;
let isCurrentlyProcessing = false;

/**
 * Process emails for RAG in the background
 */
async function processEmailBatch() {
  // Prevent concurrent processing
  if (isCurrentlyProcessing) {
    log("RAG processing already in progress, skipping this cycle");
    return;
  }

  try {
    isCurrentlyProcessing = true;
    log("Starting automatic RAG email processing batch");

    // Get current processing status
    const status = await aiService.getEmbeddingStatus();
    log(`RAG Status: ${status.processedEmails}/${status.totalEmails} emails processed (${status.percentComplete}%)`);

    // If there are unprocessed emails, process a batch
    if (status.unprocessedEmails > 0) {
      const batchSize = Math.min(BATCH_SIZE, status.unprocessedEmails);
      log(`Processing batch of ${batchSize} emails for RAG`);
      
      // Process the batch
      const processedCount = await aiService.updateEmailEmbeddings(batchSize);
      
      log(`RAG processing completed for ${processedCount} emails`);
    } else {
      log("No emails pending for RAG processing");
    }
  } catch (error) {
    log(`Error in automatic RAG processing: ${(error as Error).message}`);
    console.error("Automatic RAG processing error:", error);
  } finally {
    isCurrentlyProcessing = false;
  }
}

/**
 * Start the automatic RAG processing system
 */
export function startAutoRagProcessing() {
  // Stop any existing interval
  if (processingInterval) {
    clearInterval(processingInterval);
  }

  // Initial processing after 30 seconds (to let server start up completely)
  setTimeout(() => {
    processEmailBatch();
  }, 30 * 1000);

  // Setup regular interval for processing
  processingInterval = setInterval(processEmailBatch, PROCESSING_INTERVAL_MS);
  
  log(`Automatic RAG email processing scheduled (every ${PROCESSING_INTERVAL_MS / 60000} minutes)`);
}