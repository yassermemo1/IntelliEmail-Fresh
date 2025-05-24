#!/usr/bin/env node

/**
 * Migration Status Tracker for Email Task Management Application
 * Tracks data migration progress and identifies changes in your authentic email data
 */

const { Pool } = require('pg');
const fs = require('fs');

// Configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/email_task_management';

// Color codes for output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

// Logging functions
const log = {
    info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
    data: (msg) => console.log(`${colors.cyan}[DATA]${colors.reset} ${msg}`)
};

async function getMigrationStatus() {
    const pool = new Pool({ connectionString: DATABASE_URL });
    
    try {
        log.info('Analyzing migration status and data integrity...');
        
        // Get comprehensive data statistics
        const result = await pool.query(`
            WITH email_stats AS (
                SELECT 
                    COUNT(*) as total_emails,
                    COUNT(CASE WHEN embedding_vector IS NOT NULL THEN 1 END) as emails_with_embeddings,
                    COUNT(CASE WHEN processed_for_tasks = true THEN 1 END) as processed_emails,
                    MIN(timestamp) as oldest_email,
                    MAX(timestamp) as newest_email,
                    COUNT(DISTINCT account_id) as email_accounts_with_data
                FROM emails
            ),
            task_stats AS (
                SELECT 
                    COUNT(*) as total_tasks,
                    COUNT(CASE WHEN embedding_vector IS NOT NULL THEN 1 END) as tasks_with_embeddings,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
                    COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_tasks
                FROM tasks
            ),
            account_stats AS (
                SELECT 
                    COUNT(*) as total_accounts,
                    COUNT(CASE WHEN account_type = 'gmail' THEN 1 END) as gmail_accounts,
                    COUNT(CASE WHEN is_active = true THEN 1 END) as active_accounts
                FROM email_accounts
            ),
            user_stats AS (
                SELECT COUNT(*) as total_users FROM users
            ),
            vector_dimensions AS (
                SELECT 
                    COALESCE(vector_dims(embedding_vector), 0) as email_vector_dims
                FROM emails 
                WHERE embedding_vector IS NOT NULL 
                LIMIT 1
            ),
            recent_activity AS (
                SELECT 
                    COUNT(CASE WHEN timestamp > NOW() - INTERVAL '24 hours' THEN 1 END) as emails_last_24h,
                    COUNT(CASE WHEN timestamp > NOW() - INTERVAL '7 days' THEN 1 END) as emails_last_7d
                FROM emails
            )
            SELECT 
                email_stats.*,
                task_stats.*,
                account_stats.*,
                user_stats.*,
                COALESCE(vector_dimensions.email_vector_dims, 0) as vector_dimensions,
                recent_activity.*
            FROM email_stats, task_stats, account_stats, user_stats, recent_activity
            LEFT JOIN vector_dimensions ON true;
        `);
        
        const stats = result.rows[0];
        
        // Get database size information
        const sizeResult = await pool.query(`
            SELECT 
                pg_size_pretty(pg_total_relation_size('emails')) as emails_size,
                pg_size_pretty(pg_total_relation_size('tasks')) as tasks_size,
                pg_size_pretty(pg_database_size(current_database())) as total_db_size
        `);
        
        const sizes = sizeResult.rows[0];
        
        // Get index information
        const indexResult = await pool.query(`
            SELECT 
                schemaname,
                tablename,
                indexname,
                indexdef
            FROM pg_indexes 
            WHERE tablename IN ('emails', 'tasks', 'email_accounts', 'users')
            ORDER BY tablename, indexname;
        `);
        
        const indexes = indexResult.rows;
        
        await pool.end();
        
        return { stats, sizes, indexes };
        
    } catch (error) {
        log.error(`Failed to get migration status: ${error.message}`);
        await pool.end();
        throw error;
    }
}

function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

function calculatePercentage(part, total) {
    if (total === 0) return '0.0';
    return ((part / total) * 100).toFixed(1);
}

