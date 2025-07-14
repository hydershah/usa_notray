#!/bin/bash

echo "🚂 Railway.com Multi-Domain Setup for USA Notary Platform"
echo "========================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to check if Railway CLI is installed
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        echo -e "${RED}❌ Railway CLI not found.${NC}"
        echo ""
        echo "Please install Railway CLI first:"
        echo "npm install -g @railway/cli"
        echo ""
        echo "Then run this script again."
        exit 1
    fi
    echo -e "${GREEN}✅ Railway CLI found${NC}"
}

# Helper function to setup environment variables
setup_environment() {
    local environment=$1
    local domain=$2
    
    echo ""
    echo -e "${BLUE}📋 Setting up environment variables for $environment${NC}"
    echo ""
    
    # Set CLIENT_URL based on domain
    railway variables set CLIENT_URL="https://$domain" -e "$environment"
    
    # Set other essential variables
    railway variables set NODE_ENV="$environment" -e "$environment"
    railway variables set SERVE_STATIC_FILES="false" -e "$environment"
    
    # Email configuration
    echo -e "${YELLOW}📧 Email configuration needed for $environment${NC}"
    echo "Please set these variables in the Railway dashboard:"
    echo "  - SMTP_HOST=your-smtp-host"
    echo "  - SMTP_PORT=587"
    echo "  - SMTP_USER=your-email@yourdomain.com"
    echo "  - SMTP_PASS=your-email-password"
    echo "  - FROM_EMAIL=noreply@yourdomain.com"
    echo "  - FROM_NAME=USA Notary Services"
    echo ""
}

# Main setup process
main() {
    echo "This script will help you set up Railway.com deployment with multiple domains."
    echo ""
    
    # Check prerequisites
    check_railway_cli
    
    # Login to Railway
    echo ""
    echo -e "${BLUE}🔐 Logging into Railway...${NC}"
    if ! railway login; then
        echo -e "${RED}❌ Railway login failed${NC}"
        exit 1
    fi
    
    # Check if project exists
    echo ""
    echo -e "${BLUE}📁 Checking Railway project...${NC}"
    if ! railway status > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️ No Railway project found. Creating new project...${NC}"
        railway init
    else
        echo -e "${GREEN}✅ Railway project found${NC}"
    fi
    
    # Setup database
    echo ""
    echo -e "${BLUE}🗄️ Setting up database...${NC}"
    if ! railway add postgresql --yes; then
        echo -e "${YELLOW}⚠️ Database might already exist or failed to create${NC}"
    else
        echo -e "${GREEN}✅ PostgreSQL database added${NC}"
    fi
    
    # Setup Redis (optional)
    echo ""
    read -p "Do you want to add Redis for caching? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        railway add redis --yes
        echo -e "${GREEN}✅ Redis added${NC}"
    else
        echo -e "${YELLOW}⚠️ Redis not added - setting DISABLE_REDIS=true${NC}"
        railway variables set DISABLE_REDIS="true"
    fi
    
    # Setup environments and domains
    echo ""
    echo -e "${BLUE}🌍 Setting up environments and domains${NC}"
    echo ""
    
    # Production setup
    read -p "Enter your production domain (e.g., notary.yourdomain.com): " prod_domain
    if [[ -n "$prod_domain" ]]; then
        setup_environment "production" "$prod_domain"
    fi
    
    # Staging setup
    read -p "Enter your staging domain (e.g., staging.notary.yourdomain.com) [optional]: " staging_domain
    if [[ -n "$staging_domain" ]]; then
        setup_environment "staging" "$staging_domain"
    fi
    
    # Development setup
    read -p "Enter your development domain (e.g., dev.notary.yourdomain.com) [optional]: " dev_domain
    if [[ -n "$dev_domain" ]]; then
        setup_environment "development" "$dev_domain"
    fi
    
    # Deploy
    echo ""
    echo -e "${BLUE}🚀 Ready to deploy!${NC}"
    echo ""
    read -p "Do you want to deploy now? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🔨 Building and deploying...${NC}"
        railway up
        
        if [ $? -eq 0 ]; then
            echo ""
            echo -e "${GREEN}✅ Deployment successful!${NC}"
            echo ""
            echo "🌐 Your application is now live at:"
            [[ -n "$prod_domain" ]] && echo "  Production: https://$prod_domain"
            [[ -n "$staging_domain" ]] && echo "  Staging: https://$staging_domain"
            [[ -n "$dev_domain" ]] && echo "  Development: https://$dev_domain"
            echo ""
            echo "📋 Next steps:"
            echo "1. Set up custom domains in Railway dashboard"
            echo "2. Configure SSL certificates"
            echo "3. Run database migrations"
            echo "4. Test email functionality"
            echo "5. Configure monitoring and logging"
        else
            echo -e "${RED}❌ Deployment failed${NC}"
            echo "Check the logs above for errors."
            exit 1
        fi
    fi
    
    # Show helpful commands
    echo ""
    echo -e "${BLUE}🛠️ Helpful Railway commands:${NC}"
    echo "  railway status              - Check deployment status"
    echo "  railway logs                - View application logs"
    echo "  railway logs --tail         - Stream live logs"
    echo "  railway shell               - Access application shell"
    echo "  railway variables           - View environment variables"
    echo "  railway domain              - Manage custom domains"
    echo "  railway redeploy            - Redeploy application"
    echo ""
    echo -e "${GREEN}🎉 Railway.com setup complete!${NC}"
}

# Run main function
main "$@" 