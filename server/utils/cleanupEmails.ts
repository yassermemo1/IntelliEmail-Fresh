import { db } from '../db';
import { emails } from '@shared/schema';
import { eq, isNull, or } from 'drizzle-orm';
import { parse } from 'node-html-parser';

/**
 * Clean HTML content from emails to extract plain text
 * This function will:
 * - Remove all HTML tags but preserve text content
 * - Remove tracking pixels, analytics, and marketing elements
 * - Remove email signatures (common patterns)
 * - Extract and structure key email components
 * - Remove URLs, marketing links, and all [URL REMOVED]/[EMAIL FOOTER REMOVED] markers
 * - Structure data for better searchability
 */
export async function cleanAllEmailContent(limit = 100): Promise<{ processedCount: number; errorCount: number }> {
  console.log(`Starting email content cleanup for up to ${limit} emails...`);
  
  let processedCount = 0;
  let errorCount = 0;
  
  try {
    // Get emails that need cleaning (is_cleaned is null)
    // First process emails where is_cleaned is null
    let emailsToClean = await db
      .select()
      .from(emails)
      .where(isNull(emails.is_cleaned))
      .limit(limit);
    
    // If we didn't get enough emails with null, also get ones with is_cleaned=false
    if (emailsToClean.length < limit) {
      const remainingLimit = limit - emailsToClean.length;
      const moreEmailsToClean = await db
        .select()
        .from(emails)
        .where(eq(emails.is_cleaned, false))
        .limit(remainingLimit);
      
      emailsToClean = [...emailsToClean, ...moreEmailsToClean];
    }

    console.log(`Found ${emailsToClean.length} emails to clean`);
    
    // Process each email
    for (const email of emailsToClean) {
      try {
        // Start with the HTML content if available, otherwise use plain text
        const rawContent = email.bodyHtml || email.body;
        
        // Clean the content
        const cleanedContent = cleanEmailContent(rawContent);
        
        // Extract structured data
        const { 
          cleanedBody,
          extractedSender, 
          extractedRecipients, 
          structuredData
        } = parseEmailComponents(cleanedContent, email.sender, email.recipients);
        
        // Update the email in the database with cleaned content and structured data
        await db
          .update(emails)
          .set({
            body: cleanedBody,
            sender: extractedSender || email.sender,
            recipients: extractedRecipients || email.recipients,
            metadata: structuredData ? JSON.stringify(structuredData).replace(/\\/g, '') : email.metadata,
            is_cleaned: true,
            updatedAt: new Date()
          })
          .where(eq(emails.id, email.id));
        
        processedCount++;
        
        // Log progress periodically
        if (processedCount % 10 === 0) {
          console.log(`Cleaned ${processedCount} emails so far...`);
        }
      } catch (err) {
        console.error(`Error cleaning email ${email.id}:`, err);
        errorCount++;
      }
    }
    
    console.log(`Email cleanup complete: ${processedCount} processed, ${errorCount} errors`);
    return { processedCount, errorCount };
  } catch (error) {
    console.error("Error during email cleanup:", error);
    return { processedCount, errorCount: errorCount + 1 };
  }
}

/**
 * Clean email content by removing unwanted HTML, trackers, etc.
 */