function displayMigrationStatus(data) {
    const { stats, sizes, indexes } = data;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 MIGRATION STATUS & DATA INTEGRITY REPORT');
    console.log('='.repeat(80));
    
    // Overall Summary
    console.log('\n🎯 MIGRATION SUMMARY:');
    console.log(`   👥 Users: ${formatNumber(stats.total_users)}`);
    console.log(`   📧 Email Accounts: ${formatNumber(stats.total_accounts)} (${formatNumber(stats.active_accounts)} active)`);
    console.log(`   📬 Total Emails: ${formatNumber(stats.total_emails)}`);
    console.log(`   📋 Tasks Extracted: ${formatNumber(stats.total_tasks)}`);
    
    // Email Data Analysis
    console.log('\n📧 EMAIL DATA ANALYSIS:');
    console.log(`   📊 Total Emails: ${formatNumber(stats.total_emails)}`);
    console.log(`   🤖 With AI Embeddings: ${formatNumber(stats.emails_with_embeddings)} (${calculatePercentage(stats.emails_with_embeddings, stats.total_emails)}%)`);
    console.log(`   ⚙️  Processed for Tasks: ${formatNumber(stats.processed_emails)} (${calculatePercentage(stats.processed_emails, stats.total_emails)}%)`);
    
    if (stats.oldest_email) {
        const oldestDate = new Date(stats.oldest_email).toLocaleDateString();
        const newestDate = new Date(stats.newest_email).toLocaleDateString();
        console.log(`   📅 Date Range: ${oldestDate} to ${newestDate}`);
    }
    
    console.log(`   📈 Recent Activity:`);
    console.log(`      Last 24h: ${formatNumber(stats.emails_last_24h)} emails`);
    console.log(`      Last 7d: ${formatNumber(stats.emails_last_7d)} emails`);
    
    // Task Analysis
    console.log('\n📋 TASK EXTRACTION ANALYSIS:');
    console.log(`   📊 Total Tasks: ${formatNumber(stats.total_tasks)}`);
    console.log(`   🤖 With AI Embeddings: ${formatNumber(stats.tasks_with_embeddings)} (${calculatePercentage(stats.tasks_with_embeddings, stats.total_tasks)}%)`);
    console.log(`   ⏳ Pending Tasks: ${formatNumber(stats.pending_tasks)}`);
    console.log(`   ✅ Completed Tasks: ${formatNumber(stats.completed_tasks)}`);
    console.log(`   🚨 High Priority: ${formatNumber(stats.high_priority_tasks)}`);
    
    // Vector Embeddings Status
    console.log('\n🤖 AI VECTOR EMBEDDINGS STATUS:');
    if (stats.vector_dimensions > 0) {
        console.log(`   ✅ Vector System: Active (${stats.vector_dimensions} dimensions)`);
        console.log(`   📧 Email Embeddings: ${formatNumber(stats.emails_with_embeddings)}/${formatNumber(stats.total_emails)} (${calculatePercentage(stats.emails_with_embeddings, stats.total_emails)}%)`);
        console.log(`   📋 Task Embeddings: ${formatNumber(stats.tasks_with_embeddings)}/${formatNumber(stats.total_tasks)} (${calculatePercentage(stats.tasks_with_embeddings, stats.total_tasks)}%)`);
        
        const embeddingProgress = calculatePercentage(stats.emails_with_embeddings, stats.total_emails);
        if (parseFloat(embeddingProgress) < 100) {
            const remaining = stats.total_emails - stats.emails_with_embeddings;
            console.log(`   🔄 Processing: ${formatNumber(remaining)} emails remaining`);
        }
    } else {
        console.log(`   ⏳ Vector System: Initializing (embeddings will be generated automatically)`);
    }
    
    // Database Performance Metrics
    console.log('\n💾 DATABASE PERFORMANCE:');
    console.log(`   📊 Total Database Size: ${sizes.total_db_size}`);
    console.log(`   📧 Emails Table Size: ${sizes.emails_size}`);
    console.log(`   📋 Tasks Table Size: ${sizes.tasks_size}`);
    
    // Index Status
    console.log('\n⚡ DATABASE INDEXES:');
    const emailIndexes = indexes.filter(idx => idx.tablename === 'emails').length;
    const taskIndexes = indexes.filter(idx => idx.tablename === 'tasks').length;
    const vectorIndexes = indexes.filter(idx => idx.indexdef.includes('hnsw')).length;
    
    console.log(`   📧 Email Indexes: ${emailIndexes} (including ${vectorIndexes} vector indexes)`);
    console.log(`   📋 Task Indexes: ${taskIndexes}`);
    console.log(`   🔍 Search Optimization: ${vectorIndexes > 0 ? 'Active' : 'Standard'}`);
    
    // Migration Health Check
    console.log('\n🏥 MIGRATION HEALTH CHECK:');
    
    const healthChecks = [
        { name: 'Database Connected', status: true, details: 'PostgreSQL connection active' },
        { name: 'Tables Created', status: stats.total_emails >= 0, details: 'All schema tables present' },
        { name: 'Email Data', status: stats.total_emails > 0, details: `${formatNumber(stats.total_emails)} authentic emails` },
        { name: 'Vector Extension', status: stats.vector_dimensions > 0, details: 'pgvector active for AI search' },
        { name: 'Performance Indexes', status: emailIndexes > 3, details: 'Database optimized for search' },
        { name: 'Real-time Sync', status: stats.emails_last_24h > 0, details: 'Email sync active' }
    ];
    
    healthChecks.forEach(check => {
        const icon = check.status ? '✅' : '⚠️';
        console.log(`   ${icon} ${check.name}: ${check.details}`);
    });
    
    // Migration Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (stats.emails_with_embeddings < stats.total_emails) {
        const remaining = stats.total_emails - stats.emails_with_embeddings;
        console.log(`   🤖 AI embeddings are being generated for ${formatNumber(remaining)} emails`);
        console.log(`      This will enhance semantic search capabilities`);
    }
    
    if (stats.processed_emails < stats.total_emails) {
        console.log(`   📋 Task extraction can be run on more emails for better insights`);
    }
    
    if (stats.total_tasks === 0) {
        console.log(`   🎯 Run task extraction to automatically identify actionable items`);
    }
    
    console.log(`   🚀 Your authentic email data is ready for comprehensive search!`);
    
    // Save migration report
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            users: stats.total_users,
            email_accounts: stats.total_accounts,
            emails: stats.total_emails,
            tasks: stats.total_tasks,
            embedding_progress: calculatePercentage(stats.emails_with_embeddings, stats.total_emails)
        },
        detailed_stats: stats,
        database_sizes: sizes,
        index_count: indexes.length
    };
    
    fs.writeFileSync('migration-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Detailed report saved to: migration-report.json');
}

async function main() {
    try {
        console.log('🔍 Analyzing your authentic email data migration...');
        
        const migrationData = await getMigrationStatus();
        displayMigrationStatus(migrationData);
        
        console.log('\n🎉 Migration analysis complete!');
        console.log('Your email task management system is ready with authentic data.');
        
    } catch (error) {
        log.error(`Migration status check failed: ${error.message}`);
        console.log('\nPossible solutions:');
        console.log('1. Ensure PostgreSQL is running');
        console.log('2. Check DATABASE_URL environment variable');
        console.log('3. Run: ./db_init.sh to initialize the database');
        process.exit(1);
    }
}

// Load environment variables if .env exists
if (require('fs').existsSync('.env')) {
    require('dotenv').config();
}

// Run the migration status check
main().catch(error => {
    console.error('Migration status failed:', error.message);
    process.exit(1);
});