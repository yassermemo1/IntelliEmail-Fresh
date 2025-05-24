import { Router, Request, Response } from 'express';
import { db } from '../db';
import { emailAccounts } from '@shared/schema';
import { eq } from 'drizzle-orm';
import CryptoJS from 'crypto-js';

const router = Router();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key';

// Get all email accounts for the current user
router.get('/', async (req: Request, res: Response) => {
  try {
    // In a real app, userId would come from authenticated session
    const userId = 1;
    
    const accounts = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.userId, userId));
    
    res.json(accounts);
  } catch (error) {
    console.error('Error fetching email accounts:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get a specific email account by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.id);
    
    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, accountId));
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.json(account);
  } catch (error) {
    console.error('Error fetching email account:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Add a new email account
router.post('/', async (req: Request, res: Response) => {
  try {
    // In a real app, userId would come from authenticated session
    const userId = 1;
    
    const { 
      accountType, 
      authMethod, 
      emailAddress, 
      password 
    } = req.body;
    
    // Validate required fields
    if (!accountType || !authMethod || !emailAddress) {
      return res.status(400).json({
        error: 'Missing required fields: accountType, authMethod, and emailAddress are required'
      });
    }
    
    // Validate auth method has necessary credentials
    if ((authMethod === 'app_password' || authMethod === 'basic') && !password) {
      return res.status(400).json({
        error: 'Password is required for this authentication method'
      });
    }
    
    // Encrypt the password
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify({ password }), 
      ENCRYPTION_KEY
    ).toString();
    
    // Create the account
    const [newAccount] = await db
      .insert(emailAccounts)
      .values({
        userId,
        accountType,
        authMethod,
        emailAddress,
        credentials: encrypted,
        isActive: true,
        syncEnabled: true
      })
      .returning();
    
    res.status(201).json(newAccount);
  } catch (error) {
    console.error('Error creating email account:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update an email account
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.id);
    const { 
      displayName,
      isActive,
      syncEnabled,
      password
    } = req.body;
    
    // Get the existing account
    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, accountId));
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Prepare update data
    const updateData: any = {};
    
    if (displayName !== undefined) updateData.displayName = displayName;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (syncEnabled !== undefined) updateData.syncEnabled = syncEnabled;
    
    // Handle password update
    if (password) {
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify({ password }), 
        ENCRYPTION_KEY
      ).toString();
      
      updateData.credentials = encrypted;
    }
    
    // Update the account
    const [updatedAccount] = await db
      .update(emailAccounts)
      .set(updateData)
      .where(eq(emailAccounts.id, accountId))
      .returning();
    
    res.json(updatedAccount);
  } catch (error) {
    console.error('Error updating email account:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete an email account
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.id);
    
    // Check if account exists
    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, accountId));
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Delete the account
    await db
      .delete(emailAccounts)
      .where(eq(emailAccounts.id, accountId));
    
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting email account:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Sync emails for an account
router.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.id);
    
    // Find the account
    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.id, accountId));
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // For this endpoint, we'd normally call the appropriate sync service
    // But we'll just return a success message for now
    res.json({
      success: true,
      message: `Started syncing emails for account ${account.emailAddress}`,
      emailsProcessed: 0 
    });
  } catch (error) {
    console.error('Error syncing account:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;