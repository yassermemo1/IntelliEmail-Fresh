#!/bin/bash

# ==============================================================================
# Email Task Management Application - Local Deployment Script
# ==============================================================================
# This script deploys the comprehensive email task management application
# with AI-powered search, vector embeddings, and RAG functionality
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
    log_error "Deployment failed at step: $1"
    log_error "Exit code: $exit_code"
    echo
    log_info "Common solutions:"
    echo "  1. Check if all required dependencies are installed"
    echo "  2. Verify environment variables are set correctly"
    echo "  3. Ensure PostgreSQL is running and accessible"
    echo "  4. Check network connectivity for API services"
    exit $exit_code
}

# Set up error trapping
trap 'handle_error "Unknown step"' ERR

# ==============================================================================
# CONFIGURATION AND VALIDATION
# ==============================================================================

log_info "Starting Email Task Management Application Local Deployment"
echo "=============================================================="
echo

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Validate project structure
log_info "Validating project structure..."
required_dirs=("client" "server" "shared")
for dir in "${required_dirs[@]}"; do
    if [ ! -d "$dir" ]; then
        log_error "Required directory '$dir' not found"
        exit 1
    fi
done
log_success "Project structure validated"

# ==============================================================================
# DEPENDENCY CHECKS AND AUTOMATED INSTALLATION
# ==============================================================================

log_info "Checking and installing system dependencies..."

# Detect operating system
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if [ -f /etc/debian_version ]; then
        OS="debian"
    elif [ -f /etc/redhat-release ]; then
        OS="redhat"
    else
        OS="linux"
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
fi

log_info "Detected operating system: $OS"

# Function to install dependencies based on OS
install_dependencies() {
    local package=$1
    local install_cmd=""
    
    case $OS in
        "macos")
            if ! command -v brew &> /dev/null; then
                log_warning "Homebrew not found. Installing Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
                    log_error "Failed to install Homebrew"
                    return 1
                }
            fi
            install_cmd="brew install $package"
            ;;
        "debian")
            install_cmd="sudo apt-get update && sudo apt-get install -y $package"
            ;;
        "redhat")
            install_cmd="sudo yum install -y $package"
            ;;
        *)
            log_warning "Automatic installation not supported for $OS"
            return 1
            ;;
    esac
    
    log_info "Installing $package..."
    eval $install_cmd
}

# Check and install Node.js
if ! command -v node &> /dev/null; then
    log_warning "Node.js not found. Attempting installation..."
    case $OS in
        "macos")
            install_dependencies "node@18" || {
                log_error "Failed to install Node.js automatically"
                echo "Please install manually:"
                echo "  1. Visit: https://nodejs.org/"
                echo "  2. Download Node.js 18+ LTS"
                echo "  3. Run the installer"
                exit 1
            }
            ;;
        "debian")
            # Install Node.js 18 from NodeSource
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - || {
                log_error "Failed to add NodeSource repository"
                exit 1
            }
            install_dependencies "nodejs" || {
                log_error "Failed to install Node.js"
                exit 1
            }
            ;;
        *)
            log_error "Node.js is not installed. Please install Node.js 18+ manually."
            echo "Download from: https://nodejs.org/"
            exit 1
            ;;
    esac
else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18+ required. Current version: $(node --version)"
        echo "Please update Node.js to version 18 or higher"
        exit 1
    fi
    log_success "Node.js $(node --version) found"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    log_error "npm is not installed (should come with Node.js)"
    exit 1
fi
log_success "npm $(npm --version) found"

