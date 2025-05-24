import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import CryptoJS from 'crypto-js';
import { db } from '../db';
import { emails, emailAccounts, InsertEmail } from '@shared/schema';
import { eq } from 'drizzle-orm';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key';

/**
 * Service for handling Gmail interactions
 */
class GmailService {
  /**
   * Clean email content to remove URLs, image references, and other unwanted content
   */
  private cleanEmailContent(content: string): string {
    if (!content) return '';
    
    // Remove URLs
    let cleaned = content.replace(/https?:\/\/[^\s]+/g, '[URL REMOVED]');
    
    // Remove image references (commonly found in formats like [image: description])
    cleaned = cleaned.replace(/\[image:[^\]]*\]/g, '[IMAGE REMOVED]');
    
    // Remove any End_Logo or similar references
    cleaned = cleaned.replace(/End_Logo\s*\([^\)]*\)/g, '[LOGO REMOVED]');
    
    // Remove email footers with lots of links (common in marketing emails)
    cleaned = cleaned.replace(/(?:View\s+in\s+browser|View\s+online).*/g, '[EMAIL FOOTER REMOVED]');
    
    // Remove large blocks of whitespace
    cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n');
    
    return cleaned;
  }
  /**
   * Connect to Gmail using app password and fetch emails
   */
  async fetchAndStoreEmails(email: string, userId: number, limit = 50): Promise<{ success: boolean, count: number, accountId?: number }> {
    try {
      console.log(`Starting Gmail sync for ${email}`);
      
      // Get the account from the database
      const accounts = await db.select().from(emailAccounts)
        .where(eq(emailAccounts.emailAddress, email));
      
      if (accounts.length === 0) {
        throw new Error(`No account found for ${email}`);
      }
      
      const account = accounts[0];
      
      // Get password from encrypted credentials
      const encryptedCreds = account.credentials as string;
      const bytes = CryptoJS.AES.decrypt(encryptedCreds, ENCRYPTION_KEY);
      const jsonStr = bytes.toString(CryptoJS.enc.Utf8);
      const credentials = JSON.parse(jsonStr);
      const appPassword = credentials.password;
      
      // Now connect to Gmail and fetch emails
      const fetchedEmails = await this.fetchEmails(email, appPassword, limit);
      console.log(`Fetched ${fetchedEmails.length} emails from Gmail`);
      
      // Store the emails in the database
      const storedCount = await this.storeEmails(account.id, fetchedEmails);
      console.log(`Stored ${storedCount} new emails in database`);
      
      // Update the lastSynced timestamp for the account
      await db
        .update(emailAccounts)
        .set({ lastSynced: new Date() })
        .where(eq(emailAccounts.id, account.id));
      
      return {
        success: true,
        count: storedCount,
        accountId: account.id
      };
    } catch (error) {
      console.error('Error in fetchAndStoreEmails:', error);
      throw error;
    }
  }
  
  /**
   * Get or create Gmail account in the database
   */
  private async getOrCreateAccount(userId: number, email: string, appPassword: string): Promise<any> {
    try {
      // Check if account already exists
      const existingAccounts = await db
        .select()
        .from(emailAccounts)
        .where(eq(emailAccounts.emailAddress, email));
      
      if (existingAccounts.length > 0) {
        return existingAccounts[0];
      }
      
      // If not, create a new account
      const encryptedCredentials = CryptoJS.AES.encrypt(
        JSON.stringify({ password: appPassword }),
        ENCRYPTION_KEY
      ).toString();
      
      const [newAccount] = await db
        .insert(emailAccounts)
        .values({
          userId,
          accountType: 'gmail',
          emailAddress: email,
          credentials: encryptedCredentials,
          isActive: true
        })
        .returning();
      
      return newAccount;
    } catch (error) {
      console.error('Error getting/creating account:', error);
      throw error;
    }
  }
  
  /**
   * Fetch emails from Gmail via IMAP
   */
  private async fetchEmails(email: string, appPassword: string, limit: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      try {
        const imap = new Imap({
          user: email,
          password: appPassword,
          host: 'imap.gmail.com',
          port: 993,
          tls: true,
          tlsOptions: { rejectUnauthorized: false }
        });
        
        const fetchedEmails: any[] = [];
        
        imap.once('ready', () => {
          imap.openBox('INBOX', false, (err, mailbox) => {
            if (err) {
              imap.end();
              return reject(err);
            }
            
            // Search for new emails since the last sync
            // Get only UNSEEN emails for real-time sync
            imap.search(['UNSEEN'], (err, results) => {
              if (err) {
                imap.end();
                return reject(err);
              }
              
              // Get all emails within the last 90 days
              console.log(`Found ${results.length} total messages in Gmail`);
              
              // If we have more emails than the limit, fetch the most recent ones
              const emailsToFetch = results.length > limit ? results.slice(-limit) : results;
              console.log(`Will fetch ${emailsToFetch.length} messages from Gmail`);
              
              if (emailsToFetch.length === 0) {
                imap.end();
                return resolve([]);
              }
              
              const fetch = imap.fetch(emailsToFetch, {
                bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT', ''],
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
                    } else if (!info.which || info.which === '') {
                      // This is the full message including attachments
                      simpleParser(buffer).then((parsed) => {
                        
                        // Clean the text content to remove URLs, image references, etc.
                        const rawText = parsed.text || '';
                        
                        // Clean email content inline to remove URLs, images, logos
                        let cleanedText = rawText;
                        
                        // Remove URLs
                        cleanedText = cleanedText.replace(/https?:\/\/[^\s]+/g, '[URL REMOVED]');
                        
                        // Remove image references (commonly found in formats like [image: description])
                        cleanedText = cleanedText.replace(/\[image:[^\]]*\]/g, '[IMAGE REMOVED]');
                        
                        // Remove any End_Logo or similar references with specific pattern matching
                        cleanedText = cleanedText.replace(/End_Logo\s*\([^\)]*\)/g, '[LOGO REMOVED]');
                        cleanedText = cleanedText.replace(/\(\s*https?:\/\/[^\)]+\)/g, '[LINK REMOVED]');
                        cleanedText = cleanedText.replace(/\[\s*https?:\/\/[^\]]+\]/g, '[LINK REMOVED]');
                        
                        // Remove marketing image references and tags
                        cleanedText = cleanedText.replace(/\[.*?logo.*?\]/gi, '[LOGO REMOVED]');
                        cleanedText = cleanedText.replace(/\(.*?logo.*?\)/gi, '[LOGO REMOVED]');
                        
                        // Specifically target End_Logo from marketing emails
                        cleanedText = cleanedText.replace(/End_Logo[^\n]*/g, '[LOGO REMOVED]');
                        cleanedText = cleanedText.replace(/.*?End_Logo[^\n]*/g, '[LOGO REMOVED]');
                        
                        // Remove common marketing email elements
                        cleanedText = cleanedText.replace(/Unsubscribe[^\n]*/g, '[EMAIL FOOTER REMOVED]');
                        cleanedText = cleanedText.replace(/View\s+in\s+browser[^\n]*/g, '[EMAIL FOOTER REMOVED]');
                        cleanedText = cleanedText.replace(/View\s+online[^\n]*/g, '[EMAIL FOOTER REMOVED]');
                        cleanedText = cleanedText.replace(/To\s+unsubscribe[^\n]*/g, '[EMAIL FOOTER REMOVED]');
                        
                        // Remove social media sections from marketing emails
                        cleanedText = cleanedText.replace(/Follow\s+us\s+on[^\n]*/gi, '[SOCIAL MEDIA REMOVED]');
                        
                        // Remove large blocks of whitespace
                        cleanedText = cleanedText.replace(/\n\s*\n\s*\n+/g, '\n\n');
                        
                        email.body = cleanedText;
                        // Store empty HTML to prevent rendering images and logos
                        email.bodyHtml = null;
                        
                        // Store additional metadata
                        email.metadata = {
                          headers: parsed.headers,
                          attachments: parsed.attachments ? parsed.attachments.length : 0,
                          hasAttachments: parsed.attachments && parsed.attachments.length > 0,
                          subject: parsed.subject,
                          from: parsed.from,
                          to: parsed.to,
                          date: parsed.date
                        };
                      });
                    }
                  });
                });
                
                msg.once('attributes', (attrs) => {
                  email.uid = attrs.uid;
                  email.flags = attrs.flags;
                  
                  // Gmail-specific attributes
                  if (attrs['x-gm-thrid']) {
                    email.threadId = attrs['x-gm-thrid'];
                  }
                  
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
      } catch (error) {
        console.error('Error setting up IMAP connection:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Store fetched emails in the database
   */
  private async storeEmails(accountId: number, fetchedEmails: any[]): Promise<number> {
    let storedCount = 0;
    
    for (const emailData of fetchedEmails) {
      try {
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
            // bodyHtml field is not in the database schema yet
            threadId: emailData.threadId,
            timestamp: emailData.timestamp,
            metadata: emailData.metadata,
            processed: false,
            isRead: emailData.flags?.includes('\\Seen') || false,
            isArchived: emailData.flags?.includes('\\Deleted') || false
          };
          
          // Insert the email into the database
          await db.insert(emails).values(newEmail);
          storedCount++;
        }
      } catch (error) {
        console.error(`Error storing email "${emailData.subject}":`, error);
        // Continue with the next email
      }
    }
    
    return storedCount;
  }
}

// Create and export an instance of the Gmail service
export const gmailService = new GmailService();