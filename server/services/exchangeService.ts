import { db } from "../db";
import { emails, emailAccounts } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { encryptData, decryptData } from "../utils/encryption";
import axios from "axios";
import { parseISO } from "date-fns";

/**
 * Service for handling Exchange/EWS email accounts
 */
export class ExchangeService {
  /**
   * Connect to Exchange Web Services (EWS) and fetch emails
   */
  async fetchEmails(accountId: number, limit = 50): Promise<any[]> {
    try {
      // Get the account details
      const [account] = await db.select().from(emailAccounts).where(eq(emailAccounts.id, accountId));
      
      if (!account) {
        throw new Error(`Email account with ID ${accountId} not found`);
      }
      
      if (account.accountType !== 'exchange') {
        throw new Error(`Account with ID ${accountId} is not an Exchange account`);
      }
      
      // Decrypt the credentials
      const credentials = this.decryptCredentials(account.credentials);
      
      // For Exchange/EWS, we need detailed server settings
      const serverSettings = account.serverSettings || {};
      const ewsUrl = serverSettings.ewsUrl || '';
      
      if (!ewsUrl) {
        throw new Error('EWS URL is required for Exchange accounts');
      }
      
      // Handle different authentication methods
      let authHeaders = {};
      switch (account.authMethod) {
        case 'basic':
          authHeaders = {
            'Authorization': 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')
          };
          break;
        case 'oauth':
          authHeaders = {
            'Authorization': `Bearer ${credentials.accessToken}`
          };
          break;
        default:
          throw new Error(`Unsupported authentication method: ${account.authMethod}`);
      }
      
      // Prepare the SOAP request for EWS - this is a simplified example
      // In a real application, you would use a library like ews-javascript-api
      const soapEnvelope = `
        <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
                       xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
                       xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages">
          <soap:Header>
            <t:RequestServerVersion Version="Exchange2013" />
          </soap:Header>
          <soap:Body>
            <m:FindItem Traversal="Shallow">
              <m:ItemShape>
                <t:BaseShape>IdOnly</t:BaseShape>
                <t:AdditionalProperties>
                  <t:FieldURI FieldURI="item:Subject" />
                  <t:FieldURI FieldURI="message:From" />
                  <t:FieldURI FieldURI="message:ToRecipients" />
                  <t:FieldURI FieldURI="item:DateTimeReceived" />
                  <t:FieldURI FieldURI="item:Body" />
                </t:AdditionalProperties>
              </m:ItemShape>
              <m:IndexedPageItemView MaxEntriesReturned="${limit}" Offset="0" BasePoint="Beginning" />
              <m:ParentFolderIds>
                <t:DistinguishedFolderId Id="inbox" />
              </m:ParentFolderIds>
            </m:FindItem>
          </soap:Body>
        </soap:Envelope>
      `;
      
      // Call the EWS endpoint
      const response = await axios.post(ewsUrl, soapEnvelope, {
        headers: {
          ...authHeaders,
          'Content-Type': 'text/xml; charset=utf-8',
        }
      });
      
      // Parse the XML response - in a real application, use xml2js or similar
      // This is a simplified example
      console.log(`Got response from EWS with status ${response.status}`);
      
      // Mock parsing the XML - in a real implementation, properly parse the XML response
      // For this example, we'll return mock data
      const fetchedEmails = [];
      
      // In a real implementation, fetchedEmails would be populated from the parsed XML
      
      return fetchedEmails;
    } catch (error) {
      console.error('Error fetching Exchange emails:', error);
      throw error;
    }
  }
  
  /**
   * Save Exchange account to database
   */
  async saveEmailAccount(
    userId: number, 
    emailAddress: string, 
    authMethod: 'basic' | 'oauth',
    credentials: any,
    serverSettings: any
  ): Promise<any> {
    try {
      // Encrypt sensitive credentials
      const encryptedCredentials = this.encryptCredentials(credentials);
      
      // Create or update the account
      const [existingAccount] = await db.select()
        .from(emailAccounts)
        .where(sql`user_id = ${userId} AND email_address = ${emailAddress} AND account_type = 'exchange'`);
      
      if (existingAccount) {
        // Update existing account
        const [updatedAccount] = await db.update(emailAccounts)
          .set({
            credentials: encryptedCredentials,
            authMethod: authMethod as any,
            serverSettings,
            updatedAt: new Date()
          })
          .where(eq(emailAccounts.id, existingAccount.id))
          .returning();
        
        return updatedAccount;
      } else {
        // Create new account
        const displayName = `Exchange (${emailAddress})`;
        
        const [newAccount] = await db.insert(emailAccounts)
          .values({
            userId,
            accountType: 'exchange',
            authMethod: authMethod as any,
            emailAddress,
            credentials: encryptedCredentials,
            displayName,
            serverSettings,
            isActive: true,
            syncEnabled: true
          })
          .returning();
        
        return newAccount;
      }
    } catch (error) {
      console.error('Error saving Exchange account:', error);
      throw error;
    }
  }
  
  /**
   * Synchronize emails for an Exchange account
   */
  async syncEmails(accountId: number, limit = 50): Promise<number> {
    try {
      // Fetch emails from Exchange
      const fetchedEmails = await this.fetchEmails(accountId, limit);
      
      // Save emails to database
      let newEmailCount = 0;
      
      for (const emailData of fetchedEmails) {
        // Check if email already exists by message ID
        const [existingEmail] = await db.select()
          .from(emails)
          .where(sql`account_id = ${accountId} AND message_id = ${emailData.messageId}`);
        
        if (!existingEmail) {
          // Add new email to database
          await db.insert(emails)
            .values({
              accountId,
              messageId: emailData.messageId,
              sender: emailData.sender,
              recipients: emailData.recipients || [],
              subject: emailData.subject || '',
              snippet: emailData.snippet || '',
              body: emailData.body || '',
              isRead: emailData.isRead || false,
              hasAttachments: !!emailData.attachments?.length,
              timestamp: parseISO(emailData.timestamp),
              labels: emailData.labels || [],
              threadId: emailData.threadId
            });
          
          newEmailCount++;
        }
      }
      
      // Update last synced timestamp
      await db.update(emailAccounts)
        .set({ lastSynced: new Date() })
        .where(eq(emailAccounts.id, accountId));
      
      return newEmailCount;
    } catch (error) {
      console.error(`Error syncing Exchange emails for account ${accountId}:`, error);
      throw error;
    }
  }
  
  /**
   * Encrypt sensitive credentials
   */
  private encryptCredentials(credentials: any): any {
    return {
      ...credentials,
      password: credentials.password ? encryptData(credentials.password) : undefined,
      accessToken: credentials.accessToken ? encryptData(credentials.accessToken) : undefined,
      refreshToken: credentials.refreshToken ? encryptData(credentials.refreshToken) : undefined
    };
  }
  
  /**
   * Decrypt sensitive credentials
   */
  private decryptCredentials(encryptedCredentials: any): any {
    return {
      ...encryptedCredentials,
      password: encryptedCredentials.password ? decryptData(encryptedCredentials.password) : undefined,
      accessToken: encryptedCredentials.accessToken ? decryptData(encryptedCredentials.accessToken) : undefined,
      refreshToken: encryptedCredentials.refreshToken ? decryptData(encryptedCredentials.refreshToken) : undefined
    };
  }
}

export const exchangeService = new ExchangeService();