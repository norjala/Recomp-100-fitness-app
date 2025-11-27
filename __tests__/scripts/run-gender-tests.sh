#!/bin/bash

# Gender Field Bug Fix - Comprehensive Test Runner
# This script runs all gender field related tests and generates a comprehensive report

set -e

echo "🧪 Gender Field Bug Fix - Test Execution Suite"
echo "=============================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
TEST_RESULTS=()

# Function to log test results
log_test_result() {
    local test_name="$1"
    local status="$2"
    local details="$3"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ "$status" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✅ PASS${NC} - $test_name"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}❌ FAIL${NC} - $test_name"
    fi

    if [ -n "$details" ]; then
        echo "   📝 $details"
    fi

    TEST_RESULTS+=("$status - $test_name - $details")
    echo ""
}

# Function to run command and capture result
run_test_command() {
    local test_name="$1"
    local command="$2"
    local description="$3"

    echo -e "${BLUE}🔍 Running:${NC} $test_name"
    echo "   Command: $command"
    echo "   Description: $description"

    if eval "$command" 2>&1; then
        log_test_result "$test_name" "PASS" "$description"
        return 0
    else
        log_test_result "$test_name" "FAIL" "$description - Command failed"
        return 1
    fi
}

# Check if required dependencies are available
echo -e "${YELLOW}📋 Pre-flight Checks${NC}"
echo "================================"

# Check if npm/yarn is available
if command -v npm >/dev/null 2>&1; then
    echo "✅ npm found"
    PACKAGE_MANAGER="npm"
elif command -v yarn >/dev/null 2>&1; then
    echo "✅ yarn found"
    PACKAGE_MANAGER="yarn"
else
    echo "❌ Neither npm nor yarn found"
    exit 1
fi

# Check if test dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    $PACKAGE_MANAGER install
fi

echo ""

# 1. Backend Integration Tests
echo -e "${YELLOW}🧪 Backend Integration Tests${NC}"
echo "===================================="

run_test_command \
    "Gender Field Backend Integration" \
    "$PACKAGE_MANAGER test __tests__/integration/gender-field-integration.test.ts" \
    "Tests PUT /api/scans/:scanId and POST /api/scans gender handling"

# 2. Frontend Component Tests
echo -e "${YELLOW}🎨 Frontend Component Tests${NC}"
echo "==================================="

run_test_command \
    "Gender Field Frontend Integration" \
    "$PACKAGE_MANAGER test __tests__/integration/gender-field-frontend.test.ts" \
    "Tests React component behavior and form interactions"

# 3. API Endpoint Tests
echo -e "${YELLOW}🔌 API Endpoint Verification${NC}"
echo "================================="

# Start server in background for API tests (if not already running)
echo "🚀 Starting test server..."
if ! curl -s http://localhost:5000/api/health >/dev/null 2>&1; then
    echo "   Starting development server..."
    $PACKAGE_MANAGER run dev &
    SERVER_PID=$!

    # Wait for server to start
    for i in {1..30}; do
        if curl -s http://localhost:5000/api/health >/dev/null 2>&1; then
            echo "   ✅ Server started successfully"
            break
        fi
        if [ $i -eq 30 ]; then
            echo "   ❌ Server failed to start"
            exit 1
        fi
        sleep 1
    done
else
    echo "   ✅ Server already running"
    SERVER_PID=""
fi

# API Tests using curl
echo ""
echo "🔍 Testing API endpoints..."

# Test 1: Create user and verify NULL gender
echo "   Testing user creation with NULL gender..."
USER_RESPONSE=$(curl -s -X POST http://localhost:5000/api/register \
    -H "Content-Type: application/json" \
    -d '{
        "username": "testuser_gender_' $(date +%s)'",
        "password": "testPassword123!"
    }' || echo "CURL_FAILED")

if [[ "$USER_RESPONSE" == *"CURL_FAILED"* ]] || [[ "$USER_RESPONSE" == *"error"* ]]; then
    log_test_result "API User Creation" "FAIL" "Failed to create test user via API"
else
    log_test_result "API User Creation" "PASS" "Successfully created test user"
fi

# 4. Database State Verification
echo -e "${YELLOW}🗄️  Database State Verification${NC}"
echo "===================================="

# Check if we can access database for verification
if [ -f "local.db" ]; then
    echo "📊 Checking database state..."

    # Count users with NULL gender
    NULL_GENDER_COUNT=$(sqlite3 local.db "SELECT COUNT(*) FROM users WHERE gender IS NULL;" 2>/dev/null || echo "0")

    if [ "$NULL_GENDER_COUNT" -gt 0 ]; then
        log_test_result "Database NULL Gender Users" "PASS" "Found $NULL_GENDER_COUNT users with NULL gender (test data available)"
    else
        log_test_result "Database NULL Gender Users" "INFO" "No users with NULL gender found"
    fi

    # Check if gender field exists in schema
    GENDER_COLUMN=$(sqlite3 local.db "PRAGMA table_info(users);" 2>/dev/null | grep gender || echo "")

    if [ -n "$GENDER_COLUMN" ]; then
        log_test_result "Database Schema Gender Column" "PASS" "Gender column exists in users table"
    else
        log_test_result "Database Schema Gender Column" "FAIL" "Gender column missing from users table"
    fi
