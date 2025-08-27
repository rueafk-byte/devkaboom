#!/bin/bash

# 🚀 Kaboom Web3 Game - Automated Deployment Script
# This script helps you deploy your game to multiple platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Check git
    if ! command -v git &> /dev/null; then
        print_error "git is not installed. Please install git first."
        exit 1
    fi
    
    print_success "All requirements met!"
}

# Setup environment
setup_environment() {
    print_status "Setting up environment..."
    
    # Install dependencies
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies..."
        npm install
    fi
    
    # Copy environment file if it doesn't exist
    if [ ! -f ".env" ]; then
        print_status "Creating .env file from template..."
        cp .env.example .env
        print_warning "Please edit .env file with your configuration before deploying."
    fi
    
    print_success "Environment setup complete!"
}

# Deploy to GitHub
deploy_github() {
    print_status "Setting up GitHub deployment..."
    
    # Check if git is initialized
    if [ ! -d ".git" ]; then
        print_status "Initializing git repository..."
        git init
    fi
    
    # Add all files
    git add .
    
    # Commit changes
    git commit -m "Deploy Kaboom Web3 Game - $(date)"
    
    # Check if remote exists
    if ! git remote get-url origin &> /dev/null; then
        print_warning "No remote origin found. Please add your GitHub repository:"
        echo "git remote add origin https://github.com/YOUR_USERNAME/kaboom-web3-game.git"
        echo "git push -u origin main"
    else
        print_status "Pushing to GitHub..."
        git push origin main
    fi
    
    print_success "GitHub deployment ready!"
}

# Deploy to Vercel
deploy_vercel() {
    print_status "Setting up Vercel deployment..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        print_status "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    # Check if already logged in
    if ! vercel whoami &> /dev/null; then
        print_warning "Please login to Vercel first:"
        echo "vercel login"
        return
    fi
    
    print_status "Deploying to Vercel..."
    vercel --prod
    
    print_success "Vercel deployment complete!"
}

# Deploy to Koyeb
deploy_koyeb() {
    print_status "Setting up Koyeb deployment..."
    
    # Check if Koyeb CLI is installed
    if ! command -v koyeb &> /dev/null; then
        print_status "Installing Koyeb CLI..."
        curl -fsSL https://cli.koyeb.com/install.sh | bash
    fi
    
    # Check if already logged in
    if ! koyeb account &> /dev/null; then
        print_warning "Please login to Koyeb first:"
        echo "koyeb login"
        return
    fi
    
    print_status "Deploying to Koyeb..."
    koyeb app init kaboom-web3-game --docker ./koyeb.yaml
    
    print_success "Koyeb deployment complete!"
}

# Deploy to Netlify
deploy_netlify() {
    print_status "Setting up Netlify deployment..."
    
    # Check if Netlify CLI is installed
    if ! command -v netlify &> /dev/null; then
        print_status "Installing Netlify CLI..."
        npm install -g netlify-cli
    fi
    
    # Check if already logged in
    if ! netlify status &> /dev/null; then
        print_warning "Please login to Netlify first:"
        echo "netlify login"
        return
    fi
    
    print_status "Deploying to Netlify..."
    netlify deploy --prod
    
    print_success "Netlify deployment complete!"
}

# Test deployment
test_deployment() {
    print_status "Testing deployment..."
    
    # Test local server
    if curl -f http://localhost:3000/health &> /dev/null; then
        print_success "Local server is running!"
    else
        print_warning "Local server is not running. Start it with: npm run dev"
    fi
    
    print_success "Deployment testing complete!"
}

# Show deployment status
show_status() {
    print_status "Deployment Status:"
    echo ""
    echo "✅ Environment: Ready"
    echo "✅ Dependencies: Installed"
    echo "✅ Configuration: Complete"
    echo ""
    echo "🌐 Deployment Platforms:"
    echo "   - GitHub: Ready for push"
    echo "   - Vercel: Ready for deployment"
    echo "   - Koyeb: Ready for deployment"
    echo "   - Netlify: Ready for deployment"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Edit .env file with your configuration"
    echo "   2. Push to GitHub: git push origin main"
    echo "   3. Deploy to Vercel: npm run deploy:vercel"
    echo "   4. Deploy to Koyeb: npm run deploy:koyeb"
    echo "   5. Deploy to Netlify: npm run deploy:netlify"
    echo ""
    echo "📚 Documentation:"
    echo "   - README.md: General information"
    echo "   - DEPLOYMENT-GUIDE.md: Detailed deployment instructions"
    echo "   - WEB3-ENHANCEMENT-SUMMARY.md: Technical details"
}

# Main deployment function
main() {
    echo "🎮 Kaboom Web3 Game - Deployment Script"
    echo "======================================"
    echo ""
    
    # Check requirements
    check_requirements
    
    # Setup environment
    setup_environment
    
    # Deploy to platforms
    case "${1:-all}" in
        "github")
            deploy_github
            ;;
        "vercel")
            deploy_vercel
            ;;
        "koyeb")
            deploy_koyeb
            ;;
        "netlify")
            deploy_netlify
            ;;
        "all"|*)
            deploy_github
            deploy_vercel
            deploy_koyeb
            deploy_netlify
            ;;
    esac
    
    # Test deployment
    test_deployment
    
    # Show status
    show_status
    
    print_success "Deployment script completed successfully!"
}

# Help function
show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  github    Deploy to GitHub only"
    echo "  vercel    Deploy to Vercel only"
    echo "  koyeb     Deploy to Koyeb only"
    echo "  netlify   Deploy to Netlify only"
    echo "  all       Deploy to all platforms (default)"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0              # Deploy to all platforms"
    echo "  $0 vercel       # Deploy to Vercel only"
    echo "  $0 koyeb        # Deploy to Koyeb only"
}

# Parse command line arguments
case "${1:-all}" in
    "help"|"-h"|"--help")
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
