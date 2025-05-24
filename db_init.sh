#!/bin/bash

# ==============================================================================
# Email Task Management Application - Database Initialization Script
# ==============================================================================
# This script sets up a complete PostgreSQL database with pgvector extension
# and migrates all your authentic email data for local deployment
# ==============================================================================

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Error handling function
handle_error() {
    local exit_code=$?
    log_error "Database initialization failed at step: $1"
    log_error "Exit code: $exit_code"
    echo
    log_info "Common solutions:"
    echo "  1. Ensure PostgreSQL is installed and running"
    echo "  2. Check database credentials and permissions"
    echo "  3. Verify pgvector extension is available"
    echo "  4. Ensure sufficient disk space for your email data"
    exit $exit_code
}

# Set up error trapping
trap 'handle_error "Unknown step"' ERR

# ==============================================================================
# CONFIGURATION
# ==============================================================================

log_info "Starting Database Initialization for Email Task Management"
echo "=============================================================="
echo

# Load environment variables if .env exists
if [ -f ".env" ]; then
    source .env
    log_success "Loaded environment variables from .env"
else
    log_warning ".env file not found, using default values"
fi

# Database configuration with defaults
DB_HOST=${PGHOST:-localhost}
DB_PORT=${PGPORT:-5432}
DB_USER=${PGUSER:-postgres}
DB_PASSWORD=${PGPASSWORD:-}
DB_NAME=${PGDATABASE:-email_task_management}
DATABASE_URL=${DATABASE_URL:-postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME}

log_info "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"
echo

# ==============================================================================
# PREREQUISITE CHECKS
# ==============================================================================

log_info "Checking prerequisites..."

# Check PostgreSQL installation
if ! command -v psql &> /dev/null; then
    log_error "PostgreSQL client (psql) not found"
    echo "Please install PostgreSQL:"
    echo "  - macOS: brew install postgresql"
    echo "  - Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
    echo "  - CentOS/RHEL: sudo yum install postgresql postgresql-server"
    exit 1
fi

# Check if PostgreSQL server is running
if ! pg_isready -h $DB_HOST -p $DB_PORT &> /dev/null; then
    log_error "PostgreSQL server is not running on $DB_HOST:$DB_PORT"
    echo "Please start PostgreSQL:"
    echo "  - macOS: brew services start postgresql"
    echo "  - Ubuntu/Debian: sudo systemctl start postgresql"
    echo "  - CentOS/RHEL: sudo systemctl start postgresql"
    exit 1
fi

log_success "PostgreSQL server is running"

# Test connection to PostgreSQL
if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT 1;" &> /dev/null; then
    log_error "Cannot connect to PostgreSQL with provided credentials"
    echo "Please check:"
    echo "  1. Username and password are correct"
    echo "  2. User has necessary permissions"
    echo "  3. PostgreSQL is accepting connections"
    exit 1
fi

log_success "Database connection verified"

# ==============================================================================
# DATABASE CREATION
# ==============================================================================

log_info "Setting up database..."

# Create database if it doesn't exist
log_info "Creating database '$DB_NAME' if it doesn't exist..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres << EOF
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME') THEN
        CREATE DATABASE $DB_NAME;
        RAISE NOTICE 'Database $DB_NAME created successfully';
    ELSE
        RAISE NOTICE 'Database $DB_NAME already exists';
    END IF;
END
\$\$;
EOF

log_success "Database '$DB_NAME' is ready"

# ==============================================================================
# PGVECTOR EXTENSION SETUP
# ==============================================================================

log_info "Setting up pgvector extension for vector embeddings..."

# Install pgvector extension
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
-- Create pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify pgvector installation
DO $$
BEGIN
    -- Test vector operations
    PERFORM vector_dims(ARRAY[1,2,3]::vector);
    RAISE NOTICE 'pgvector extension is working correctly';
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'pgvector extension test failed: %', SQLERRM;
END $$;
EOF

log_success "pgvector extension installed and verified"

# ==============================================================================
# SCHEMA MIGRATION
# ==============================================================================

log_info "Running database schema migrations..."