function cleanEmailContent(content: string): string {
  try {
    // First pass - extract HTML text
    const root = parse(content);
    
    // Remove unwanted elements
    removeUnwantedElements(root);
    
    // Get the text content
    let cleanedText = root.textContent || '';
    
    // Remove marketing footers
    cleanedText = removeMarketingFooters(cleanedText);
    
    // Remove quoted replies
    cleanedText = removeQuotedReplies(cleanedText);
    
    // Final cleaning to remove all markers and brackets
    
    // Remove all URL REMOVED markers with different patterns
    cleanedText = cleanedText.replace(/\[URL REMOVED\]/g, '');
    cleanedText = cleanedText.replace(/\[ URL REMOVED \]/g, '');
    cleanedText = cleanedText.replace(/\[\[URL REMOVED\]\]/g, '');
    cleanedText = cleanedText.replace(/\(\[URL REMOVED\]\)/g, '');
    cleanedText = cleanedText.replace(/\[URL REMOVED\]\]/g, '');
    cleanedText = cleanedText.replace(/\[\[URL REMOVED\]/g, '');
    cleanedText = cleanedText.replace(/\[ \[URL REMOVED\] \]/g, '');
    
    // Remove all EMAIL FOOTER REMOVED markers
    cleanedText = cleanedText.replace(/\[EMAIL FOOTER REMOVED\]/g, '');
    
    // Remove parenthesized URL markers
    cleanedText = cleanedText.replace(/\(\s*\[[^\]]*URL[^\]]*\]\s*\)/g, '');
    cleanedText = cleanedText.replace(/\[\s*\[[^\]]*URL[^\]]*\]\s*\]/g, '');
    
    // Remove all instances of "<" and ">" characters
    cleanedText = cleanedText.replace(/</g, '');
    cleanedText = cleanedText.replace(/>/g, '');
    
    // Clean up HTML escape sequences
    cleanedText = cleanedText.replace(/--&gt;/g, '');
    cleanedText = cleanedText.replace(/&gt;/g, '');
    cleanedText = cleanedText.replace(/&lt;/g, '');
    cleanedText = cleanedText.replace(/&amp;/g, '&');
    
    // Final cleanup
    cleanedText = completeFinalCleaning(cleanedText);
    
    return cleanedText.trim();
  } catch (error) {
    console.error("Error cleaning email content:", error);
    
    // If HTML parsing fails, apply direct regex replacements
    let basicCleaned = content;
    
    // Basic HTML tag removal
    basicCleaned = basicCleaned.replace(/<[^>]*>/g, ' ');
    
    // Remove marker tags
    basicCleaned = basicCleaned.replace(/\[URL REMOVED\]/g, '');
    basicCleaned = basicCleaned.replace(/\[ URL REMOVED \]/g, '');
    basicCleaned = basicCleaned.replace(/\[\[URL REMOVED\]\]/g, '');
    basicCleaned = basicCleaned.replace(/\[URL REMOVED\]\]/g, '');
    basicCleaned = basicCleaned.replace(/\[\[URL REMOVED\]/g, '');
    basicCleaned = basicCleaned.replace(/\[EMAIL FOOTER REMOVED\]/g, '');
    basicCleaned = basicCleaned.replace(/\(\s*\[[^\]]*URL[^\]]*\]\s*\)/g, '');
    
    // Remove all instances of "<" and ">" characters
    basicCleaned = basicCleaned.replace(/</g, '');
    basicCleaned = basicCleaned.replace(/>/g, '');
    
    // Clean up HTML escape sequences
    basicCleaned = basicCleaned.replace(/--&gt;/g, '');
    basicCleaned = basicCleaned.replace(/&gt;/g, '');
    basicCleaned = basicCleaned.replace(/&lt;/g, '');
    basicCleaned = basicCleaned.replace(/&amp;/g, '&');
    
    // Clean up spacing
    basicCleaned = basicCleaned.replace(/\s{2,}/g, ' ').trim();
    
    return basicCleaned;
  }
}

/**
 * Remove unwanted HTML elements from the parsed HTML
 */
function removeUnwantedElements(root: any): void {
  // Remove tracking pixels
  root.querySelectorAll('img[width="1"], img[height="1"]').forEach((el: any) => el.remove());
  
  // Remove all images (but keep alt text)
  root.querySelectorAll('img').forEach((el: any) => {
    const alt = el.getAttribute('alt');
    if (alt) {
      el.replaceWith('[IMAGE: ' + alt + ']');
    } else {
      el.remove();
    }
  });
  
  // Remove scripts, styles, and tracking elements
  const elementsToRemove = [
    'script', 'style', 'iframe', 'object', 'embed', 'noscript',
    // Common tracking and marketing div classes/IDs
    'div.footer', 'div.signature', '.email-footer', '.signature', '.disclaimer',
    '#tracking', '.tracking', '.analytics', '.follow-us',
    '.social-media', '.unsubscribe', '.preferences', '.privacy-policy',
    '.marketing', '.advertisement', '.promotion'
  ];
  
  elementsToRemove.forEach(selector => {
    root.querySelectorAll(selector).forEach((el: any) => el.remove());
  });
  
  // Remove all links but keep their text content
  root.querySelectorAll('a').forEach((el: any) => {
    el.replaceWith(el.text);
  });
}

/**
 * Remove common marketing footers and unsubscribe text
 */
