import { Router, Request, Response } from 'express';
import { db } from '../db';
import { emails, tasks } from '../../shared/schema';
import { desc, ne } from 'drizzle-orm';

const router = Router();

/**
 * Task extraction analysis endpoint for dashboard visualization
 */
router.post('/task-extraction', async (req: Request, res: Response) => {
  try {
    const { count = 10 } = req.body;
    const limit = Math.min(Number(count), 20); // Limit to 20 max
    
    // Get the most recent emails with non-empty subjects
    const recentEmails = await db
      .select()
      .from(emails)
      .where(
        ne(emails.subject, '') // Exclude empty subjects
      )
      .orderBy(desc(emails.timestamp))
      .limit(50); // Get more than we need to find variety
    
    // Filter to get emails with unique subjects for better analysis variety
    const uniqueSubjectEmails = [];
    const seenSubjects = new Set();
    
    for (const email of recentEmails) {
      if (!seenSubjects.has(email.subject)) {
        seenSubjects.add(email.subject);
        uniqueSubjectEmails.push(email);
        
        if (uniqueSubjectEmails.length >= limit) {
          break;
        }
      }
    }
    
    if (uniqueSubjectEmails.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No emails found to analyze'
      });
    }
    
    console.log(`Analyzing ${uniqueSubjectEmails.length} emails for task extraction`);
    
    // Process each email with simple classification logic
    const results = [];
    
    for (const email of uniqueSubjectEmails) {
      try {
        // Classify email content
        const classification = getClassification(email.subject, email.body || '');
        const nonActionable = isLikelyNonActionable(email.subject, email.sender);
        
        // Create example tasks if the email is actionable
        let extractedTasks = [];
        if (!nonActionable) {
          extractedTasks = [{
            id: Date.now() + Math.floor(Math.random() * 1000),
            title: `Follow up on: ${email.subject.substring(0, 50)}`,
            description: `This task was extracted from an email from ${email.sender}. The email appears to require action or follow-up.`,
            priority: "medium",
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            isCompleted: false,
            emailId: email.id
          }];
        }
        
        // Generate explanation about the analysis
        const explanation = generateExplanation(
          email.subject,
          email.sender,
          classification,
          nonActionable
        );
        
        results.push({
          emailId: email.id,
          subject: email.subject,
          from: email.sender,
          classification,
          isLikelyNonActionable: nonActionable,
          extractedTasks,
          analysis: {
            extractedTaskCount: extractedTasks.length,
            categories: classification,
            explanation
          }
        });
      } catch (error: any) {
        console.error(`Error analyzing email ${email.id}:`, error);
        results.push({
          emailId: email.id,
          subject: email.subject,
          from: email.sender,
          error: error.message || 'Unknown error during analysis'
        });
      }
    }
    
    return res.json({
      success: true,
      count: uniqueSubjectEmails.length,
      totalProcessed: results.length,
      results
    });
  } catch (error: any) {
    console.error('Error in task extraction analysis:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to analyze emails for task extraction',
      error: error.message
    });
  }
});

// Helper function to classify email content
function getClassification(subject: string, body: string): string[] {
  const categories = [];
  const combinedText = (subject + " " + body).toLowerCase();
  
  // Work-related keywords
  if (
    combinedText.includes("meeting") || 
    combinedText.includes("report") || 
    combinedText.includes("project") ||
    combinedText.includes("deadline") ||
    combinedText.includes("presentation")
  ) {
    categories.push("work");
  }
  
  // Financial-related keywords
  if (
    combinedText.includes("payment") || 
    combinedText.includes("invoice") || 
    combinedText.includes("bill") ||
    combinedText.includes("transaction")
  ) {
    categories.push("financial");
  }
  
  // Urgency keywords
  if (
    combinedText.includes("urgent") || 
    combinedText.includes("asap") || 
    combinedText.includes("immediately") ||
    combinedText.includes("emergency")
  ) {
    categories.push("urgent");
  }
  
  // Travel-related keywords
  if (
    combinedText.includes("flight") || 
    combinedText.includes("hotel") || 
    combinedText.includes("reservation") ||
    combinedText.includes("booking") ||
    combinedText.includes("travel")
  ) {
    categories.push("travel");
  }
  
  // If no categories were detected, mark as personal
  if (categories.length === 0) {
    categories.push("personal");
  }
  
  return categories;
}

// Check if email is likely non-actionable
function isLikelyNonActionable(subject: string, sender: string): boolean {
  const lowerSubject = subject.toLowerCase();
  const lowerSender = sender.toLowerCase();
  
  // Common marketing phrases
  const marketingPhrases = [
    "newsletter", "discount", "sale", "offer", "promo", 
    "deal", "subscribe", "unsubscribe", "subscription", 
    "off your next", "limited time", "special offer",
    "exclusive", "just for you", "don't miss out"
  ];
  
  // Check for marketing phrases in subject
  for (const phrase of marketingPhrases) {
    if (lowerSubject.includes(phrase)) {
      return true;
    }
  }
  
  // Common marketing sender domains
  const marketingDomains = [
    "newsletter", "marketing", "noreply", "no-reply", 
    "promotions", "deals", "sales", "offers", "info"
  ];
  
  // Check for marketing domains in sender
  for (const domain of marketingDomains) {
    if (lowerSender.includes(domain)) {
      return true;
    }
  }
  
  return false;
}

// Generate explanation text
function generateExplanation(subject: string, sender: string, categories: string[], isNonActionable: boolean): string {
  if (isNonActionable) {
    return `This email appears to be non-actionable marketing or promotional content from "${sender}". The subject "${subject}" contains marketing language or comes from a sender that typically sends automated messages.`;
  } else {
    const categoryText = categories.join(", ");
    return `This email contains actionable content related to ${categoryText}. The sender "${sender}" appears to be requesting or providing information that requires follow-up or specific actions.`;
  }
}

export default router;