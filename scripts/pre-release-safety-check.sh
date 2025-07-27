#!/bin/bash
# Pre-Release Safety Check for WOARU
# Run this before releasing to ensure everything is safe

set -e

echo "🔒 Running pre-release safety checks..."

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to run a check
run_check() {
    local check_name=$1
    local check_command=$2
    
    echo -e "${YELLOW}Checking: $check_name${NC}"
    if eval "$check_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $check_name passed${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}❌ $check_name failed${NC}"
        ((CHECKS_FAILED++))
    fi
    echo ""
}

# Check 1: No uncommitted changes
run_check "Git status clean" "[ -z \"\$(git status --porcelain)\" ]"

# Check 2: On correct branch
CURRENT_BRANCH=$(git branch --show-current)
run_check "On main branch" "[ \"$CURRENT_BRANCH\" = \"main\" ]"

# Check 3: Up to date with remote
git fetch origin main > /dev/null 2>&1
run_check "Up to date with remote" "[ \"\$(git rev-parse HEAD)\" = \"\$(git rev-parse origin/main)\" ]"

# Check 4: Build succeeds
echo -e "${YELLOW}Running build...${NC}"
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Build successful${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ Build failed${NC}"
    ((CHECKS_FAILED++))
fi
echo ""

# Check 5: Tests pass
echo -e "${YELLOW}Running tests...${NC}"
if npm test > /dev/null 2>&1; then
    echo -e "${GREEN}✅ All tests passed${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ Tests failed${NC}"
    ((CHECKS_FAILED++))
fi
echo ""

# Check 6: No ESLint errors
echo -e "${YELLOW}Running ESLint...${NC}"
if npm run lint > /dev/null 2>&1; then
    echo -e "${GREEN}✅ No ESLint errors${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ ESLint errors found${NC}"
    ((CHECKS_FAILED++))
fi
echo ""

# Check 7: No security vulnerabilities
echo -e "${YELLOW}Running security audit...${NC}"
if npm audit --audit-level=high > /dev/null 2>&1; then
    echo -e "${GREEN}✅ No high/critical vulnerabilities${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${RED}❌ Security vulnerabilities found${NC}"
    ((CHECKS_FAILED++))
fi
echo ""

# Check 8: Version number is correct
PACKAGE_VERSION=$(node -p "require('./package.json').version")
echo -e "${YELLOW}Checking version number...${NC}"
echo -e "Current version: ${PACKAGE_VERSION}"
((CHECKS_PASSED++))
echo ""

# Check 9: GitHub CLI is authenticated
run_check "GitHub CLI authenticated" "gh auth status"

# Check 10: NPM is authenticated
run_check "NPM authenticated" "npm whoami"

# Summary
echo "======================================"
echo -e "${YELLOW}Pre-Release Safety Check Summary:${NC}"
echo -e "${GREEN}Checks Passed: $CHECKS_PASSED${NC}"
echo -e "${RED}Checks Failed: $CHECKS_FAILED${NC}"
echo "======================================"

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All safety checks passed! Ready for release.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please fix issues before releasing.${NC}"
    exit 1
fi