function removeMarketingFooters(text: string): string {
  const footerPatterns = [
    /Unsubscribe(.|\n)*?preferences/i,
    /To unsubscribe(.|\n)*?click here/i,
    /If you would like to unsubscribe(.|\n)*?/i,
    /This email was sent(.|\n)*?subscription/i,
    /View this email in your browser(.|\n)*?/i,
    /Copyright © \d{4}(.|\n)*?All rights reserved/i,
    /You're receiving this email because(.|\n)*?/i,
    /This email may contain confidential(.|\n)*?/i,
    /CONFIDENTIALITY NOTICE(.|\n)*?/i,
    /If you are not the intended recipient(.|\n)*?/i,
    /Disclaimer(.|\n)*?/i,
    /Follow us on(.|\n)*?social media/i,
    /Connect with us(.|\n)*?/i,
    /Join us on(.|\n)*?/i,
    /Like us on(.|\n)*?/i,
    /Join the conversation(.|\n)*?/i,
  ];
  
  let cleanedText = text;
  
  // Apply all patterns
  footerPatterns.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, '');
  });
  
  return cleanedText.trim();
}

/**
 * Parse email components to extract structured data
 */
function parseEmailComponents(
  content: string,
  originalSender: string,
  originalRecipients: string[]
): {
  cleanedBody: string;
  extractedSender: string | null;
  extractedRecipients: string[] | null;
  structuredData: any | null;
} {
  // Default return values
  let cleanedBody = content;
  let extractedSender = null;
  let extractedRecipients = null;
  let structuredData: any = {
    topics: [],
    hasAttachment: false,
    isForwarded: false,
    isReply: false,
    ccCount: 0,
    urgency: 'normal',
  };
  
  // Detect if it's a forwarded message
  if (content.includes('---------- Forwarded message ---------') ||
      content.includes('Begin forwarded message:')) {
    structuredData.isForwarded = true;
  }
  
  // Detect if it's a reply
  if (content.includes('On') && content.includes('wrote:')) {
    structuredData.isReply = true;
  }
  
  // Extract urgency indicators
  const urgencyWords = ['urgent', 'important', 'critical', 'asap', 'emergency', 'priority'];
  for (const word of urgencyWords) {
    if (content.toLowerCase().includes(word)) {
      structuredData.urgency = 'high';
      break;
    }
  }
  
  // Extract potential topics using naive keyword identification
  // (in a real implementation, we'd use NLP for better topic extraction)
  const potentialTopics = [
    'meeting', 'report', 'update', 'invoice', 'payment', 'request',
    'project', 'deadline', 'reminder', 'invitation', 'announcement',
    'question', 'issue', 'problem', 'solution', 'feedback', 'review'
  ];
  
  for (const topic of potentialTopics) {
    if (content.toLowerCase().includes(topic)) {
      structuredData.topics.push(topic);
    }
  }
  
  // Count CC recipients (this is a simplified approach)
  if (originalRecipients && originalRecipients.length > 1) {
    structuredData.ccCount = originalRecipients.length - 1;
  }
  
  // Clean up quoted replies in the body
  cleanedBody = removeQuotedReplies(cleanedBody);
  
  // Apply final cleaning to remove all marker tags
  cleanedBody = completeFinalCleaning(cleanedBody);
  
  return {
    cleanedBody,
    extractedSender,
    extractedRecipients,
    structuredData
  };
}

/**
 * Final comprehensive cleaning to remove all marker tags and URLs
 */
