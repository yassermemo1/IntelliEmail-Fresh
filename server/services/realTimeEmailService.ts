import { WebSocketServer } from 'ws';
import { Server } from 'http';
import { db } from '../db';
import { emailAccounts } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { gmailService } from './index';

// Check for new emails every 2 minutes
const CHECK_INTERVAL = 2 * 60 * 1000;

export class RealTimeEmailService {
  private wss: WebSocketServer | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private isCheckingEmails = false;

  /**
   * Initialize the real-time email service with a WebSocket server
   * @param httpServer The HTTP server to attach the WebSocket server to
   */
  initialize(httpServer: Server) {
    // Create WebSocket server for real-time updates
    this.wss = new WebSocketServer({ 
      server: httpServer, 
      path: '/ws-mail' // Distinct path for email WebSocket
    });
    
    console.log('Real-time email monitoring service initialized');
    
    // Set up WebSocket event handlers
    this.setupWebSocketHandlers();
    
    // Start periodic email checking
    this.startEmailChecking();
    
    return this.wss;
  }
  
  /**
   * Set up WebSocket connection handlers
   */
  private setupWebSocketHandlers() {
    if (!this.wss) return;
    
    this.wss.on('connection', (ws) => {
      console.log('Client connected to real-time email updates');
      
      // Send connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to real-time email updates',
        timestamp: new Date().toISOString()
      }));
      
      // Handle disconnection
      ws.on('close', () => {
        console.log('Client disconnected from real-time email updates');
      });
      
      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Handle manual check request
          if (message.type === 'check_now') {
            console.log('Manual email check requested by client');
            this.checkForNewEmails();
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      });
    });
  }
  
  /**
   * Start periodic email checking
   */
  private startEmailChecking() {
    console.log(`Starting real-time email monitoring (every ${CHECK_INTERVAL/60000} minutes)`);
    
    // Initial check after 30 seconds
    setTimeout(() => {
      this.checkForNewEmails();
      
      // Then check periodically
      this.checkInterval = setInterval(() => {
        this.checkForNewEmails();
      }, CHECK_INTERVAL);
    }, 30 * 1000);
  }
  
  /**
   * Check all accounts for new emails
   */
  private async checkForNewEmails() {
    // Prevent concurrent checks
    if (this.isCheckingEmails) {
      console.log('Email check already in progress, skipping');
      return;
    }
    
    this.isCheckingEmails = true;
    console.log('Checking for new emails...');
    
    try {
      // Get all active email accounts
      const accounts = await db.select().from(emailAccounts)
        .where(eq(emailAccounts.isActive, true));
      
      if (accounts.length === 0) {
        console.log('No active email accounts for real-time monitoring');
        return;
      }
      
      let totalNewEmails = 0;
      
      // Check each account for new emails
      for (const account of accounts) {
        try {
          console.log(`Checking for new emails from ${account.emailAddress}`);
          
          // Use our existing service to fetch new emails
          const result = await gmailService.fetchAndStoreEmails(
            account.emailAddress,
            account.userId,
            25 // Limit to recent emails for real-time checks
          );
          
          if (result.count > 0) {
            totalNewEmails += result.count;
            console.log(`Found ${result.count} new emails from ${account.emailAddress}`);
            
            // Broadcast update to all connected clients
            this.broadcastUpdate({
              type: 'new_emails',
              count: result.count,
              accountEmail: account.emailAddress,
              accountId: account.id,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error: any) {
          console.error(`Error checking emails for ${account.emailAddress}:`, 
            error?.message || 'Unknown error');
        }
      }
      
      // Broadcast summary update
      if (totalNewEmails > 0) {
        console.log(`Real-time check complete: Found ${totalNewEmails} new emails`);
        this.broadcastUpdate({
          type: 'check_complete',
          totalNewEmails,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log('Real-time check complete: No new emails found');
      }
    } catch (error: any) {
      console.error('Error in real-time email check:', error?.message || 'Unknown error');
    } finally {
      this.isCheckingEmails = false;
    }
  }
  
  /**
   * Broadcast an update to all connected WebSocket clients
   */
  private broadcastUpdate(data: any) {
    if (!this.wss) return;
    
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(data));
      }
    });
  }
  
  /**
   * Stop the email checking service
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    
    console.log('Real-time email monitoring service stopped');
  }
}

// Create and export a singleton instance
export const realTimeEmailService = new RealTimeEmailService();