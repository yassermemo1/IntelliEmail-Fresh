import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import CryptoJS from 'crypto-js';
import { db } from '../db';
import { emails, emailAccounts, InsertEmail } from '@shared/schema';
import { eq } from 'drizzle-orm';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key';

/**
 * Service for handling email operations
 */
class EmailService {
  // Decrypt credentials stored in the database
  private decryptCredentials(encryptedCredentials: any): any {
    try {
      if (typeof encryptedCredentials === 'string') {
        const bytes = CryptoJS.AES.decrypt(encryptedCredentials, ENCRYPTION_KEY);
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(decryptedData);
      } else if (typeof encryptedCredentials === 'object') {
        // Handle case where credentials might already be a JSON object
        const credentialsStr = JSON.stringify(encryptedCredentials);
        const bytes = CryptoJS.AES.decrypt(credentialsStr, ENCRYPTION_KEY);
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(decryptedData);
      }
      throw new Error('Invalid credentials format');
    } catch (error) {
      console.error('Error decrypting credentials:', error);
      throw new Error('Failed to decrypt credentials');
    }
  }

  // Connect to Gmail IMAP server with given credentials
  private createImapConnection(credentials: any): Imap {
    return new Imap({
      user: credentials.email,
      password: credentials.password, // App password for Gmail
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });
  }