function completeFinalCleaning(text: string): string {
  if (!text) return '';
  
  let cleanedText = text;
  
  // Always do a comprehensive marker tag removal for all emails
  // Multi-pass cleaning with different strategies to ensure all tags are removed
  
  // First pass: Handle common markdown-style links and special patterns
  cleanedText = cleanedText.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // Keep link text, remove URL
  cleanedText = cleanedText.replace(/\(\s*\[[^\]]*\]\s*\)/g, ''); // Remove parenthesized brackets
  
  // Second pass: More aggressive removal of all marker tags
  // This completely removes all variations of URL REMOVED and EMAIL FOOTER REMOVED
  cleanedText = cleanedText.replace(/\[URL REMOVED\]/g, '');
  cleanedText = cleanedText.replace(/\[\[URL REMOVED\]\]/g, '');
  cleanedText = cleanedText.replace(/\(\[URL REMOVED\]\)/g, '');
  cleanedText = cleanedText.replace(/\[URL REMOVED\]\]/g, '');
  cleanedText = cleanedText.replace(/\[\[URL REMOVED\]/g, '');
  cleanedText = cleanedText.replace(/\[EMAIL FOOTER REMOVED\]/g, '');
  cleanedText = cleanedText.replace(/\(\s*\[[^\]]*URL[^\]]*\]\s*\)/g, '');
  cleanedText = cleanedText.replace(/\(\s*\[[^\]]*REMOVED[^\]]*\]\s*\)/g, '');
  
  // Third pass: Remove common marker tags with regex patterns
  const markerPatterns = [
    /\[IMAGE REMOVED\]/g,
    /\[LOGO REMOVED\]/g,
    /\[ATTACHMENT REMOVED\]/g,
    /\[[^\]]*URL[^\]]*\]/g,
    /\[[^\]]*REMOVED[^\]]*\]/g,
    /\[\[[^\]]*\]\]/g,
    /<\[[^\]]*\]>/g,
    /<[^>]*REMOVED[^>]*>/g,
    /URL REMOVED/g,
    /EMAIL FOOTER REMOVED/g
  ];
  
  // Apply all marker patterns with a complete replacement approach
  for (let pattern of markerPatterns) {
    // Keep applying the pattern until no more matches are found
    let previousText = '';
    while (previousText !== cleanedText) {
      previousText = cleanedText;
      cleanedText = cleanedText.replace(pattern, '');
    }
  }
  
  // Fourth pass: Remove bare URLs and patterns with square brackets
  cleanedText = cleanedText.replace(/https?:\/\/[^\s]+/g, '');
  cleanedText = cleanedText.replace(/\[\[[^\]]*\]\]/g, '');
  cleanedText = cleanedText.replace(/\[[^\]]*\]/g, '');
  
  // Fifth pass: Clean escape sequences like "\n" and "\*"
  cleanedText = cleanedText.replace(/\\n/g, ' '); // Replace "\n" with space
  cleanedText = cleanedText.replace(/\\\*/g, ''); // Remove "\*"
  cleanedText = cleanedText.replace(/\\"/g, '"'); // Replace escaped quotes
  cleanedText = cleanedText.replace(/\\\\/g, ''); // Remove escaped backslashes
  
  // Sixth pass: Special handling for remaining markers (if any)
  // If marker tags are still present, apply the more aggressive approach
  if (cleanedText.includes('URL REMOVED') || 
      cleanedText.includes('EMAIL FOOTER REMOVED') ||
      cleanedText.includes('[URL') || 
      cleanedText.includes('[[URL')) {
    cleanedText = stripAllMarkersAndBrackets(cleanedText);
  }
  
  // Remove duplicate whitespace and clean up formatting
  cleanedText = cleanedText.replace(/\s{2,}/g, ' ').trim();
  cleanedText = cleanedText.replace(/\n\s*\n\s*\n/g, '\n\n'); // Replace triple newlines with double
  
  return cleanedText;
}

/**
 * Complete approach for marker and bracket removal
 * This will remove all types of marker tags
 */
