import { google } from 'googleapis';
import { db } from '../db';
import { emailAccounts } from '@shared/schema';
import { eq } from 'drizzle-orm';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key';

/**
 * Service for handling OAuth authentication for email accounts
 */
export class OAuthService {
  // Redirect URL for OAuth flow
  private redirectUrl = process.env.OAUTH_REDIRECT_URL || 'http://localhost:5000/api/oauth/callback';
  
  /**
   * Get OAuth URL for Gmail
   */
  getGmailOAuthUrl(userId: number, emailAddress: string): string {
    const oauth2Client = this.createOAuth2Client();
    
    // Generate state token to verify callback
    const state = Buffer.from(JSON.stringify({ 
      userId, 
      emailAddress, 
      provider: 'gmail',
      timestamp: Date.now()
    })).toString('base64');
    
    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://mail.google.com/'],
      prompt: 'consent', // Force consent screen to get refresh token
      state
    });
    
    return authUrl;
  }
  
  /**
   * Handle Gmail OAuth callback
   */
  async handleGmailOAuthCallback(code: string, state: string): Promise<any> {
    try {
      // Verify and decode state
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      
      // Validate state data
      if (!stateData.userId || !stateData.emailAddress || stateData.provider !== 'gmail') {
        throw new Error('Invalid OAuth state');
      }
      
      // Verify timestamp is not too old (prevent replay attacks)
      const stateAge = Date.now() - stateData.timestamp;
      if (stateAge > 3600000) { // 1 hour max
        throw new Error('OAuth state expired');
      }
      
      // Get tokens from code
      const oauth2Client = this.createOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);
      
      if (!tokens.access_token) {
        throw new Error('No access token received');
      }
      
      // Encrypt tokens for storage
      const encryptedTokens = this.encryptOAuthTokens(tokens);
      
      // Find if account already exists
      const existingAccounts = await db
        .select()
        .from(emailAccounts)
        .where(eq(emailAccounts.emailAddress, stateData.emailAddress));
      
      if (existingAccounts.length > 0) {
        // Update existing account
        const account = existingAccounts[0];
        
        await db
          .update(emailAccounts)
          .set({
            authMethod: 'oauth',
            credentials: encryptedTokens,
            updatedAt: new Date()
          })
          .where(eq(emailAccounts.id, account.id));
          
        return { accountId: account.id, email: stateData.emailAddress };
      } else {
        // Create new account
        const displayName = `Gmail (${stateData.emailAddress})`;
        
        const [newAccount] = await db
          .insert(emailAccounts)
          .values({
            userId: stateData.userId,
            accountType: 'gmail',
            authMethod: 'oauth',
            emailAddress: stateData.emailAddress,
            displayName,
            credentials: encryptedTokens,
            isActive: true,
            syncEnabled: true
          })
          .returning();
          
        return { accountId: newAccount.id, email: stateData.emailAddress };
      }
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      throw error;
    }
  }
  
  /**
   * Refresh OAuth access token
   */
  async refreshAccessToken(accountId: number): Promise<string | null> {
    try {
      // Get account
      const accounts = await db
        .select()
        .from(emailAccounts)
        .where(eq(emailAccounts.id, accountId));
      
      if (accounts.length === 0) {
        throw new Error(`Account with ID ${accountId} not found`);
      }
      
      const account = accounts[0];
      
      if (account.authMethod !== 'oauth') {
        throw new Error(`Account ${accountId} is not using OAuth`);
      }
      
      // Decrypt tokens
      const decryptedTokens = this.decryptOAuthTokens(account.credentials);
      
      if (!decryptedTokens.refresh_token) {
        throw new Error('No refresh token available');
      }
      
      // Create OAuth client and refresh token
      const oauth2Client = this.createOAuth2Client();
      oauth2Client.setCredentials({
        refresh_token: decryptedTokens.refresh_token
      });
      
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update stored credentials
      const updatedTokens = {
        access_token: credentials.access_token,
        refresh_token: decryptedTokens.refresh_token, // Keep existing refresh token
        expiry_date: credentials.expiry_date
      };
      
      const encryptedTokens = this.encryptOAuthTokens(updatedTokens);
      
      await db
        .update(emailAccounts)
        .set({
          credentials: encryptedTokens,
          updatedAt: new Date()
        })
        .where(eq(emailAccounts.id, accountId));
      
      return credentials.access_token || null;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      return null;
    }
  }
  
  /**
   * Create OAuth2 client for Google API
   */
  private createOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured');
    }
    
    return new google.auth.OAuth2(clientId, clientSecret, this.redirectUrl);
  }
  
  /**
   * Encrypt OAuth tokens for storage
   */
  private encryptOAuthTokens(tokens: any): string {
    const tokenStr = JSON.stringify(tokens);
    return CryptoJS.AES.encrypt(tokenStr, ENCRYPTION_KEY).toString();
  }
  
  /**
   * Decrypt OAuth tokens
   */
  private decryptOAuthTokens(encryptedTokens: any): any {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedTokens, ENCRYPTION_KEY);
      const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decryptedStr);
    } catch (error) {
      console.error('Error decrypting OAuth tokens:', error);
      return {};
    }
  }
}

export const oauthService = new OAuthService();