  // Fetch emails for a specific account
  async fetchEmails(accountId: number, limit = 50): Promise<any[]> {
    try {
      // Get account information from database
      const accountResult = await db.select().from(emailAccounts).where(eq(emailAccounts.id, accountId));
      
      if (!accountResult || accountResult.length === 0) {
        throw new Error('Email account not found');
      }
      
      const account = accountResult[0];
      
      // Decrypt stored credentials
      const credentials = this.decryptCredentials(account.credentials);
      
      return new Promise((resolve, reject) => {
        const imap = this.createImapConnection({
          email: account.emailAddress,
          password: credentials.password
        });
        
        const fetchedEmails: any[] = [];
        
        imap.once('ready', () => {
          imap.openBox('INBOX', false, (err, mailbox) => {
            if (err) {
              imap.end();
              return reject(err);
            }
            
            // Search for all emails or apply filters as needed
            imap.search(['ALL'], (err, results) => {
              if (err) {
                imap.end();
                return reject(err);
              }
              
              // Limit the number of emails to fetch
              const emailsToFetch = results.slice(-limit);
              
              if (emailsToFetch.length === 0) {
                imap.end();
                return resolve([]);
              }
              
              const fetch = imap.fetch(emailsToFetch, {
                bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
                struct: true
              });
              
              fetch.on('message', (msg, seqno) => {
                const email: any = {
                  messageId: '',
                  sender: '',
                  recipients: [],
                  subject: '',
                  body: '',
                  bodyHtml: '',
                  timestamp: new Date(),
                  metadata: {}
                };
                
                msg.on('body', (stream, info) => {
                  let buffer = '';
                  
                  stream.on('data', (chunk) => {
                    buffer += chunk.toString('utf8');
                  });
                  
                  stream.once('end', () => {
                    if (info.which.includes('HEADER')) {
                      const header = Imap.parseHeader(buffer);
                      
                      email.messageId = Array.isArray(header['message-id']) 
                        ? header['message-id'][0] 
                        : header['message-id'] || `${Date.now()}-${seqno}`;
                      
                      email.sender = Array.isArray(header.from) 
                        ? header.from[0] 
                        : header.from || '';
                      
                      email.recipients = Array.isArray(header.to) 
                        ? header.to 
                        : header.to ? [header.to] : [];
                      
                      email.subject = Array.isArray(header.subject) 
                        ? header.subject[0] 
                        : header.subject || '(No Subject)';
                      
                      if (header.date && header.date.length > 0) {
                        email.timestamp = new Date(header.date[0]);
                      }
                    } else {
                      simpleParser(buffer, (err, parsed) => {
                        if (err) {
                          console.error('Error parsing email:', err);
                          return;
                        }
                        
                        // Clean the body and set HTML to null to prevent images
                        const cleanEmailContent = (text: string): string => {
                          if (!text) return '';
                          // Remove URLs
                          let cleaned = text.replace(/https?:\/\/[^\s]+/g, '[URL REMOVED]');
                          // Remove image references
                          cleaned = cleaned.replace(/\[image:[^\]]*\]/g, '[IMAGE REMOVED]');
                          // Remove large blocks of whitespace
                          cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n');
                          return cleaned;
                        };
                        
                        email.body = cleanEmailContent(parsed.text || '');
                        email.bodyHtml = null; // Setting HTML to null prevents images from loading
                        
                        // Store additional metadata
                        email.metadata = {
                          headers: parsed.headers,
                          attachments: parsed.attachments ? parsed.attachments.length : 0,
                          hasAttachments: parsed.attachments && parsed.attachments.length > 0
                        };
                      });
                    }
                  });
                });
                
                msg.once('attributes', (attrs) => {
                  email.uid = attrs.uid;
                  email.flags = attrs.flags;
                  email.threadId = attrs['x-gm-thrid'];
                  
                  // Update metadata with Gmail-specific attributes
                  email.metadata = {
                    ...email.metadata,
                    gmailLabels: attrs['x-gm-labels'],
                    threadId: attrs['x-gm-thrid'],
                    messageId: attrs['x-gm-msgid']
                  };
                });
                
                msg.once('end', () => {
                  fetchedEmails.push(email);
                });
              });
              
              fetch.once('error', (err) => {
                console.error('Fetch error:', err);
                imap.end();
                reject(err);
              });
              
              fetch.once('end', () => {
                console.log(`Fetched ${fetchedEmails.length} messages`);
                imap.end();
              });
            });
          });
        });
        
        imap.once('error', (err) => {
          console.error('IMAP connection error:', err);
          reject(err);
        });
        
        imap.once('end', () => {
          console.log('IMAP connection ended');
          resolve(fetchedEmails);
        });
        
        imap.connect();
      });
    } catch (error) {
      console.error('Error in fetchEmails:', error);
      throw error;
    }
  }
  
  // Save emails to database
  async saveEmails(accountId: number, emailsData: any[]): Promise<void> {
    try {
      for (const emailData of emailsData) {
        // Check if email already exists to avoid duplicates
        const existingEmails = await db
          .select()
          .from(emails)
          .where(eq(emails.messageId, emailData.messageId));
          
        if (existingEmails.length === 0) {
          // Prepare email data for insertion
          const newEmail: InsertEmail = {
            accountId,
            messageId: emailData.messageId,
            sender: emailData.sender,
            recipients: emailData.recipients,
            subject: emailData.subject,
            body: emailData.body,
            bodyHtml: emailData.bodyHtml,
            threadId: emailData.threadId,
            timestamp: emailData.timestamp,
            metadata: emailData.metadata,
            processed: false,
            isRead: emailData.flags?.includes('\\Seen') || false,
            isArchived: emailData.flags?.includes('\\Deleted') || false
          };
          
          // Insert the email into the database
          await db.insert(emails).values(newEmail);
          
          console.log(`Email saved: ${newEmail.subject}`);
        } else {
          console.log(`Email already exists: ${emailData.subject}`);
        }
      }
      
      // Update the lastSynced timestamp for the account
      await db
        .update(emailAccounts)
        .set({ lastSynced: new Date() })
        .where(eq(emailAccounts.id, accountId));
        
      console.log(`Updated lastSynced for account ${accountId}`);
    } catch (error) {
      console.error('Error saving emails to database:', error);
      throw error;
    }
  }
  
  // Main method to synchronize emails
  async syncEmails(accountId: number, limit = 50): Promise<number> {
    try {
      console.log(`Starting email sync for account ${accountId}`);
      const fetchedEmails = await this.fetchEmails(accountId, limit);
      await this.saveEmails(accountId, fetchedEmails);
      
      console.log(`Email sync completed for account ${accountId}. Processed ${fetchedEmails.length} emails.`);
      return fetchedEmails.length;
    } catch (error) {
      console.error('Error in syncEmails:', error);
      throw error;
    }
  }
  
  // Store email account credentials securely
  async saveEmailAccount(userId: number, accountType: 'gmail' | 'exchange', emailAddress: string, password: string): Promise<any> {
    try {
      // Encrypt password before storing
      const encryptedCredentials = CryptoJS.AES.encrypt(
        JSON.stringify({ password }),
        ENCRYPTION_KEY
      ).toString();
      
      // Add account to database
      const [newAccount] = await db
        .insert(emailAccounts)
        .values({
          userId,
          accountType,
          emailAddress,
          credentials: encryptedCredentials,
          isActive: true
        })
        .returning();
      
      return newAccount;
    } catch (error) {
      console.error('Error saving email account:', error);
      throw error;
    }
  }
}

// Create and export the service instance
export const emailService = new EmailService();