function stripAllMarkersAndBrackets(text: string): string {
  if (!text) return '';
  
  // Parse and clean HTML first if the content is HTML
  let cleaned = text;
  if (cleaned.indexOf('<') > -1 && cleaned.indexOf('>') > -1) {
    try {
      const root = parse(cleaned);
      removeUnwantedElements(root);
      cleaned = root.text;
    } catch (e) {
      // If HTML parsing fails, continue with the text as is
      console.log("HTML parsing failed, continuing with raw text");
    }
  }
  
  // Multi-stage cleaning approach with repeated passes
  
  // Stage 1: Remove all URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
  
  // Stage 2: Remove all types of bracketed content with marker words
  const markerPatterns = [
    // Remove bracketed content containing URL REMOVED
    /\[\[URL REMOVED\]\]/g,
    /\[URL REMOVED\]/g,
    /\[[^\]]*URL REMOVED[^\]]*\]/g,
    /\([^\)]*URL REMOVED[^\)]*\)/g,
    
    // Remove bracketed content containing EMAIL FOOTER REMOVED
    /\[EMAIL FOOTER REMOVED\]/g,
    /\[[^\]]*EMAIL FOOTER REMOVED[^\]]*\]/g,
    /\([^\)]*EMAIL FOOTER REMOVED[^\)]*\)/g,
    
    // Other common markers
    /\[IMAGE REMOVED\]/g,
    /\[LOGO REMOVED\]/g,
    /\[ATTACHMENT REMOVED\]/g,
    /\[[^\]]*REMOVED[^\]]*\]/g,
    
    // Pattern for markdown links
    /\[([^\]]*)\]\([^)]*\)/g
  ];
  
  // Apply each pattern multiple times until no more changes
  for (const pattern of markerPatterns) {
    let previousText = '';
    while (previousText !== cleaned) {
      previousText = cleaned;
      if (pattern.toString().includes('\\([^\\)]')) {
        // For patterns with capture groups, use the first capture group
        cleaned = cleaned.replace(pattern, '$1');
      } else {
        // For other patterns, replace with empty string
        cleaned = cleaned.replace(pattern, '');
      }
    }
  }
  
  // Stage 3: Handle special cases
  
  // Remove remaining URLs and markers
  cleaned = cleaned.replace(/URL REMOVED/g, '');
  cleaned = cleaned.replace(/EMAIL FOOTER REMOVED/g, '');
  cleaned = cleaned.replace(/IMAGE REMOVED/g, '');
  cleaned = cleaned.replace(/LOGO REMOVED/g, '');
  cleaned = cleaned.replace(/ATTACHMENT REMOVED/g, '');
  
  // Handle angle brackets
  cleaned = cleaned.replace(/<[^>]*(?:https?|www|URL|REMOVED)[^>]*>/g, '');
  
  // Stage 4: Always use aggressive cleaning for all emails
  // This ensures no markers remain
  
  // Remove all squared bracket content - this is the most common place for markers
  cleaned = cleaned.replace(/\[\[[^\]]*\]\]/g, '');
  cleaned = cleaned.replace(/\[[^\]]*\]/g, '');
  
  // Remove all parenthesized content that might contain markers
  cleaned = cleaned.replace(/\([^)]*URL[^)]*\)/g, '');
  cleaned = cleaned.replace(/\([^)]*REMOVED[^)]*\)/g, '');
  
  // Remove all angle bracket content that might contain markers
  cleaned = cleaned.replace(/<[^>]*URL[^>]*>/g, '');
  cleaned = cleaned.replace(/<[^>]*REMOVED[^>]*>/g, '');
  
  // Make a final pass to remove any remaining markers
  cleaned = cleaned.replace(/URL REMOVED/g, '');
  cleaned = cleaned.replace(/EMAIL FOOTER REMOVED/g, '');
  
  // Stage 5: Clean up whitespace and line breaks
  cleaned = cleaned.replace(/\n\s*\n/g, '\n');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  
  return cleaned.trim();
}

/**
 * Simplified cleaning approach as a fallback
 */
function simplifiedCleaning(text: string): string {
  if (!text) return '';
  
  let cleaned = text;
  
  // Just remove the obvious marker patterns
  cleaned = cleaned.replace(/\[URL REMOVED\]/g, '');
  cleaned = cleaned.replace(/\[EMAIL FOOTER REMOVED\]/g, '');
  cleaned = cleaned.replace(/\[\[URL REMOVED\]\]/g, '');
  
  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
  
  // Remove multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  
  return cleaned.trim();
}

/**
 * Remove quoted replies and forwarded content for cleaner text
 */
function removeQuotedReplies(text: string): string {
  // Common patterns for quoted content
  const quotePatterns = [
    /On.*wrote:/, // "On Mon, Jan 1, 2023 at 10:00 AM John Doe <john@example.com> wrote:"
    /From:.*Sent:/, // Outlook style
    /---------- Forwarded message ---------[\s\S]*?>/, // Gmail forwarded message
    /Begin forwarded message:[\s\S]*?>/, // Apple Mail forwarded message
    />{3,}.*/, // Lines with lots of > characters (quoted text in some clients)
    /-{5,}Original Message-{5,}[\s\S]*$/, // Original message divider
  ];
  
  let cleanedText = text;
  
  // Apply all patterns
  quotePatterns.forEach(pattern => {
    const match = cleanedText.match(pattern);
    if (match && match.index) {
      // Keep text before the quoted content starts
      cleanedText = cleanedText.substring(0, match.index).trim();
    }
  });
  
  return cleanedText;
}