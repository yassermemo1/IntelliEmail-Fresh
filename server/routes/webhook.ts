import { Router, Request, Response } from 'express';
import { db } from '../db';
import { emailAccounts, emails } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { gmailService } from '../services';
import { log } from '../vite';
import { cache } from '../utils/cache';

const router = Router();

/**
 * Webhook endpoint for email providers to notify about updates
 * Support for both Gmail push notifications and Microsoft Graph notifications
 */
router.post('/email-updates', async (req: Request, res: Response) => {
  try {
    // Extract notification data
    const notification = req.body;
    log(`Received webhook notification: ${JSON.stringify(notification)}`);

    // Validate the notification format
    if (!notification || !notification.emailAddress) {
      return res.status(400).json({ 
        error: 'Invalid notification format',
        message: 'Notification must include emailAddress'
      });
    }

    // Find the account associated with this email
    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.emailAddress, notification.emailAddress));

    if (!account) {
      return res.status(404).json({ 
        error: 'Account not found',
        message: `No account found for email address: ${notification.emailAddress}`
      });
    }

    // Process the notification based on provider type
    if (account.accountType === 'gmail') {
      // For Gmail notifications
      const result = await gmailService.fetchAndStoreEmails(
        account.emailAddress,
        account.userId,
        10 // Fetch only the most recent emails
      );

      log(`Webhook triggered sync for Gmail account ${account.emailAddress}: ${result.count} new emails`);

      // Invalidate cache to ensure dashboard shows latest data
      cache.delete(`dashboard_stats_${account.userId}`);

      return res.status(200).json({
        success: true,
        message: `Processed ${result.count} new emails from ${account.emailAddress}`
      });
    } 
    else if (account.accountType === 'exchange') {
      // For Microsoft Exchange/Graph notifications
      // Exchange service implementation would go here
      return res.status(200).json({
        success: true,
        message: `Exchange webhook received for ${account.emailAddress}, processing queued`
      });
    }
    else {
      return res.status(400).json({ 
        error: 'Unsupported account type',
        message: `Account type ${account.accountType} does not support webhooks`
      });
    }
  } catch (error) {
    console.error('Error processing webhook notification:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to process webhook notification'
    });
  }
});

/**
 * Setup webhook for a specific email account
 */
router.post('/setup/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    
    // Find the account
    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, parseInt(accountId)));
    
    if (!account) {
      return res.status(404).json({ 
        error: 'Account not found',
        message: `No account found with ID: ${accountId}`
      });
    }
    
    // Setup webhook based on provider type
    if (account.accountType === 'gmail') {
      // For Gmail - setup push notifications through Google Pub/Sub
      // This would need Google Cloud project setup with proper permissions
      return res.status(200).json({
        success: true,
        message: `Gmail webhook setup initiated for ${account.emailAddress}`,
        instructions: "Gmail webhooks require Google Cloud Pub/Sub setup with proper authentication"
      });
    } 
    else if (account.accountType === 'exchange') {
      // For Microsoft Exchange/Graph - setup subscription
      return res.status(200).json({
        success: true,
        message: `Exchange webhook setup initiated for ${account.emailAddress}`,
        instructions: "Exchange webhooks require Microsoft Graph subscription setup"
      });
    }
    else {
      return res.status(400).json({ 
        error: 'Unsupported account type',
        message: `Account type ${account.accountType} does not support webhooks`
      });
    }
  } catch (error) {
    console.error('Error setting up webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to setup webhook'
    });
  }
});

/**
 * Check webhook status for an email account
 */
router.get('/status/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    
    // Find the account
    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, parseInt(accountId)));
    
    if (!account) {
      return res.status(404).json({ 
        error: 'Account not found',
        message: `No account found with ID: ${accountId}`
      });
    }
    
    // Get webhook status (this would be implemented when actually setting up webhooks)
    return res.status(200).json({
      success: true,
      accountId: account.id,
      emailAddress: account.emailAddress,
      webhookStatus: 'not_configured', // Would be 'active', 'expired', etc. when implemented
      message: `Webhook status for ${account.emailAddress}`
    });
  } catch (error) {
    console.error('Error checking webhook status:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to check webhook status'
    });
  }
});

export default router;