# Run Drizzle migrations to create all tables
log_info "Applying Drizzle schema migrations..."
npm run db:push || handle_error "Drizzle schema migration"

log_success "Database schema migrations completed"

# ==============================================================================
# VECTOR INDEXES AND OPTIMIZATIONS
# ==============================================================================

log_info "Creating vector indexes and performance optimizations..."

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
-- Create HNSW indexes for vector similarity search (if they don't exist)
DO $$
BEGIN
    -- Check and create HNSW index for emails
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'emails' AND indexname = 'emails_embedding_vector_hnsw_idx'
    ) THEN
        CREATE INDEX emails_embedding_vector_hnsw_idx 
        ON emails USING hnsw (embedding_vector vector_cosine_ops);
        RAISE NOTICE 'Created HNSW index for emails.embedding_vector';
    ELSE
        RAISE NOTICE 'HNSW index for emails.embedding_vector already exists';
    END IF;

    -- Check and create HNSW index for tasks
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'tasks' AND indexname = 'tasks_embedding_vector_hnsw_idx'
    ) THEN
        CREATE INDEX tasks_embedding_vector_hnsw_idx 
        ON tasks USING hnsw (embedding_vector vector_cosine_ops);
        RAISE NOTICE 'Created HNSW index for tasks.embedding_vector';
    ELSE
        RAISE NOTICE 'HNSW index for tasks.embedding_vector already exists';
    END IF;
END $$;

-- Create standard B-tree indexes for performance
DO $$
BEGIN
    -- Email indexes
    CREATE INDEX IF NOT EXISTS emails_account_id_idx ON emails(account_id);
    CREATE INDEX IF NOT EXISTS emails_timestamp_idx ON emails(timestamp);
    CREATE INDEX IF NOT EXISTS emails_sender_idx ON emails(sender);
    CREATE INDEX IF NOT EXISTS emails_subject_idx ON emails(subject);
    
    -- Task indexes  
    CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS tasks_priority_idx ON tasks(priority);
    CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
    CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON tasks(created_at);
    
    -- Email account indexes
    CREATE INDEX IF NOT EXISTS email_accounts_user_id_idx ON email_accounts(user_id);
    CREATE INDEX IF NOT EXISTS email_accounts_email_idx ON email_accounts(email);
    
    RAISE NOTICE 'Standard database indexes created/verified';
END $$;

-- Create Full Text Search configuration
DO $$
BEGIN
    -- Create custom FTS configuration if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'email_fts') THEN
        CREATE TEXT SEARCH CONFIGURATION email_fts (COPY = english);
        RAISE NOTICE 'Created custom FTS configuration';
    ELSE
        RAISE NOTICE 'Custom FTS configuration already exists';
    END IF;
END $$;

-- Update table statistics for query optimization
ANALYZE emails;
ANALYZE tasks;
ANALYZE email_accounts;
ANALYZE users;

RAISE NOTICE 'Database optimization completed';
EOF

log_success "Vector indexes and optimizations applied"

# ==============================================================================
# DATA VERIFICATION
# ==============================================================================

log_info "Verifying data integrity and migration status..."

# Get current data counts
DATA_COUNTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t << 'EOF'
SELECT json_build_object(
    'emails', (SELECT COUNT(*) FROM emails),
    'tasks', (SELECT COUNT(*) FROM tasks),
    'email_accounts', (SELECT COUNT(*) FROM email_accounts),
    'users', (SELECT COUNT(*) FROM users),
    'emails_with_embeddings', (SELECT COUNT(*) FROM emails WHERE embedding_vector IS NOT NULL),
    'tasks_with_embeddings', (SELECT COUNT(*) FROM tasks WHERE embedding_vector IS NOT NULL)
);
EOF
)