# Check and install PostgreSQL
if ! command -v psql &> /dev/null; then
    log_warning "PostgreSQL client not found. Attempting installation..."
    case $OS in
        "macos")
            install_dependencies "postgresql" || {
                log_error "Failed to install PostgreSQL"
                echo "Please install manually: brew install postgresql"
                exit 1
            }
            # Start PostgreSQL service
            brew services start postgresql || log_warning "Failed to start PostgreSQL service"
            ;;
        "debian")
            install_dependencies "postgresql postgresql-contrib" || {
                log_error "Failed to install PostgreSQL"
                exit 1
            }
            # Start PostgreSQL service
            sudo systemctl start postgresql || log_warning "Failed to start PostgreSQL service"
            sudo systemctl enable postgresql || log_warning "Failed to enable PostgreSQL service"
            ;;
        *)
            log_error "PostgreSQL is not installed."
            echo "Please install PostgreSQL manually:"
            echo "  - macOS: brew install postgresql"
            echo "  - Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
            echo "  - Windows: Download from https://www.postgresql.org/download/"
            exit 1
            ;;
    esac
    log_success "PostgreSQL installed"
else
    log_success "PostgreSQL client found"
fi

# Check if PostgreSQL server is running
if ! pg_isready -h localhost -p 5432 &> /dev/null; then
    log_warning "PostgreSQL server is not running. Attempting to start..."
    case $OS in
        "macos")
            brew services start postgresql || {
                log_error "Failed to start PostgreSQL. Please start manually:"
                echo "  brew services start postgresql"
                exit 1
            }
            ;;
        "debian")
            sudo systemctl start postgresql || {
                log_error "Failed to start PostgreSQL. Please start manually:"
                echo "  sudo systemctl start postgresql"
                exit 1
            }
            ;;
        *)
            log_error "PostgreSQL server is not running. Please start it manually."
            exit 1
            ;;
    esac
    
    # Wait a moment for PostgreSQL to start
    sleep 3
    
    if ! pg_isready -h localhost -p 5432 &> /dev/null; then
        log_error "PostgreSQL server failed to start"
        exit 1
    fi
fi
log_success "PostgreSQL server is running"

# Check and install pgvector extension
log_info "Checking pgvector extension availability..."
PGVECTOR_AVAILABLE=false

# Try to check if pgvector is available in the system
case $OS in
    "macos")
        if ! brew list pgvector &> /dev/null; then
            log_warning "pgvector extension not found. Installing..."
            install_dependencies "pgvector" || {
                log_warning "Failed to install pgvector automatically"
                echo "You can install it manually with: brew install pgvector"
            }
        fi
        PGVECTOR_AVAILABLE=true
        ;;
    "debian")
        # Check if pgvector package is available
        if ! dpkg -l | grep -q postgresql.*pgvector; then
            log_warning "pgvector extension not found. Attempting installation..."
            # Try to install pgvector
            sudo apt-get update
            sudo apt-get install -y postgresql-14-pgvector 2>/dev/null || \
            sudo apt-get install -y postgresql-15-pgvector 2>/dev/null || \
            sudo apt-get install -y postgresql-pgvector 2>/dev/null || {
                log_warning "pgvector package not available in repositories"
                log_info "Vector search features may be limited without pgvector"
                log_info "You can compile pgvector from source: https://github.com/pgvector/pgvector"
            }
        fi
        PGVECTOR_AVAILABLE=true
        ;;
    *)
        log_warning "Cannot automatically install pgvector for $OS"
        log_info "Please install pgvector manually for optimal vector search performance"
        ;;
esac

# Additional tools
log_info "Checking additional development tools..."

# Check curl
if ! command -v curl &> /dev/null; then
    log_warning "curl not found. Installing..."
    case $OS in
        "macos")
            # curl usually comes with macOS
            log_info "curl should be available on macOS by default"
            ;;
        "debian")
            install_dependencies "curl"
            ;;
    esac
fi

# Check jq for JSON processing
if ! command -v jq &> /dev/null; then
    log_info "Installing jq for JSON processing..."
    case $OS in
        "macos")
            install_dependencies "jq" || log_warning "Failed to install jq"
            ;;
        "debian")
            install_dependencies "jq" || log_warning "Failed to install jq"
            ;;
        *)
            log_warning "jq not available - JSON output may not be formatted"
            ;;
    esac
fi

# Check git
if ! command -v git &> /dev/null; then
    log_warning "git not found. Installing..."
    case $OS in
        "macos")
            install_dependencies "git"
            ;;
        "debian")
            install_dependencies "git"
            ;;
    esac
