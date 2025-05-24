import { cleanAllEmailContent } from './cleanupEmails';

// For direct testing of the cleanup process
async function runCleanup() {
  console.log('Starting email cleanup process directly');
  try {
    const result = await cleanAllEmailContent();
    console.log(`Cleanup complete: ${result.processedCount} emails processed, ${result.errorCount} errors`);
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Run the cleanup process
runCleanup();