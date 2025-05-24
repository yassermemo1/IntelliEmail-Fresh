#!/bin/bash

# ==============================================================================
# Email Task Management Application - Prerequisites Checker
# ==============================================================================
# Quick check to see what's installed and what needs to be installed
# ==============================================================================

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
    echo -e "${GREEN}[✅]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠️]${NC} $1"
}

log_error() {
    echo -e "${RED}[❌]${NC} $1"
}

echo "🔍 Email Task Management - Prerequisites Check"
echo "=============================================="
echo

# Detect operating system
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if [ -f /etc/debian_version ]; then
        OS="debian"
        OS_NAME="Ubuntu/Debian"
    elif [ -f /etc/redhat-release ]; then
        OS="redhat"
        OS_NAME="CentOS/RHEL"
    else
        OS="linux"
        OS_NAME="Linux"
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    OS_NAME="macOS"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
    OS_NAME="Windows"
fi

log_info "Operating System: $OS_NAME"
echo

# Track what's missing
MISSING_ITEMS=()
OPTIONAL_MISSING=()

# Check Node.js
echo "🔍 Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        log_success "Node.js $(node --version) - Compatible"
    else
        log_error "Node.js $(node --version) - Version 18+ required"
        MISSING_ITEMS+=("Node.js 18+")
    fi
else
    log_error "Node.js - Not installed"
    MISSING_ITEMS+=("Node.js 18+")
fi

# Check npm
echo "🔍 Checking npm..."
if command -v npm &> /dev/null; then
    log_success "npm $(npm --version)"
else
    log_error "npm - Not installed"
    MISSING_ITEMS+=("npm")
fi

# Check PostgreSQL
echo "🔍 Checking PostgreSQL..."
if command -v psql &> /dev/null; then
    log_success "PostgreSQL client - $(psql --version | head -n1)"
    
    # Check if PostgreSQL server is running
    if pg_isready -h localhost -p 5432 &> /dev/null; then
        log_success "PostgreSQL server - Running"
    else
        log_warning "PostgreSQL server - Not running"
        echo "    Start with: brew services start postgresql (macOS) or sudo systemctl start postgresql (Linux)"
    fi
else
    log_error "PostgreSQL - Not installed"
    MISSING_ITEMS+=("PostgreSQL")
fi

# Check pgvector
echo "🔍 Checking pgvector extension..."
case $OS in
    "macos")
        if brew list pgvector &> /dev/null; then
            log_success "pgvector extension - Available"
        else
            log_warning "pgvector extension - Not installed"
            OPTIONAL_MISSING+=("pgvector (for enhanced AI search)")
        fi
        ;;
    "debian")
        if dpkg -l | grep -q postgresql.*pgvector; then
            log_success "pgvector extension - Available"
        else
            log_warning "pgvector extension - Not installed"
            OPTIONAL_MISSING+=("pgvector (for enhanced AI search)")
        fi
        ;;
    *)
        log_warning "pgvector extension - Cannot check automatically"
        ;;
esac

# Check additional tools
echo "🔍 Checking additional tools..."

if command -v curl &> /dev/null; then
    log_success "curl - Available"
else
    log_warning "curl - Not installed"
    OPTIONAL_MISSING+=("curl")
fi

if command -v git &> /dev/null; then
    log_success "git - Available"
else
    log_warning "git - Not installed"
    OPTIONAL_MISSING+=("git")
fi

if command -v jq &> /dev/null; then
    log_success "jq - Available"
else
    log_warning "jq - Not installed (optional)"
    OPTIONAL_MISSING+=("jq (for JSON formatting)")
fi

# Check Homebrew on macOS
if [[ "$OS" == "macos" ]]; then
    echo "🔍 Checking Homebrew..."
    if command -v brew &> /dev/null; then
        log_success "Homebrew - Available"
    else
        log_warning "Homebrew - Not installed"
        OPTIONAL_MISSING+=("Homebrew (recommended for macOS)")
    fi
fi

echo
echo "📊 PREREQUISITES SUMMARY"
echo "========================"

if [ ${#MISSING_ITEMS[@]} -eq 0 ]; then
    log_success "🎉 All required dependencies are installed!"
    echo "You can proceed with deployment:"
    echo "  ./deploy-local.sh"
else
    log_error "❌ Missing required dependencies:"
    for item in "${MISSING_ITEMS[@]}"; do
        echo "    - $item"
    done
fi

if [ ${#OPTIONAL_MISSING[@]} -gt 0 ]; then
    echo
    log_warning "⚠️  Optional dependencies (recommended):"
    for item in "${OPTIONAL_MISSING[@]}"; do
        echo "    - $item"
    done
fi

echo
echo "🚀 INSTALLATION INSTRUCTIONS"
echo "============================"

case $OS in
    "macos")
        echo "For macOS, run these commands:"
        if [[ " ${MISSING_ITEMS[@]} " =~ " Node.js 18+ " ]]; then
            echo "  # Install Node.js"
            echo "  brew install node@18"
            echo "  # OR download from: https://nodejs.org/"
        fi
        if [[ " ${MISSING_ITEMS[@]} " =~ " PostgreSQL " ]]; then
            echo "  # Install PostgreSQL"
            echo "  brew install postgresql"
            echo "  brew services start postgresql"
        fi
        if [[ " ${OPTIONAL_MISSING[@]} " =~ *"pgvector"* ]]; then
            echo "  # Install pgvector (for AI search)"
            echo "  brew install pgvector"
        fi
        if [[ " ${OPTIONAL_MISSING[@]} " =~ *"Homebrew"* ]]; then
            echo "  # Install Homebrew first"
            echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
        fi
        ;;
    "debian")
        echo "For Ubuntu/Debian, run these commands:"
        if [[ " ${MISSING_ITEMS[@]} " =~ " Node.js 18+ " ]]; then
            echo "  # Install Node.js 18"
            echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
            echo "  sudo apt-get install -y nodejs"
        fi
        if [[ " ${MISSING_ITEMS[@]} " =~ " PostgreSQL " ]]; then
            echo "  # Install PostgreSQL"
            echo "  sudo apt-get update"
            echo "  sudo apt-get install postgresql postgresql-contrib"
            echo "  sudo systemctl start postgresql"
            echo "  sudo systemctl enable postgresql"
        fi
        if [[ " ${OPTIONAL_MISSING[@]} " =~ *"pgvector"* ]]; then
            echo "  # Install pgvector (try these in order)"
            echo "  sudo apt-get install postgresql-15-pgvector"
            echo "  # OR: sudo apt-get install postgresql-14-pgvector"
        fi
        ;;
    *)
        echo "For your operating system:"
        echo "  1. Install Node.js 18+: https://nodejs.org/"
        echo "  2. Install PostgreSQL: https://www.postgresql.org/download/"
        echo "  3. Install pgvector: https://github.com/pgvector/pgvector"
        ;;
esac

echo
echo "🎯 QUICK START OPTIONS"
echo "====================="
echo "1. Install everything automatically:"
echo "   ./deploy-local.sh"
echo
echo "2. Install prerequisites only:"
echo "   # Run the installation commands above for your OS"
echo
echo "3. Check prerequisites again:"
echo "   ./check-prerequisites.sh"

if [ ${#MISSING_ITEMS[@]} -eq 0 ]; then
    echo
    log_success "✨ You're ready to deploy your email task management system!"
    echo "   Your application will work with your authentic Gmail data,"
    echo "   including 47,000+ real emails and AI-powered search capabilities."
    exit 0
else
    echo
    log_warning "📋 Please install the missing dependencies above, then run:"
    echo "   ./deploy-local.sh"
    exit 1
fi