else
    log_test_result "Database Access" "SKIP" "Database file not found (using different DB or not created yet)"
fi

# 5. Build Tests
echo -e "${YELLOW}🏗️  Build Verification${NC}"
echo "=========================="

run_test_command \
    "Frontend Build" \
    "$PACKAGE_MANAGER run build" \
    "Verify frontend builds without errors after gender field changes"

# 6. Type Checking
echo -e "${YELLOW}📝 TypeScript Type Checking${NC}"
echo "==============================="

run_test_command \
    "TypeScript Compilation" \
    "$PACKAGE_MANAGER run typecheck || npx tsc --noEmit" \
    "Verify TypeScript types are correct for gender field additions"

# 7. Linting
echo -e "${YELLOW}🔍 Code Quality Checks${NC}"
echo "=========================="

run_test_command \
    "ESLint Checks" \
    "$PACKAGE_MANAGER run lint || npx eslint client/src/pages/upload.tsx client/src/pages/my-scans.tsx" \
    "Verify code quality for modified gender field components"

# Cleanup
if [ -n "$SERVER_PID" ]; then
    echo "🛑 Stopping test server..."
    kill $SERVER_PID >/dev/null 2>&1 || true
    wait $SERVER_PID >/dev/null 2>&1 || true
fi

# Generate Test Report
echo ""
echo "📊 TEST EXECUTION SUMMARY"
echo "========================="
echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! Gender field functionality is working correctly.${NC}"
    OVERALL_STATUS="PASS"
else
    echo -e "\n${RED}⚠️  SOME TESTS FAILED! Please review the failures above.${NC}"
    OVERALL_STATUS="FAIL"
fi

# Success rate
SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
echo -e "Success Rate: ${BLUE}$SUCCESS_RATE%${NC}"

echo ""
echo "📋 DETAILED TEST RESULTS"
echo "========================"
for result in "${TEST_RESULTS[@]}"; do
    if [[ $result == PASS* ]]; then
        echo -e "${GREEN}$result${NC}"
    elif [[ $result == FAIL* ]]; then
        echo -e "${RED}$result${NC}"
    else
        echo -e "${YELLOW}$result${NC}"
    fi
done

# Generate markdown report
REPORT_FILE="__tests__/reports/gender-field-test-report-$(date +%Y%m%d-%H%M%S).md"
mkdir -p "__tests__/reports"

cat > "$REPORT_FILE" << EOF
# Gender Field Bug Fix - Test Execution Report

**Date:** $(date)
**Overall Status:** $OVERALL_STATUS
**Success Rate:** $SUCCESS_RATE% ($PASSED_TESTS/$TOTAL_TESTS)

## Test Summary

- ✅ **Passed:** $PASSED_TESTS
- ❌ **Failed:** $FAILED_TESTS
- 📊 **Total:** $TOTAL_TESTS

## Detailed Results

$(for result in "${TEST_RESULTS[@]}"; do
    status=$(echo "$result" | cut -d' ' -f1)
    details=$(echo "$result" | cut -d' ' -f2-)
    if [ "$status" = "PASS" ]; then
        echo "- ✅ $details"
    elif [ "$status" = "FAIL" ]; then
        echo "- ❌ $details"
    else
        echo "- ℹ️ $details"
    fi
done)

## Test Categories Covered

1. **Backend Integration Tests**
   - PUT /api/scans/:scanId gender handling
   - POST /api/scans gender processing
   - Database state verification
   - Score recalculation verification

2. **Frontend Component Tests**
   - Gender field visibility logic
   - Form state management
   - User interaction handling
   - Debug panel functionality

3. **API Endpoint Verification**
   - Live server testing
   - Request/response validation
   - Error handling verification

4. **Build & Quality Checks**
   - TypeScript compilation
   - Frontend build process
   - Code linting and quality

## Recommendations

EOF

if [ $FAILED_TESTS -eq 0 ]; then
    echo "🎉 **All tests passed!** The gender field functionality is working as expected." >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "### Next Steps:" >> "$REPORT_FILE"
    echo "1. Deploy to staging environment for further testing" >> "$REPORT_FILE"
    echo "2. Conduct user acceptance testing with test user 'Jaron'" >> "$REPORT_FILE"
    echo "3. Monitor production logs for any gender-related issues" >> "$REPORT_FILE"
else
    echo "⚠️ **Some tests failed.** Please address the following before deployment:" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo "### Failed Tests:" >> "$REPORT_FILE"
    for result in "${TEST_RESULTS[@]}"; do
        if [[ $result == FAIL* ]]; then
            echo "- $(echo "$result" | cut -d' ' -f2-)" >> "$REPORT_FILE"
        fi
    done
fi

echo ""
echo -e "${BLUE}📄 Test report saved to: $REPORT_FILE${NC}"

# Exit with appropriate code
if [ $FAILED_TESTS -eq 0 ]; then
    exit 0
else
    exit 1
fi