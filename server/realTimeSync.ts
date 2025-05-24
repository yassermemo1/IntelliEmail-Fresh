import { gmailService } from './services';
import { db } from './db';
import { emailAccounts } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Check interval (2 minutes)
const CHECK_INTERVAL = 2 * 60 * 1000;

// Variable to track if a check is currently in progress
let checkInProgress = false;

/**
 * Real-time Email Sync Service
 * Handles periodic checking for new emails across all active accounts
 */
class RealTimeEmailService {
  // Reference to the interval timer
  private interval: NodeJS.Timeout | null = null;
  
  /**
   * Check for new emails across all active email accounts
   */
  async checkForNewEmails() {
    // Prevent concurrent checks
    if (checkInProgress) return;
    
    checkInProgress = true;
    console.log('Checking for new emails...');
    
    try {
      // Get all active email accounts
      const activeAccounts = await db
        .select()
        .from(emailAccounts)
        .where(eq(emailAccounts.isActive, true));
      
      if (activeAccounts.length === 0) {
        console.log('No active email accounts for real-time polling');
        checkInProgress = false;
        return;
      }
      
      let totalNewEmails = 0;
      
      // Check each account for new emails
      for (const account of activeAccounts) {
        try {
          console.log(`Checking for new emails from ${account.emailAddress}`);
          
          // Use Gmail service to fetch only new emails
          const result = await gmailService.fetchAndStoreEmails(
            account.emailAddress,
            account.userId,
            50
          );
          
          if (result.count > 0) {
            totalNewEmails += result.count;
            console.log(`Found ${result.count} new emails from ${account.emailAddress}`);
          }
        } catch (error) {
          console.error(`Error checking emails for ${account.emailAddress}:`, error);
        }
      }
      
      if (totalNewEmails > 0) {
        console.log(`Real-time check complete: Found ${totalNewEmails} new emails`);
      } else {
        console.log('Real-time check complete: No new emails found');
      }
    } catch (error) {
      console.error('Error in real-time email check:', error);
    } finally {
      checkInProgress = false;
    }
  }
  
  /**
   * Start the periodic email checking process
   */
  startRealTimeSync() {
    console.log(`Starting real-time email sync (interval: ${CHECK_INTERVAL}ms)`);
    
    // Clear any existing interval
    if (this.interval) {
      clearInterval(this.interval);
    }
    
    // Run an initial check immediately
    this.checkForNewEmails();
    
    // Set up periodic checks
    this.interval = setInterval(() => {
      this.checkForNewEmails();
    }, CHECK_INTERVAL);
    
    return true;
  }
  
  /**
   * Stop the periodic email checking process
   */
  stopRealTimeSync() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('Real-time email sync stopped');
      return true;
    }
    
    return false;
  }
}

// Create and export the service instance
export const realTimeEmailService = new RealTimeEmailService();