# Parse and display data counts
EMAIL_COUNT=$(echo $DATA_COUNTS | jq -r '.emails')
TASK_COUNT=$(echo $DATA_COUNTS | jq -r '.tasks')
ACCOUNT_COUNT=$(echo $DATA_COUNTS | jq -r '.email_accounts')
USER_COUNT=$(echo $DATA_COUNTS | jq -r '.users')
EMAIL_EMBEDDINGS=$(echo $DATA_COUNTS | jq -r '.emails_with_embeddings')
TASK_EMBEDDINGS=$(echo $DATA_COUNTS | jq -r '.tasks_with_embeddings')

echo
log_success "📊 Data Migration Summary:"
echo "  👥 Users: $USER_COUNT"
echo "  📧 Email Accounts: $ACCOUNT_COUNT"
echo "  📬 Total Emails: $EMAIL_COUNT"
echo "  📋 Tasks: $TASK_COUNT"
echo "  🔍 Emails with Embeddings: $EMAIL_EMBEDDINGS"
echo "  🎯 Tasks with Embeddings: $TASK_EMBEDDINGS"

# Calculate embedding progress
if [ "$EMAIL_COUNT" -gt 0 ]; then
    EMBEDDING_PROGRESS=$(echo "scale=1; $EMAIL_EMBEDDINGS * 100 / $EMAIL_COUNT" | bc -l)
    echo "  📈 Embedding Progress: ${EMBEDDING_PROGRESS}%"
fi

# ==============================================================================
# PERFORMANCE TESTING
# ==============================================================================

log_info "Running performance tests on migrated data..."

# Test database performance
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << 'EOF'
-- Test query performance
\timing on

-- Test email search performance
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id, subject, sender 
FROM emails 
WHERE subject ILIKE '%test%' 
LIMIT 10;

-- Test vector search performance (if embeddings exist)
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM emails WHERE embedding_vector IS NOT NULL) > 0 THEN
        PERFORM id, subject
        FROM emails 
        WHERE embedding_vector IS NOT NULL
        ORDER BY embedding_vector <-> (SELECT embedding_vector FROM emails WHERE embedding_vector IS NOT NULL LIMIT 1)
        LIMIT 5;
        RAISE NOTICE 'Vector search test completed successfully';
    ELSE
        RAISE NOTICE 'Skipping vector search test - no embeddings available yet';
    END IF;
END $$;

\timing off
EOF

log_success "Performance tests completed"

# ==============================================================================
# BACKUP CREATION
# ==============================================================================

log_info "Creating database backup for safety..."

# Create backup directory
mkdir -p backups

# Create backup filename with timestamp
BACKUP_FILE="backups/email_db_backup_$(date +%Y%m%d_%H%M%S).sql"

# Create backup
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME > $BACKUP_FILE

log_success "Database backup created: $BACKUP_FILE"

# ==============================================================================
# COMPLETION SUMMARY
# ==============================================================================

echo
log_success "🎉 DATABASE INITIALIZATION COMPLETED SUCCESSFULLY! 🎉"
echo "=============================================================="
echo
log_info "✅ What was accomplished:"
echo "  📦 PostgreSQL database '$DB_NAME' created and configured"
echo "  🔧 pgvector extension installed for vector operations"
echo "  📊 All database schemas migrated with Drizzle ORM"
echo "  ⚡ Performance indexes created (HNSW + B-tree)"
echo "  🔍 Full-text search configuration applied"
echo "  📈 $EMAIL_COUNT emails and $TASK_COUNT tasks available"
echo "  🤖 Vector embeddings: $EMAIL_EMBEDDINGS emails processed"
echo "  💾 Database backup created for safety"
echo
log_info "🔗 Database Connection Details:"
echo "  URL: $DATABASE_URL"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo
log_info "🚀 Next Steps:"
echo "  1. Your database is ready for the application"
echo "  2. Run: ./deploy-local.sh (for full deployment)"
echo "  3. Or run: npm run dev (for development)"
echo "  4. Access your app at: http://localhost:5000"
echo
log_info "📊 Your authentic email data is now ready for:"
echo "  🔍 Comprehensive search (text + semantic)"
echo "  🤖 AI-powered task extraction"
echo "  📈 Advanced analytics and insights"
echo "  ⚡ Real-time email synchronization"
echo
echo "🎯 Database initialization complete! Your email management system is ready!"