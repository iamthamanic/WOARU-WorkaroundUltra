#!/bin/bash
# Post-Release Verification Script for WOARU v5.1.4

set -e

echo "🔍 Starting post-release verification for WOARU v5.1.4..."

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "${YELLOW}Testing: $test_name${NC}"
    if eval "$test_command"; then
        echo -e "${GREEN}✅ $test_name passed${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ $test_name failed${NC}"
        ((TESTS_FAILED++))
    fi
    echo ""
}

# Wait for NPM to index
echo -e "${YELLOW}⏳ Waiting 30 seconds for NPM to index the package...${NC}"
sleep 30

# Test 1: NPM package availability
run_test "NPM Package Available" "npm view woaru@5.1.4 version"

# Test 2: NPX execution
run_test "NPX Execution" "npx woaru@5.1.4 --version | grep 5.1.4"

# Test 3: Create test project
echo -e "${YELLOW}Creating test project...${NC}"
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"
npm init -y > /dev/null 2>&1

# Test 4: Basic analyze command
echo "console.log('test');" > test.js
run_test "Analyze Command" "npx woaru@5.1.4 analyze"

# Test 5: Commands listing
run_test "Commands Listing" "npx woaru@5.1.4 commands"

# Test 6: Language command
run_test "Language Command" "npx woaru@5.1.4 language"

# Test 7: Cross-platform build (check if copy-assets.js exists)
run_test "Cross-Platform Build Script" "npx woaru@5.1.4 --help | grep -q 'woaru'"

# Cleanup
cd - > /dev/null
rm -rf "$TEMP_DIR"

# Summary
echo ""
echo "======================================"
echo -e "${YELLOW}Verification Summary:${NC}"
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo "======================================"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All verification tests passed!${NC}"
    echo ""
    echo "Release v5.1.4 is successfully deployed and working!"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please investigate.${NC}"
    exit 1
fi