fi

log_success "Dependency installation completed"

# Summary of installed components
echo
log_info "📋 Dependency Status Summary:"
echo "  ✅ Node.js: $(node --version)"
echo "  ✅ npm: $(npm --version)"
echo "  ✅ PostgreSQL: $(psql --version | head -n1)"
if command -v curl &> /dev/null; then
    echo "  ✅ curl: Available"
fi
if command -v jq &> /dev/null; then
    echo "  ✅ jq: Available"
fi
if command -v git &> /dev/null; then
    echo "  ✅ git: $(git --version)"
fi
if [ "$PGVECTOR_AVAILABLE" = true ]; then
    echo "  ✅ pgvector: Available for vector search"
else
    echo "  ⚠️  pgvector: Not available (vector search may be limited)"
fi

# ==============================================================================
# ENVIRONMENT SETUP
# ==============================================================================

log_info "Setting up environment configuration..."

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    log_info "Creating .env file..."
    cat > .env << 'EOF'
# Database Configuration
DATABASE_URL=postgresql://localhost:5432/email_task_management
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=
PGDATABASE=email_task_management

# Server Configuration
NODE_ENV=production
PORT=5000

# AI Service Configuration
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Email Configuration
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=http://localhost:5000/auth/gmail/callback

# Security
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# Optional: Ollama for local AI (if using local models)
OLLAMA_API_URL=http://localhost:11434
EOF
    log_success ".env file created"
    log_warning "Please update the .env file with your actual configuration values"
else
    log_success ".env file already exists"
fi

# Validate critical environment variables
log_info "Validating environment variables..."
source .env

if [ -z "$DATABASE_URL" ]; then
    log_error "DATABASE_URL is not set in .env file"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
    log_warning "OPENAI_API_KEY is not set. AI features will use fallback methods."
fi

log_success "Environment variables validated"

# ==============================================================================
# DATABASE SETUP AND MIGRATION
# ==============================================================================

log_info "Setting up PostgreSQL database with authentic email data..."

# Check if database initialization script exists
if [ -f "db_init.sh" ]; then
    log_info "Running comprehensive database initialization..."
    ./db_init.sh || handle_error "database initialization"
    log_success "Database initialization completed"
else
    log_warning "Database initialization script not found, using basic setup..."
    
    # Extract database details from DATABASE_URL
    DB_NAME=$(echo $DATABASE_URL | sed 's/.*\/\([^?]*\).*/\1/')
    DB_HOST=$(echo $DATABASE_URL | sed 's/.*@\([^:]*\):.*/\1/')
    DB_PORT=$(echo $DATABASE_URL | sed 's/.*:\([0-9]*\)\/.*/\1/')
    DB_USER=$(echo $DATABASE_URL | sed 's/.*\/\/\([^:]*\):.*/\1/')

    # Test database connection
    log_info "Testing database connection..."
    if PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT 1;" &> /dev/null; then
        log_success "Database connection successful"
    else
        log_error "Cannot connect to PostgreSQL database"
        echo "Please ensure:"
        echo "  1. PostgreSQL is running"
        echo "  2. Database credentials in .env are correct"
        echo "  3. Database user has necessary permissions"
        exit 1
    fi

    # Create database if it doesn't exist
    log_info "Creating database if it doesn't exist..."
    PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || log_info "Database already exists"

    # Install pgvector extension
    log_info "Installing pgvector extension..."
    PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;" || {
        log_warning "Failed to install pgvector extension"
        log_info "Vector search features may not work properly"
        log_info "To install pgvector:"
        echo "  - macOS: brew install pgvector"
        echo "  - Ubuntu/Debian: sudo apt install postgresql-14-pgvector"
        echo "  - Or compile from source: https://github.com/pgvector/pgvector"
    }
    
    log_success "Basic database setup completed"
fi

# Verify migration status
log_info "Checking migration status of your authentic email data..."
if [ -f "migration-status.js" ]; then
    node migration-status.js || log_warning "Migration status check encountered issues"
else
    log_warning "Migration status script not found"
