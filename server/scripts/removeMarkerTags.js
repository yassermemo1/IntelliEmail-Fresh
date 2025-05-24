// Script to specifically remove marker tags from cleaned emails
const { db } = require('../db');
const { emails } = require('@shared/schema');
const { eq, like, or, and } = require('drizzle-orm');

/**
 * Remove all marker tags from cleaned emails
 * This specifically targets [URL REMOVED] and [EMAIL FOOTER REMOVED] tags
 */
async function removeMarkerTags(limit = 100) {
  console.log(`Starting marker tag removal for up to ${limit} emails...`);
  
  try {
    // Get emails with marker tags
    const emailsToFix = await db
      .select()
      .from(emails)
      .where(
        and(
          eq(emails.is_cleaned, true),
          or(
            like(emails.body, '%[URL REMOVED]%'),
            like(emails.body, '%[EMAIL FOOTER REMOVED]%'),
            like(emails.body, '%([URL REMOVED])%'),
            like(emails.body, '%[[URL REMOVED]]%')
          )
        )
      )
      .limit(limit);
    
    console.log(`Found ${emailsToFix.length} emails with marker tags to clean`);
    
    let processedCount = 0;
    
    for (const email of emailsToFix) {
      if (!email.body) continue;
      
      let cleanedBody = email.body;
      
      // Remove all URL REMOVED markers with different patterns
      cleanedBody = cleanedBody.replace(/\[URL REMOVED\]/g, '');
      cleanedBody = cleanedBody.replace(/\[\[URL REMOVED\]\]/g, '');
      cleanedBody = cleanedBody.replace(/\(\[URL REMOVED\]\)/g, '');
      cleanedBody = cleanedBody.replace(/\[URL REMOVED\]\]/g, '');
      cleanedBody = cleanedBody.replace(/\[\[URL REMOVED\]/g, '');
      
      // Remove all EMAIL FOOTER REMOVED markers
      cleanedBody = cleanedBody.replace(/\[EMAIL FOOTER REMOVED\]/g, '');
      
      // Remove all parenthesized URL markers like "([URL REMOVED])"
      cleanedBody = cleanedBody.replace(/\(\s*\[[^\]]*URL[^\]]*\]\s*\)/g, '');
      
      // Remove all parenthesized REMOVED markers
      cleanedBody = cleanedBody.replace(/\(\s*\[[^\]]*REMOVED[^\]]*\]\s*\)/g, '');
      
      // Clean up multiple spaces
      cleanedBody = cleanedBody.replace(/\s{2,}/g, ' ');
      
      // Update the email in the database
      await db
        .update(emails)
        .set({
          body: cleanedBody,
          updatedAt: new Date()
        })
        .where(eq(emails.id, email.id));
      
      processedCount++;
      
      // Log progress every 10 emails
      if (processedCount % 10 === 0) {
        console.log(`Processed ${processedCount} emails so far...`);
      }
    }
    
    console.log(`Marker tag removal complete: ${processedCount} emails processed`);
    return { processedCount };
  } catch (error) {
    console.error("Error removing marker tags:", error);
    return { error: error.message };
  }
}

// Run the cleanup immediately when this script is executed directly
if (require.main === module) {
  removeMarkerTags(500)
    .then(result => {
      console.log(result);
      process.exit(0);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { removeMarkerTags };