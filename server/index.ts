import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { realTimeEmailService } from "./realTimeSync";
import { startAutoRagProcessing } from "./autoRagProcessor";
import { gmailService } from "./services";
import { db } from "./db";
import { emailAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { runMigrations } from "./migrations";
import { debugLogger } from "./utils/debugLogger";
import CryptoJS from 'crypto-js';

// Real-time email polling system
// Checks for new emails every few minutes
let pollingInterval: NodeJS.Timeout | null = null;
const POLLING_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

// Function to poll for new emails
async function pollForNewEmails() {
  try {
    debugLogger.log('email', "Starting real-time email check for new messages");
    
    // Get all active email accounts
    const activeAccounts = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.isActive, true));
    
    debugLogger.accountLog('check_active', { count: activeAccounts.length });
    
    if (activeAccounts.length === 0) {
      debugLogger.log('email', "No active email accounts for real-time polling");
      return;
    }
    
    let totalNewEmails = 0;
    
    // Check each account for new emails
    for (const account of activeAccounts) {
      try {
        log(`Checking for new emails from ${account.emailAddress}`);
        
        // Use Gmail service to fetch only new emails
        const result = await gmailService.fetchAndStoreEmails(
          account.emailAddress,
          account.userId,
          50
        );
        
        if (result.count > 0) {
          totalNewEmails += result.count;
          log(`Found ${result.count} new emails from ${account.emailAddress}`);
        }
      } catch (error: any) {
        log(`Error checking for new emails from ${account.emailAddress}: ${error?.message || 'Unknown error'}`);
      }
    }
    
    if (totalNewEmails > 0) {
      log(`Real-time polling complete: Found ${totalNewEmails} new emails`);
    } else {
      log("Real-time polling complete: No new emails found");
    }
    
  } catch (error: any) {
    log(`Error in real-time email polling: ${error?.message || 'Unknown error'}`);
  }
}

// Function to start the polling process
function setupRealTimeEmailPolling() {
  log("Setting up real-time email monitoring");
  
  // Start with an immediate check after 30 seconds
  setTimeout(() => {
    pollForNewEmails();
    
    // Then set up recurring checks
    pollingInterval = setInterval(pollForNewEmails, POLLING_INTERVAL_MS);
    log(`Real-time email polling active (every ${POLLING_INTERVAL_MS/60000} minutes)`);
  }, 30 * 1000);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add session middleware
import session from 'express-session';
app.use(session({
  secret: process.env.SESSION_SECRET || 'development-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Add test user for development
import { addTestUser } from './middleware/testSession';
app.use(addTestUser);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
    // Skip migrations that are causing startup delays
    console.log("Starting server without blocking migrations...");
    
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve the app on the configured port or default to 5000
  // this serves both the API and the client.
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  server.listen({
    port,
    host: "localhost",
  }, () => {
    log(`serving on port ${port}`);
    
    // Start real-time email synchronization
    realTimeEmailService.startRealTimeSync();
    
    // Start automatic RAG processing for emails
    startAutoRagProcessing();
  });
})();
