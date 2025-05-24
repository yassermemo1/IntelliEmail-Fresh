/**
 * Direct script to clean email content
 * Removes unwanted markers and tags from email bodies
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function cleanEmails() {
  console.log('Starting email content cleaning process...');
  
  try {
    // First, get count of emails that need cleaning
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM emails WHERE is_cleaned = false'
    );
    
    const totalToClean = parseInt(countResult.rows[0].count, 10);
    console.log(`Found ${totalToClean} emails that need cleaning`);
    
    if (totalToClean === 0) {
      console.log('No emails need cleaning. Exiting.');
      process.exit(0);
    }
    
    // Fetch emails in batches
    const batchSize = 100;
    let processedCount = 0;
    let successCount = 0;
    
    for (let offset = 0; offset < totalToClean; offset += batchSize) {
      console.log(`Processing batch starting at offset ${offset}...`);
      
      // Get batch of emails
      const emailsResult = await pool.query(
        'SELECT id, body, body_html FROM emails WHERE is_cleaned = false ORDER BY id LIMIT $1 OFFSET $2',
        [batchSize, offset]
      );
      
      if (emailsResult.rows.length === 0) {
        console.log('No more emails to process. Exiting batch loop.');
        break;
      }
      
      // Process each email in the batch
      for (const email of emailsResult.rows) {
        try {
          let { id, body, body_html } = email;
          
          // Clean the text content
          if (body) {
            // Remove marker tags
            body = body.replace(/\[EMAIL HEADER REMOVED\]/g, '');
            body = body.replace(/\[EMAIL FOOTER REMOVED\]/g, '');
            body = body.replace(/\[URL REMOVED\]/g, '');
            body = body.replace(/<\[URL REMOVED\]>/g, '');
            body = body.replace(/"" <\[URL REMOVED\]>/g, '');
            
            // Remove multiple consecutive newlines
            body = body.replace(/\n{3,}/g, '\n\n');
            
            // Trim whitespace
            body = body.trim();
          }
          
          // Clean the HTML content
          if (body_html) {
            // Remove marker tags from HTML
            body_html = body_html.replace(/\[EMAIL HEADER REMOVED\]/g, '');
            body_html = body_html.replace(/\[EMAIL FOOTER REMOVED\]/g, '');
            body_html = body_html.replace(/\[URL REMOVED\]/g, '');
            body_html = body_html.replace(/<\[URL REMOVED\]>/g, '');
            body_html = body_html.replace(/"" <\[URL REMOVED\]>/g, '');
          }
          
          // Update the email with cleaned content
          await pool.query(
            'UPDATE emails SET body = $1, body_html = $2, is_cleaned = true WHERE id = $3',
            [body, body_html, id]
          );
          
          successCount++;
        } catch (err) {
          console.error(`Error cleaning email ${email.id}:`, err);
        }
        
        processedCount++;
        
        // Log progress periodically
        if (processedCount % 50 === 0) {
          console.log(`Processed ${processedCount} emails (${successCount} successful)`);
        }
      }
    }
    
    console.log(`
Email cleaning process complete!
Total processed: ${processedCount}
Successfully cleaned: ${successCount}
    `);
    
  } catch (error) {
    console.error('Error during email cleaning process:', error);
  } finally {
    pool.end();
  }
}

// Run the cleaning process
cleanEmails();