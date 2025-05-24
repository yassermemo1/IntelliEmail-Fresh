#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Email Task Management Application
 * Tests all major features including search, vector embeddings, and RAG functionality
 */

const { Pool } = require('pg');
const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000';
const TEST_TIMEOUT = 30000;

// Color codes for output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

// Logging functions
const log = {
    info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`)
};

// Test results tracking
let testResults = {
    passed: 0,
    failed: 0,
    warnings: 0,
    tests: []
};

function recordTest(name, status, message = '') {
    testResults.tests.push({ name, status, message });
    if (status === 'PASS') testResults.passed++;
    else if (status === 'FAIL') testResults.failed++;
    else if (status === 'WARN') testResults.warnings++;
}

// Test functions
async function testDatabaseConnection() {
    log.info('Testing database connection...');
    try {
        const pool = new Pool({ 
            connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/email_task_management'
        });
        
        const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
        await pool.end();
        
        log.success(`Database connected - PostgreSQL ${result.rows[0].pg_version.split(' ')[1]}`);
        recordTest('Database Connection', 'PASS');
        return true;
    } catch (error) {
        log.error(`Database connection failed: ${error.message}`);
        recordTest('Database Connection', 'FAIL', error.message);
        return false;
    }
}

async function testVectorExtension() {
    log.info('Testing pgvector extension...');
    try {
        const pool = new Pool({ 
            connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/email_task_management'
        });
        
        await pool.query('SELECT vector_dims(ARRAY[1,2,3]::vector) as dims');
        await pool.end();
        
        log.success('pgvector extension is working');
        recordTest('Vector Extension', 'PASS');
        return true;
    } catch (error) {
        log.warning(`pgvector extension not available: ${error.message}`);
        recordTest('Vector Extension', 'WARN', 'Vector search features may be limited');
        return false;
    }
}

async function testDataIntegrity() {
    log.info('Testing data integrity...');
    try {
        const pool = new Pool({ 
            connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/email_task_management'
        });
        
        // Count emails and tasks
        const emailCount = await pool.query('SELECT COUNT(*) as count FROM emails');
        const taskCount = await pool.query('SELECT COUNT(*) as count FROM tasks');
        const accountCount = await pool.query('SELECT COUNT(*) as count FROM email_accounts');
        
        await pool.end();
        
        const emails = parseInt(emailCount.rows[0].count);
        const tasks = parseInt(taskCount.rows[0].count);
        const accounts = parseInt(accountCount.rows[0].count);
        
        log.success(`Data integrity check: ${emails} emails, ${tasks} tasks, ${accounts} accounts`);
        recordTest('Data Integrity', 'PASS', `${emails} emails, ${tasks} tasks, ${accounts} accounts`);
        
        if (emails === 0) {
            log.warning('No emails found in database - search functionality may be limited');
        }
        
        return true;
    } catch (error) {
        log.error(`Data integrity check failed: ${error.message}`);
        recordTest('Data Integrity', 'FAIL', error.message);
        return false;
    }
}

async function testServerHealth() {
    log.info('Testing server health...');
    try {
        const response = await axios.get(`${BASE_URL}/api/health`, { timeout: 5000 });
        log.success(`Server is healthy - Status: ${response.status}`);
        recordTest('Server Health', 'PASS');
        return true;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            log.error('Server is not running. Please start the server first.');
        } else {
            log.error(`Server health check failed: ${error.message}`);
        }
        recordTest('Server Health', 'FAIL', error.message);
        return false;
    }
}

async function testEmailEndpoints() {
    log.info('Testing email API endpoints...');
    try {
        const response = await axios.get(`${BASE_URL}/api/emails?limit=5`, { timeout: 10000 });
        const emails = response.data;
        
        log.success(`Email API working - Retrieved ${emails.length} emails`);
        recordTest('Email API', 'PASS', `Retrieved ${emails.length} emails`);
        return true;
    } catch (error) {
        log.error(`Email API test failed: ${error.message}`);
        recordTest('Email API', 'FAIL', error.message);
        return false;
    }
}

async function testTaskEndpoints() {
    log.info('Testing task API endpoints...');
    try {
        const response = await axios.get(`${BASE_URL}/api/tasks?limit=5`, { timeout: 10000 });
        const tasks = response.data;
        
        log.success(`Task API working - Retrieved ${tasks.length} tasks`);
        recordTest('Task API', 'PASS', `Retrieved ${tasks.length} tasks`);
        return true;
    } catch (error) {
        log.error(`Task API test failed: ${error.message}`);
        recordTest('Task API', 'FAIL', error.message);
        return false;
    }
}

async function testSearchFunctionality() {
    log.info('Testing search functionality...');
    try {
        // Test email search
        const emailSearchResponse = await axios.get(`${BASE_URL}/api/find-emails?query=test`, { timeout: 10000 });
        const emailResults = emailSearchResponse.data;
        
        // Test task search
        const taskSearchResponse = await axios.get(`${BASE_URL}/api/find-tasks?query=test`, { timeout: 10000 });
        const taskResults = taskSearchResponse.data;
        
        log.success(`Search functionality working - Found ${emailResults.length} emails, ${taskResults.length} tasks`);
        recordTest('Search Functionality', 'PASS', `Found ${emailResults.length} emails, ${taskResults.length} tasks`);
        return true;
    } catch (error) {
        log.error(`Search functionality test failed: ${error.message}`);
        recordTest('Search Functionality', 'FAIL', error.message);
        return false;
    }
}

async function testEmbeddingSystem() {
    log.info('Testing embedding system...');
    try {
        const pool = new Pool({ 
            connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/email_task_management'
        });
        
        // Check if embeddings exist
        const result = await pool.query(`
            SELECT COUNT(*) as with_embeddings 
            FROM emails 
            WHERE embedding_vector IS NOT NULL
        `);
        await pool.end();
        
        const embeddingCount = parseInt(result.rows[0].with_embeddings);
        
        if (embeddingCount > 0) {
            log.success(`Embedding system working - ${embeddingCount} emails have embeddings`);
            recordTest('Embedding System', 'PASS', `${embeddingCount} emails with embeddings`);
        } else {
            log.warning('No embeddings found - vector search may not work optimally');
            recordTest('Embedding System', 'WARN', 'No embeddings found');
        }
        return true;
    } catch (error) {
        log.error(`Embedding system test failed: ${error.message}`);
        recordTest('Embedding System', 'FAIL', error.message);
        return false;
    }
}

async function testStatisticsEndpoint() {
    log.info('Testing statistics endpoint...');
    try {
        const response = await axios.get(`${BASE_URL}/api/stats`, { timeout: 10000 });
        const stats = response.data;
        
        log.success(`Statistics API working - Total emails: ${stats.emails?.total || 0}`);
        recordTest('Statistics API', 'PASS');
        return true;
    } catch (error) {
        log.error(`Statistics API test failed: ${error.message}`);
        recordTest('Statistics API', 'FAIL', error.message);
        return false;
    }
}

function generateTestReport() {
    console.log('\n' + '='.repeat(60));
    console.log('COMPREHENSIVE TEST RESULTS');
    console.log('='.repeat(60));
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Passed: ${testResults.passed}`);
    console.log(`   ❌ Failed: ${testResults.failed}`);
    console.log(`   ⚠️  Warnings: ${testResults.warnings}`);
    console.log(`   📋 Total: ${testResults.tests.length}`);
    
    console.log(`\n📋 Detailed Results:`);
    testResults.tests.forEach(test => {
        const icon = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '⚠️';
        const message = test.message ? ` - ${test.message}` : '';
        console.log(`   ${icon} ${test.name}${message}`);
    });
    
    const successRate = Math.round((testResults.passed / testResults.tests.length) * 100);
    
    if (testResults.failed === 0) {
        log.success(`🎉 All critical tests passed! Success rate: ${successRate}%`);
        console.log('\n🚀 Your application is ready for local deployment!');
        console.log('   Run: ./deploy-local.sh');
    } else {
        log.error(`❌ ${testResults.failed} critical tests failed. Please fix these issues before deployment.`);
        console.log('\n🔧 Next steps:');
        console.log('   1. Review failed tests above');
        console.log('   2. Check server logs for detailed error information');
        console.log('   3. Verify environment configuration');
        console.log('   4. Re-run tests after fixes');
    }
    
    console.log('\n📖 For troubleshooting help, check the deployment script comments.');
}

async function runAllTests() {
    console.log('🧪 Starting Comprehensive Test Suite for Email Task Management Application');
    console.log('='.repeat(80));
    
    // Core infrastructure tests
    await testDatabaseConnection();
    await testVectorExtension();
    await testDataIntegrity();
    
    // Server and API tests
    await testServerHealth();
    await testEmailEndpoints();
    await testTaskEndpoints();
    await testStatisticsEndpoint();
    
    // Advanced feature tests
    await testSearchFunctionality();
    await testEmbeddingSystem();
    
    // Generate final report
    generateTestReport();
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle process termination
process.on('SIGINT', () => {
    log.info('Test interrupted by user');
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log.error(`Unhandled Rejection: ${reason}`);
    process.exit(1);
});

// Load environment variables if .env exists
if (require('fs').existsSync('.env')) {
    require('dotenv').config();
}

// Run tests
runAllTests().catch(error => {
    log.error(`Test suite failed: ${error.message}`);
    process.exit(1);
});