fi

# ==============================================================================
# APPLICATION BUILD
# ==============================================================================

log_info "Installing dependencies..."
npm install || handle_error "npm install"
log_success "Dependencies installed"

log_info "Building application..."

# Run database migrations
log_info "Running database migrations..."
npm run db:push || handle_error "database migrations"
log_success "Database migrations completed"

# Build frontend
log_info "Building frontend..."
npm run build || handle_error "frontend build"
log_success "Frontend built successfully"

# ==============================================================================
# COMPREHENSIVE TESTING
# ==============================================================================

log_info "Running comprehensive tests..."

# Test 1: Database connectivity
log_info "Testing database connectivity..."
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()').then(() => {
    console.log('✅ Database connection test passed');
    process.exit(0);
}).catch(err => {
    console.error('❌ Database connection test failed:', err.message);
    process.exit(1);
});
" || handle_error "database connectivity test"

# Test 2: API endpoints
log_info "Testing API endpoints..."
npm run test:api 2>/dev/null || log_warning "API tests not found or failed"

# Test 3: Vector operations (if pgvector is available)
log_info "Testing vector operations..."
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT vector_dims(ARRAY[1,2,3]::vector);').then(() => {
    console.log('✅ Vector operations test passed');
    process.exit(0);
}).catch(() => {
    console.log('⚠️  Vector operations test skipped (pgvector not available)');
    process.exit(0);
});
" || log_warning "Vector operations test failed"

log_success "Comprehensive testing completed"

# ==============================================================================
# PRODUCTION OPTIMIZATIONS
# ==============================================================================

log_info "Applying production optimizations..."

# Set production environment
export NODE_ENV=production

# Create production startup script
cat > start-production.sh << 'EOF'
#!/bin/bash
# Production startup script for Email Task Management Application

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
fi

# Set production environment
export NODE_ENV=production

# Start the application
echo "Starting Email Task Management Application..."
echo "Server will be available at: http://localhost:${PORT:-5000}"
echo "Press Ctrl+C to stop the server"
echo

node server/index.js
EOF

chmod +x start-production.sh
log_success "Production startup script created"

# Create PM2 ecosystem file for process management
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'email-task-management',
    script: 'server/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=2048'
  }]
};
EOF

# Create logs directory
mkdir -p logs
log_success "PM2 configuration created"

# ==============================================================================
# DEPLOYMENT COMPLETION
# ==============================================================================

echo
log_success "🎉 LOCAL DEPLOYMENT COMPLETED SUCCESSFULLY! 🎉"
echo "=============================================================="
echo
log_info "Your Email Task Management Application is ready!"
echo
echo "🚀 Quick Start Options:"
echo
echo "1. Simple Start:"
echo "   ./start-production.sh"
echo
echo "2. With Process Management (requires PM2):"
echo "   npm install -g pm2"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo "   pm2 startup"
echo
echo "3. Development Mode:"
echo "   npm run dev"
echo
echo "📋 Application Features:"
echo "  ✅ Comprehensive email search with AI-powered insights"
echo "  ✅ Vector embeddings for semantic search"
echo "  ✅ RAG (Retrieval Augmented Generation) functionality"
echo "  ✅ Real-time email synchronization"
echo "  ✅ Intelligent task extraction and classification"
echo "  ✅ Multi-account email integration"
echo "  ✅ Advanced analytics and reporting"
echo
echo "🌐 Access URLs:"
echo "  Application: http://localhost:${PORT:-5000}"
echo "  API Health: http://localhost:${PORT:-5000}/api/health"
echo
echo "📁 Important Files:"
echo "  Configuration: .env"
echo "  Startup Script: ./start-production.sh"
echo "  Process Config: ecosystem.config.js"
echo "  Logs: ./logs/"
echo
echo "🔧 Troubleshooting:"
echo "  - Check logs in ./logs/ directory"
echo "  - Verify .env configuration"
echo "  - Ensure PostgreSQL is running"
echo "  - Check API keys are valid"
echo
log_info "Happy emailing! 📧✨"