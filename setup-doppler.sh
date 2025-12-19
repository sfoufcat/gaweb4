#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║                                                   ║"
echo "║   🔐 Doppler Environment Setup                    ║"
echo "║   Single Source of Truth for Secrets             ║"
echo "║                                                   ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Check if Doppler CLI is installed
echo -e "${BLUE}📦 Checking for Doppler CLI...${NC}"
if ! command -v doppler &> /dev/null; then
    echo -e "${RED}❌ Doppler CLI not found${NC}"
    echo ""
    echo "Please install Doppler CLI:"
    echo ""
    echo "  macOS:"
    echo "    brew install dopplerhq/cli/doppler"
    echo ""
    echo "  Windows (Scoop):"
    echo "    scoop bucket add doppler https://github.com/DopplerHQ/scoop-doppler.git"
    echo "    scoop install doppler"
    echo ""
    echo "  Linux:"
    echo "    curl -Ls https://cli.doppler.com/install.sh | sudo sh"
    echo ""
    exit 1
else
    echo -e "${GREEN}✅ Doppler CLI found: $(doppler --version)${NC}"
fi

echo ""

# Check if user is logged in
echo -e "${BLUE}🔑 Checking Doppler authentication...${NC}"
if ! doppler me &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Doppler${NC}"
    echo ""
    echo "Please login to Doppler:"
    echo "  $ doppler login"
    echo ""
    read -p "Press Enter after logging in..."
    echo ""
fi

# Verify login again
if ! doppler me &> /dev/null; then
    echo -e "${RED}❌ Still not logged in. Please run: doppler login${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Authenticated with Doppler${NC}"
fi

echo ""

# Setup Doppler project
echo -e "${BLUE}🔧 Setting up Doppler project...${NC}"
echo ""

if [ -f "doppler.yaml" ]; then
    echo -e "${YELLOW}⚠️  doppler.yaml already exists${NC}"
    echo ""
    read -p "Do you want to reconfigure? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm doppler.yaml
        doppler setup
    else
        echo -e "${GREEN}✅ Using existing configuration${NC}"
    fi
else
    doppler setup
fi

echo ""

# Verify setup
echo -e "${BLUE}🔍 Verifying Doppler configuration...${NC}"
if doppler secrets &> /dev/null; then
    echo -e "${GREEN}✅ Doppler is configured correctly${NC}"
    echo ""
    
    # Show current environment
    PROJECT=$(doppler configure get project 2>/dev/null)
    CONFIG=$(doppler configure get config 2>/dev/null)
    
    echo -e "${GREEN}Current Configuration:${NC}"
    echo -e "  Project: ${BLUE}$PROJECT${NC}"
    echo -e "  Config:  ${BLUE}$CONFIG${NC}"
else
    echo -e "${RED}❌ Doppler configuration failed${NC}"
    exit 1
fi

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║                                                   ║"
echo "║   ✅ Doppler Setup Complete!                      ║"
echo "║                                                   ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo ""
echo "  1. Manage secrets:"
echo -e "     ${BLUE}$ npm run doppler:open${NC}"
echo -e "     ${BLUE}$ npm run doppler:secrets${NC}"
echo ""
echo "  2. Run development server:"
echo -e "     ${BLUE}$ npm run dev${NC}"
echo ""
echo "  3. Build for production:"
echo -e "     ${BLUE}$ npm run build${NC}"
echo ""
echo -e "${YELLOW}Note:${NC} All npm commands now use Doppler by default!"
echo ""
echo -e "${GREEN}🎉 Your environment variables are secure in Doppler!${NC}"
echo ""
