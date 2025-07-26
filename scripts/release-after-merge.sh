#!/bin/bash
# Release Script for WOARU v5.1.4
# Run this after PR #8 has been merged

set -e  # Exit on error

echo "🚀 Starting release process for WOARU v5.1.4..."

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Update main branch
echo -e "${YELLOW}📥 Updating main branch...${NC}"
git checkout main
git pull origin main

# Step 2: Verify version
PACKAGE_VERSION=$(node -p "require('./package.json').version")
if [ "$PACKAGE_VERSION" != "5.1.4" ]; then
    echo -e "${RED}❌ Error: package.json version is $PACKAGE_VERSION, expected 5.1.4${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Version verified: $PACKAGE_VERSION${NC}"

# Step 3: Create and push tag
echo -e "${YELLOW}🏷️  Creating git tag v5.1.4...${NC}"
git tag -a v5.1.4 -m "Release of version 5.1.4 - Major Technical Hardening & Modernization

- Complete ES Modules migration
- Cross-platform build compatibility
- Over 1,000 ESLint fixes
- Elimination of all TypeScript any types
- Complete internationalization coverage"

echo -e "${YELLOW}📤 Pushing tag to origin...${NC}"
git push origin v5.1.4

# Step 4: Publish GitHub release
echo -e "${YELLOW}📢 Publishing GitHub release...${NC}"
gh release edit v5.1.4 --draft=false

# Step 5: Final build check
echo -e "${YELLOW}🔨 Running final build...${NC}"
npm run build

# Step 6: Run tests
echo -e "${YELLOW}🧪 Running tests...${NC}"
npm test

# Step 7: Publish to NPM
echo -e "${YELLOW}📦 Publishing to NPM...${NC}"
echo -e "${YELLOW}Please make sure you are logged in to NPM (npm login)${NC}"
read -p "Press enter to continue with npm publish..."
npm publish

# Step 8: Success message
echo -e "${GREEN}✅ Release v5.1.4 completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Wait 2-5 minutes for NPM to index the package"
echo "2. Run: npm view woaru@5.1.4"
echo "3. Test: npx woaru@5.1.4 --version"
echo "4. Check: https://www.npmjs.com/package/woaru"
echo "5. Verify: https://github.com/iamthamanic/WOARU-WorkaroundUltra/releases"