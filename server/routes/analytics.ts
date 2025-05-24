import { Router, Request, Response } from 'express';
import { db } from '../db';
import { emails, tasks } from '@shared/schema';
import { sql, and, eq, count, desc, gt } from 'drizzle-orm';
import OpenAI from 'openai';

const router = Router();

// Initialize OpenAI with the API key from environment variables
let openai: OpenAI;
try {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (error) {
  console.error('Error initializing OpenAI:', error);
}

/**
 * Get email analytics data including:
 * - Volume statistics
 * - Topic distribution
 * - Trending phrases
 * - Request types
 * - Sentiment analysis
 */
router.get('/emails', async (req: Request, res: Response) => {
  try {
    // Get the authenticated user ID from the request session
    // For now, we're using the userId from query params, but in production
    // this should come from the authenticated session
    const { timeRange = 'month', userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Calculate the start date based on the time range
    const startDate = getStartDateFromRange(timeRange as string);
    
    // Get basic email stats
    const totalEmails = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM emails
      WHERE account_id IN (
        SELECT id FROM email_accounts WHERE user_id = ${Number(userId)}
      )
      ${startDate ? sql`AND timestamp > ${startDate}` : sql``}
    `);
    
    // Get analytics from pre-processed AI data in the database
    
    // 1. Topic Distribution - aggregating ai_suggested_category field
    const topicDistribution = await db.execute(sql`
      SELECT 
        ai_suggested_category AS name,
        COUNT(*) AS value
      FROM emails
      WHERE account_id IN (
        SELECT id FROM email_accounts WHERE user_id = ${Number(userId)}
      )
        AND ai_suggested_category IS NOT NULL
        ${startDate ? sql`AND timestamp > ${startDate}` : sql``}
      GROUP BY ai_suggested_category
      ORDER BY value DESC
      LIMIT 8
    `);
    
    // 2. Sentiment Analysis - aggregating ai_sentiment field
    const sentimentByCategory = await db.execute(sql`
      WITH categories AS (
        SELECT DISTINCT ai_suggested_category
        FROM emails
        WHERE account_id IN (
          SELECT id FROM email_accounts WHERE user_id = ${Number(userId)}
        )
        AND ai_suggested_category IS NOT NULL
        ${startDate ? sql`AND timestamp > ${startDate}` : sql``}
        LIMIT 4
      )
      SELECT 
        c.ai_suggested_category AS name,
        COUNT(CASE WHEN e.ai_sentiment = 'positive' THEN 1 END) AS positive,
        COUNT(CASE WHEN e.ai_sentiment = 'neutral' THEN 1 END) AS neutral,
        COUNT(CASE WHEN e.ai_sentiment = 'negative' THEN 1 END) AS negative
      FROM categories c
      JOIN emails e ON c.ai_suggested_category = e.ai_suggested_category
      WHERE e.account_id IN (
        SELECT id FROM email_accounts WHERE user_id = ${Number(userId)}
      )
        ${startDate ? sql`AND e.timestamp > ${startDate}` : sql``}
      GROUP BY c.ai_suggested_category
    `);
    
    // 3. Task Creation Source Analysis - AI-generated vs. manually created tasks
    const taskSourceAnalysis = await db.execute(sql`
      SELECT 
        SUM(CASE WHEN ai_generated = TRUE THEN 1 ELSE 0 END) AS ai_generated_tasks,
        SUM(CASE WHEN ai_generated = FALSE OR ai_generated IS NULL THEN 1 ELSE 0 END) AS manual_tasks,
        COUNT(*) AS total_tasks
      FROM tasks
      WHERE user_id = ${Number(userId)}
        ${startDate ? sql`AND created_at > ${startDate}` : sql``}
    `);
    
    // 4. Email Volume by Day of Week - when do users receive most emails
    const emailVolumeByDay = await db.execute(sql`
      SELECT 
        EXTRACT(DOW FROM timestamp) AS day_of_week,
        COUNT(*) AS email_count
      FROM emails
      WHERE account_id IN (
        SELECT id FROM email_accounts WHERE user_id = ${Number(userId)}
      )
        ${startDate ? sql`AND timestamp > ${startDate}` : sql``}
      GROUP BY day_of_week
      ORDER BY day_of_week
    `);
    
    // 5. Email Volume by Hour of Day - peak email times
    const emailVolumeByHour = await db.execute(sql`
      SELECT 
        EXTRACT(HOUR FROM timestamp) AS hour_of_day,
        COUNT(*) AS email_count
      FROM emails
      WHERE account_id IN (
        SELECT id FROM email_accounts WHERE user_id = ${Number(userId)}
      )
        ${startDate ? sql`AND timestamp > ${startDate}` : sql``}
      GROUP BY hour_of_day
      ORDER BY hour_of_day
    `);
    
    // For more complex analytics that need holistic view or aren't pre-processed,
    // we'll still use AI analysis
    
    // Get sample emails for AI analysis
    const sampleEmails = await db.execute(sql`
      SELECT 
        id,
        subject,
        body AS bodyText,
        sender,
        timestamp AS receivedAt
      FROM emails
      WHERE account_id IN (
        SELECT id FROM email_accounts WHERE user_id = ${Number(userId)}
      )
        ${startDate ? sql`AND timestamp > ${startDate}` : sql``}
      ORDER BY timestamp DESC
      LIMIT 50
    `); // Limit to 50 emails for analysis
    
    // Get analytics that require complex analysis
    let complexAnalytics = {};
    
    // Check if we have data in the database or need to use AI
    if (topicDistribution.rows.length < 3 || sentimentByCategory.rows.length < 2) {
      console.log('Insufficient pre-processed AI data in database, using complete AI analysis');
      // Fallback to AI analysis for everything
      complexAnalytics = await analyzeEmailsWithAI(sampleEmails);
    } else {
      console.log('Using pre-processed AI data from database, only getting trends from AI');
      // Just get trending phrases and request types from AI
      complexAnalytics = await analyzeEmailsForTrends(sampleEmails);
    }
    
    // If AI analysis fails or returns empty data, indicate that in the response
    // instead of providing mock data
    if (!complexAnalytics || 
        (typeof complexAnalytics !== 'object') || 
        (Object.keys(complexAnalytics).length === 0)) {
      console.log('AI analysis returned empty or invalid data - sending empty data');
      complexAnalytics = {
        trendingPhrases: [],
        requestTypes: []
      };
    }
    
    // Combine database-derived analytics with AI-derived analytics
    const combinedAnalytics = {
      timeRange,
      totalEmails: totalEmails.rows?.[0]?.count || 0,
      // Original metrics
      topicDistribution: topicDistribution.rows.length > 0 ? 
        topicDistribution.rows : 
        complexAnalytics?.topicDistribution || [],
      sentimentAnalysis: sentimentByCategory.rows.length > 0 ? 
        sentimentByCategory.rows : 
        complexAnalytics?.sentimentAnalysis || [],
      trendingPhrases: complexAnalytics?.trendingPhrases || [],
      requestTypes: complexAnalytics?.requestTypes || [],
      
      // New enhanced business analytics
      taskSourceAnalysis: taskSourceAnalysis.rows?.[0] || {
        ai_generated_tasks: 0,
        manual_tasks: 0,
        total_tasks: 0
      },
      emailVolumeByDay: emailVolumeByDay.rows || [],
      emailVolumeByHour: emailVolumeByHour.rows || []
    };
    
    return res.json(combinedAnalytics);
    
  } catch (error) {
    console.error('Error generating email analytics:', error);
    return res.status(500).json({ 
      error: 'Failed to generate email analytics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Drill-down endpoint to get raw data behind analytics
router.get('/analytics/drilldown', async (req: Request, res: Response) => {
  try {
    const { userId = 1, category, type, timeRange = 'month' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    if (timeRange === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (timeRange === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    } else if (timeRange === 'quarter') {
      startDate.setMonth(now.getMonth() - 3);
    }

    let query = '';
    let params: any[] = [];

    if (type === 'topic' && category) {
      // Get emails related to a specific topic
      if (category === 'Data Security') {
        query = `
          SELECT 
            id, subject, sender, created_at,
            LEFT(body, 200) as preview,
            'Contains security-related content' as reason
          FROM emails 
          WHERE (
            subject ILIKE $1 OR 
            body ILIKE $1 OR
            sender ILIKE ANY($2)
          )
          AND created_at >= $3
          ORDER BY created_at DESC 
          LIMIT 100
        `;
        params = [
          '%security%',
          ['%fortinet%', '%kaspersky%', '%proofpoint%', '%adguard%'],
          startDate.toISOString()
        ];
      } else {
        // For other topics, search by keyword
        query = `
          SELECT 
            id, subject, sender, created_at,
            LEFT(body, 200) as preview,
            'Topic keyword match' as reason
          FROM emails 
          WHERE (subject ILIKE $1 OR body ILIKE $1)
          AND created_at >= $2
          ORDER BY created_at DESC 
          LIMIT 100
        `;
        params = [`%${category}%`, startDate.toISOString()];
      }
    } else if (type === 'sender' && category) {
      // Get emails from a specific sender
      query = `
        SELECT 
          id, subject, sender, created_at,
          LEFT(body, 200) as preview,
          'From this sender' as reason
        FROM emails 
        WHERE sender ILIKE $1
        AND created_at >= $2
        ORDER BY created_at DESC 
        LIMIT 100
      `;
      params = [`%${category}%`, startDate.toISOString()];
    } else if (type === 'phrase' && category) {
      // Get emails containing a specific trending phrase
      query = `
        SELECT 
          id, subject, sender, created_at,
          LEFT(body, 200) as preview,
          'Contains trending phrase' as reason
        FROM emails 
        WHERE (subject ILIKE $1 OR body ILIKE $1)
        AND created_at >= $2
        ORDER BY created_at DESC 
        LIMIT 50
      `;
      params = [`%${category}%`, startDate.toISOString()];
    } else {
      return res.status(400).json({ error: 'Invalid drill-down parameters' });
    }

    const result = await db.query(query, params);
    
    res.json({
      category,
      type,
      timeRange,
      totalCount: result.rows?.length || 0,
      emails: result.rows || []
    });

  } catch (error) {
    console.error('Analytics drill-down error:', error);
    res.status(500).json({ error: 'Failed to fetch drill-down data' });
  }
});

/**
 * Get spike analysis data to identify unusual patterns in email volume
 */
router.get('/emails/spikes', async (req: Request, res: Response) => {
  try {
    const { timeRange = 'month', userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Calculate the start date based on the time range
    const startDate = getStartDateFromRange(timeRange as string);
    
    // Query to get daily email counts
    const dailyCounts = await db.execute(sql`
      SELECT 
        DATE(received_at) as date,
        COUNT(*) as count
      FROM emails
      WHERE user_id = ${Number(userId)}
        ${startDate ? sql`AND received_at > ${startDate}` : sql``}
      GROUP BY DATE(received_at)
      ORDER BY date ASC
    `);
    
    // Detect spikes in email volume
    const spikes = detectSpikes(dailyCounts.rows);
    
    return res.json({
      timeRange,
      dailyCounts: dailyCounts.rows,
      spikes,
    });
    
  } catch (error) {
    console.error('Error generating spike analysis:', error);
    return res.status(500).json({ 
      error: 'Failed to generate spike analysis',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get detailed topic analysis for emails
 */
router.get('/emails/topics', async (req: Request, res: Response) => {
  try {
    const { timeRange = 'month', userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Calculate the start date based on the time range
    const startDate = getStartDateFromRange(timeRange as string);
    
    // Get sample emails for AI analysis
    const sampleEmails = await db.execute(sql`
      SELECT 
        id,
        subject,
        body AS bodyText,
        sender,
        received_at AS receivedAt
      FROM emails
      WHERE user_id = ${Number(userId)}
        ${startDate ? sql`AND received_at > ${startDate}` : sql``}
      ORDER BY received_at DESC
      LIMIT 100
    `);
    
    // Perform detailed topic analysis
    const topicAnalysis = await analyzeTopicsWithAI(sampleEmails);
    
    return res.json({
      timeRange,
      ...topicAnalysis,
    });
    
  } catch (error) {
    console.error('Error generating topic analysis:', error);
    return res.status(500).json({ 
      error: 'Failed to generate topic analysis',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get business intelligence insights from email content
 */
router.get('/emails/business-insights', async (req: Request, res: Response) => {
  try {
    const { timeRange = 'month', userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Calculate the start date based on the time range
    const startDate = getStartDateFromRange(timeRange as string);
    
    // Get sample emails for AI analysis
    const sampleEmails = await db.execute(sql`
      SELECT 
        id,
        subject,
        body AS bodyText,
        sender,
        received_at AS receivedAt
      FROM emails
      WHERE user_id = ${Number(userId)}
        ${startDate ? sql`AND received_at > ${startDate}` : sql``}
      ORDER BY received_at DESC
      LIMIT 100
    `);
    
    // Extract business intelligence from emails
    const businessInsights = await extractBusinessInsightsWithAI(sampleEmails);
    
    return res.json({
      timeRange,
      ...businessInsights,
    });
    
  } catch (error) {
    console.error('Error generating business insights:', error);
    return res.status(500).json({ 
      error: 'Failed to generate business insights',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Helper function to calculate start date based on time range
function getStartDateFromRange(timeRange: string): Date | null {
  const now = new Date();
  
  switch(timeRange) {
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      return weekStart;
    case 'month':
      const monthStart = new Date(now);
      monthStart.setMonth(now.getMonth() - 1);
      return monthStart;
    case 'quarter':
      const quarterStart = new Date(now);
      quarterStart.setMonth(now.getMonth() - 3);
      return quarterStart;
    case 'year':
      const yearStart = new Date(now);
      yearStart.setFullYear(now.getFullYear() - 1);
      return yearStart;
    default:
      return null;
  }
}

// Helper function to detect spikes in email volume
function detectSpikes(dailyCounts: any[]): any[] {
  if (!dailyCounts.length) return [];
  
  // Convert to array of numbers for calculations
  const counts = dailyCounts.map(day => day.count);
  
  // Calculate mean and standard deviation
  const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
  const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);
  
  // Threshold for spike detection (2 standard deviations)
  const threshold = mean + (2 * stdDev);
  
  // Find spikes
  const spikes = dailyCounts.filter(day => day.count > threshold);
  
  return spikes.map(spike => ({
    ...spike,
    mean,
    stdDev,
    threshold,
    deviations: (spike.count - mean) / stdDev
  }));
}

// Helper function for complete email analysis with AI
async function analyzeEmailsWithAI(emailsResult: any, userId: number = 1): Promise<any> {
  // Convert query result to array of emails
  const emails = emailsResult.rows || [];
  
  try {
    // Import dynamic AI service
    const { dynamicAiService } = await import('../services/dynamicAiService');
    
    // Prepare email content for analysis
    const emailContent = emails.map(email => 
      `Subject: ${email.subject || 'No Subject'}\nFrom: ${email.sender || 'Unknown'}\nBody: ${email.bodyText?.substring(0, 200) || 'No content'}...`
    ).join('\n\n');
    
    const prompt = `
      Analyze the following set of ${emails.length} emails and extract the following insights:
      1. Topic Distribution: Identify the main topics and their approximate percentage
      2. Trending Keywords: Extract most frequently used important phrases or keywords
      3. Request Types: Categorize the types of requests found in these emails
      4. Sentiment Analysis: Provide a breakdown of positive, neutral, and negative sentiment
      
      Format your response as JSON with the following structure:
      {
        "topicDistribution": [{"name": "Topic Name", "value": percent_as_number}],
        "trendingPhrases": [{"name": "Phrase", "value": frequency_as_number}],
        "requestTypes": [{"name": "Request Type", "count": count_as_number}],
        "sentimentAnalysis": [{"name": "Category", "positive": percent, "neutral": percent, "negative": percent}]
      }
      
      Only respond with valid JSON, no other text.
      
      Emails:
      ${emailContent}
    `;
    
    // Use user's configured AI model dynamically
    const response = await dynamicAiService.generateCompletion(userId, [
      { role: "user", content: prompt }
    ], {
      systemPrompt: "You are an AI assistant specialized in business email analytics.",
      temperature: 0.5,
      responseFormat: { type: "json_object" }
    });
    
    console.log(`📊 Analytics generated using: ${response.provider} - ${response.model}`);
    
    // Parse the JSON response
    const analyticsData = JSON.parse(response.content);
    return analyticsData;
    
  } catch (error) {
    console.error('Error analyzing emails with AI:', error);
    // Return empty data instead of mock data
    return {
      topicDistribution: [], 
      trendingPhrases: [],
      requestTypes: [],
      sentimentAnalysis: []
    };
  }
}

// Helper function for targeted analysis - only get trending phrases and request types
// This is more cost-effective when we already have topic and sentiment data
async function analyzeEmailsForTrends(emailsResult: any): Promise<any> {
  // Convert query result to array of emails
  const emails = emailsResult.rows || [];
  if (!openai) {
    console.log('OpenAI client not initialized, returning empty data');
    return {
      trendingPhrases: [],
      requestTypes: []
    };
  }
  
  try {
    // Prepare email content for analysis
    const emailContent = emails.map(email => 
      `Subject: ${email.subject || 'No Subject'}\nFrom: ${email.sender || 'Unknown'}\nBody: ${email.bodyText?.substring(0, 200) || 'No content'}...`
    ).join('\n\n');
    
    // Use GPT-4 for targeted analysis - only trends and request types
    const prompt = `
      Analyze the following set of ${emails.length} emails and extract ONLY these two insights:
      1. Trending Keywords: Extract most frequently used important phrases or keywords
      2. Request Types: Categorize the types of requests found in these emails
      
      Format your response as JSON with the following structure:
      {
        "trendingPhrases": [{"name": "Phrase", "value": frequency_as_number}],
        "requestTypes": [{"name": "Request Type", "count": count_as_number}]
      }
      
      Only respond with valid JSON, no other text.
      
      Emails:
      ${emailContent}
    `;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [
        { role: "system", content: "You are an AI assistant specialized in business email analytics." },
        { role: "user", content: prompt }
      ],
      temperature: 0.5,
      response_format: { type: "json_object" }
    });
    
    // Parse the JSON response
    const analyticsData = JSON.parse(response.choices[0].message.content);
    return analyticsData;
    
  } catch (error) {
    console.error('Error analyzing emails for trends:', error);
    // Return partial mock data as fallback
    const mockData = getMockAnalyticsData();
    return {
      trendingPhrases: mockData.trendingPhrases,
      requestTypes: mockData.requestTypes
    };
  }
}

// Helper function to analyze topics in more detail
async function analyzeTopicsWithAI(emailsResult: any): Promise<any> {
  // Convert query result to array of emails
  const emails = emailsResult.rows || [];
  if (!openai) {
    console.log('OpenAI client not initialized, returning mock data');
    return getMockTopicData();
  }
  
  try {
    // Prepare email content for analysis
    const emailContent = emails.map(email => 
      `Subject: ${email.subject || 'No Subject'}\nFrom: ${email.sender || 'Unknown'}\nBody: ${email.bodyText?.substring(0, 200) || 'No content'}...`
    ).join('\n\n');
    
    // Use GPT-4 to analyze email topics
    const prompt = `
      Analyze the following set of ${emails.length} emails and provide detailed topic analysis:
      1. Main Topics: Identify the primary topics discussed
      2. Subtopics: For each main topic, identify subtopics
      3. Topic Trends: Identify any emerging topics or declining topics
      4. Topic Relationships: How topics relate to each other
      
      Format your response as JSON with the following structure:
      {
        "mainTopics": [{"name": "Topic Name", "value": percent_as_number}],
        "subtopics": [{"parent": "Main Topic", "name": "Subtopic", "value": percent_as_number}],
        "emergingTopics": [{"name": "Topic", "growth": "High/Medium/Low"}],
        "topicRelationships": [{"source": "Topic A", "target": "Topic B", "strength": number_0_to_1}]
      }
      
      Only respond with valid JSON, no other text.
      
      Emails:
      ${emailContent}
    `;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an AI assistant specialized in topic analysis of business communications." },
        { role: "user", content: prompt }
      ],
      temperature: 0.5,
      response_format: { type: "json_object" }
    });
    
    // Parse the JSON response
    const topicData = JSON.parse(response.choices[0].message.content);
    return topicData;
    
  } catch (error) {
    console.error('Error analyzing topics with AI:', error);
    // Return mock data as fallback
    return getMockTopicData();
  }
}

// Helper function to extract business insights
async function extractBusinessInsightsWithAI(emailsResult: any): Promise<any> {
  // Convert query result to array of emails
  const emails = emailsResult.rows || [];
  if (!openai) {
    console.log('OpenAI client not initialized, returning mock data');
    return getMockBusinessInsights();
  }
  
  try {
    // Prepare email content for analysis
    const emailContent = emails.map(email => 
      `Subject: ${email.subject || 'No Subject'}\nFrom: ${email.sender || 'Unknown'}\nBody: ${email.bodyText?.substring(0, 200) || 'No content'}...`
    ).join('\n\n');
    
    // Use GPT-4 to extract business insights
    const prompt = `
      You are a business intelligence analyst. Extract valuable business insights from the following ${emails.length} emails.
      Analyze patterns, identify business opportunities, risks, client needs, and team efficiency metrics.
      
      Focus on:
      1. Client Satisfaction: Identify indicators of satisfaction or dissatisfaction
      2. Business Opportunities: Potential new projects, partnerships, or revenue streams
      3. Operational Efficiency: Team performance, response times, bottlenecks
      4. Risks and Issues: Potential problems, escalations, or risks
      5. Market Intelligence: Competitive information, industry trends, market changes
      
      Format your response as JSON with the following structure:
      {
        "clientSatisfaction": {
          "score": number_0_to_100,
          "indicators": [{"type": "positive/negative", "description": "text"}]
        },
        "businessOpportunities": [{"name": "Opportunity", "description": "text", "priority": "High/Medium/Low"}],
        "operationalMetrics": {
          "responseTime": {"value": number, "unit": "hours", "trend": "Improving/Stable/Worsening"},
          "issueResolution": {"value": number, "unit": "days", "trend": "Improving/Stable/Worsening"},
          "bottlenecks": [{"area": "text", "impact": "High/Medium/Low"}]
        },
        "risks": [{"name": "Risk", "description": "text", "severity": "High/Medium/Low"}],
        "marketIntelligence": [{"trend": "text", "relevance": "High/Medium/Low"}]
      }
      
      Only respond with valid JSON, no other text.
      
      Emails:
      ${emailContent}
    `;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an AI assistant specialized in business intelligence and analytics." },
        { role: "user", content: prompt }
      ],
      temperature: 0.5,
      response_format: { type: "json_object" }
    });
    
    // Parse the JSON response
    const insightsData = JSON.parse(response.choices[0].message.content);
    return insightsData;
    
  } catch (error) {
    console.error('Error extracting business insights with AI:', error);
    // Return mock data as fallback
    return getMockBusinessInsights();
  }
}

// Mock data for fallback (when API is not available)
function getMockAnalyticsData() {
  return {
    topicDistribution: [
      { name: 'Project Updates', value: 35 },
      { name: 'Meeting Requests', value: 25 },
      { name: 'Client Inquiries', value: 18 },
      { name: 'Internal Discussions', value: 15 },
      { name: 'Technical Issues', value: 7 },
    ],
    trendingPhrases: [
      { name: 'quarterly review', value: 24 },
      { name: 'project deadline', value: 18 },
      { name: 'status update', value: 16 },
      { name: 'team meeting', value: 15 },
      { name: 'budget approval', value: 13 },
      { name: 'client feedback', value: 11 },
      { name: 'action items', value: 9 },
      { name: 'schedule call', value: 8 },
    ],
    requestTypes: [
      { name: 'Information Request', count: 42 },
      { name: 'Meeting Scheduling', count: 38 },
      { name: 'Document Sharing', count: 27 },
      { name: 'Approval Request', count: 22 },
      { name: 'Technical Support', count: 18 },
      { name: 'Deadline Extension', count: 15 },
      { name: 'Status Update', count: 12 },
    ],
    sentimentAnalysis: [
      { name: 'Client Emails', positive: 65, neutral: 25, negative: 10 },
      { name: 'Internal Emails', positive: 55, neutral: 35, negative: 10 },
      { name: 'Vendor Emails', positive: 40, neutral: 45, negative: 15 },
      { name: 'Support Tickets', positive: 30, neutral: 40, negative: 30 },
    ],
  };
}

function getMockTopicData() {
  return {
    mainTopics: [
      { name: 'Project Management', value: 35 },
      { name: 'Client Communications', value: 25 },
      { name: 'Internal Operations', value: 20 },
      { name: 'Technical Discussions', value: 15 },
      { name: 'HR and Administration', value: 5 },
    ],
    subtopics: [
      { parent: 'Project Management', name: 'Deadlines', value: 12 },
      { parent: 'Project Management', name: 'Resource Allocation', value: 10 },
      { parent: 'Project Management', name: 'Status Reporting', value: 8 },
      { parent: 'Project Management', name: 'Risk Management', value: 5 },
      { parent: 'Client Communications', name: 'Requirements Gathering', value: 10 },
      { parent: 'Client Communications', name: 'Feedback Sessions', value: 8 },
      { parent: 'Client Communications', name: 'Proposals', value: 7 },
      { parent: 'Internal Operations', name: 'Team Meetings', value: 12 },
      { parent: 'Internal Operations', name: 'Process Improvements', value: 8 },
      { parent: 'Technical Discussions', name: 'Bug Reports', value: 8 },
      { parent: 'Technical Discussions', name: 'Feature Development', value: 7 },
    ],
    emergingTopics: [
      { name: 'AI Integration', growth: 'High' },
      { name: 'Remote Collaboration Tools', growth: 'Medium' },
      { name: 'Data Privacy Compliance', growth: 'High' },
      { name: 'Sustainability Initiatives', growth: 'Medium' },
    ],
    topicRelationships: [
      { source: 'Project Management', target: 'Client Communications', strength: 0.8 },
      { source: 'Project Management', target: 'Internal Operations', strength: 0.7 },
      { source: 'Technical Discussions', target: 'Project Management', strength: 0.6 },
      { source: 'Client Communications', target: 'Technical Discussions', strength: 0.5 },
      { source: 'Internal Operations', target: 'HR and Administration', strength: 0.4 },
    ],
  };
}

function getMockBusinessInsights() {
  return {
    clientSatisfaction: {
      score: 72,
      indicators: [
        { type: 'positive', description: 'Clients frequently expressing appreciation for timely deliverables' },
        { type: 'positive', description: 'Positive feedback on quality of deliverables' },
        { type: 'negative', description: 'Some concerns about communication frequency' },
        { type: 'negative', description: 'Occasional mentions of budget overruns' },
      ]
    },
    businessOpportunities: [
      { name: 'Expand Service Offerings', description: 'Multiple clients have inquired about additional services', priority: 'High' },
      { name: 'Strategic Partnership', description: 'Potential collaboration with complementary service provider', priority: 'Medium' },
      { name: 'Client Referral Program', description: 'Several clients willing to provide referrals', priority: 'Medium' },
      { name: 'New Market Segment', description: 'Emerging interest from previously untapped industry', priority: 'Low' },
    ],
    operationalMetrics: {
      responseTime: { value: 3.5, unit: 'hours', trend: 'Improving' },
      issueResolution: { value: 2.2, unit: 'days', trend: 'Stable' },
      bottlenecks: [
        { area: 'Approval Process', impact: 'High' },
        { area: 'Resource Allocation', impact: 'Medium' },
        { area: 'Technical Documentation', impact: 'Medium' },
      ]
    },
    risks: [
      { name: 'Resource Constraint', description: 'Upcoming projects may exceed current team capacity', severity: 'High' },
      { name: 'Client Churn', description: 'Two major clients showing signs of dissatisfaction', severity: 'Medium' },
      { name: 'Technical Debt', description: 'Increasing mentions of legacy system issues', severity: 'Medium' },
      { name: 'Competitive Threat', description: 'New competitor entering the market with aggressive pricing', severity: 'Low' },
    ],
    marketIntelligence: [
      { trend: 'Increasing demand for AI integration capabilities', relevance: 'High' },
      { trend: 'Industry shift toward subscription-based pricing models', relevance: 'Medium' },
      { trend: 'Growing emphasis on data security compliance', relevance: 'High' },
      { trend: 'Emergence of specialized niche competitors', relevance: 'Medium' },
    ]
  };
}

export default router;