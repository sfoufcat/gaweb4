#!/bin/bash

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║   🔐 Doppler Status & Environment Variables               ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if Doppler is installed
if ! command -v doppler &> /dev/null; then
    echo -e "${RED}❌ Doppler CLI not installed${NC}"
    echo ""
    echo "Install: ./setup-doppler.sh"
    exit 1
fi

echo -e "${GREEN}✅ Doppler CLI:${NC} $(doppler --version)"
echo ""

# Check if authenticated
if ! doppler me &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Doppler${NC}"
    echo ""
    echo "Login: doppler login"
    exit 1
fi

USER_INFO=$(doppler me --json 2>/dev/null | grep -o '"email":"[^"]*' | cut -d'"' -f4)
echo -e "${GREEN}✅ Authenticated:${NC} $USER_INFO"
echo ""

# Check project configuration
if [ -f "doppler.yaml" ]; then
    PROJECT=$(doppler configure get project 2>/dev/null)
    CONFIG=$(doppler configure get config 2>/dev/null)
    
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Current Configuration:${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  Project: ${BLUE}$PROJECT${NC}"
    echo -e "  Config:  ${BLUE}$CONFIG${NC}"
    echo ""
    
    # Try to get secrets count
    if doppler secrets &> /dev/null; then
        SECRET_COUNT=$(doppler secrets --json 2>/dev/null | grep -o '"name"' | wc -l | tr -d ' ')
        echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}Environment Variables:${NC}"
        echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
        echo ""
        echo -e "  Total Secrets: ${GREEN}$SECRET_COUNT${NC}"
        echo ""
        
        # Show secrets (names only, not values)
        echo "  Available secrets:"
        doppler secrets --only-names 2>/dev/null | while read -r secret; do
            echo -e "    • $secret"
        done
    else
        echo -e "${YELLOW}⚠️  Unable to fetch secrets${NC}"
    fi
else
    echo -e "${RED}❌ Doppler not configured for this project${NC}"
    echo ""
    echo "Run: ./setup-doppler.sh"
    exit 1
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Quick Commands:${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  View secrets in browser:"
echo -e "    ${BLUE}npm run doppler:open${NC}"
echo ""
echo -e "  List all secrets (terminal):"
echo -e "    ${BLUE}npm run doppler:secrets${NC}"
echo ""
echo -e "  Run development server:"
echo -e "    ${BLUE}npm run dev${NC}"
echo ""
echo -e "  Build for production:"
echo -e "    ${BLUE}npm run build${NC}"
echo ""

echo -e "${GREEN}✅ Doppler is your single source of truth!${NC}"
echo ""

