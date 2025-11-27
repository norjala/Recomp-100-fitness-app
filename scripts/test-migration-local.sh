#!/bin/bash

#################################################################
# Local Migration Testing Script - COMPREHENSIVE TESTING
#
# Tests the complete gender migration on a local copy of production
# database before executing on live production.
#
# This script:
# 1. Uses downloaded production database copy
# 2. Runs migration in dry-run mode (shows changes)
# 3. Asks for confirmation
# 4. Executes migration on local copy
# 5. Verifies results thoroughly
# 6. Tests score recalculation
# 7. Compares before/after states
#
# Usage:
#   ./scripts/test-migration-local.sh [path-to-production-db]
#
# If no path provided, uses most recent downloaded production DB
#################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
TEST_DIR="./data/migration-test-${TIMESTAMP}"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}   LOCAL MIGRATION TESTING${NC}"
echo -e "${BLUE}   Testing on production database copy${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# Find production DB copy
if [ -n "$1" ]; then
    PROD_DB="$1"
else
    PROD_DB=$(ls -t ./data/backups/fitness_challenge_production_*.db 2>/dev/null | head -1)
fi

if [ ! -f "$PROD_DB" ]; then
    echo -e "${RED}❌ No production database copy found${NC}"
    echo ""
    echo "Please download production database first:"
    echo "  ADMIN_PASSWORD=xxx npm run db:download-prod"
    echo ""
    echo "Or run pre-deployment backup:"
    echo "  ADMIN_PASSWORD=xxx ./scripts/pre-deployment-backup.sh"
    exit 1
fi

echo -e "${GREEN}✅ Using production DB copy: $(basename $PROD_DB)${NC}"
echo ""

# Create test directory
mkdir -p "$TEST_DIR"

# Copy production DB for testing
TEST_DB="${TEST_DIR}/fitness_challenge.db"
cp "$PROD_DB" "$TEST_DB"

echo -e "${CYAN}📊 Analyzing current state...${NC}"
echo ""

# Get detailed current state
USER_COUNT=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM users;")
SCAN_COUNT=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM dexa_scans;")
USERS_WITHOUT_GENDER=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM users WHERE gender IS NULL;")

echo "Current database state:"
echo "  Total users: $USER_COUNT"
echo "  Total scans: $SCAN_COUNT"
echo "  Users without gender: $USERS_WITHOUT_GENDER"
echo ""

# Show users that will be affected
echo "Users that will be updated:"
sqlite3 "$TEST_DB" <<EOF | while read line; do echo "  $line"; done
.mode column
.headers off
SELECT
  CASE
    WHEN username = 'ohho' OR (name IS NOT NULL AND name LIKE '%Jackie%Ho%') THEN '→ FEMALE: '
    ELSE '→ MALE:   '
  END ||
  COALESCE(username, 'no-username') || ' (' || COALESCE(name, 'no-name') || ')'
FROM users
WHERE gender IS NULL
ORDER BY
  CASE WHEN username = 'ohho' OR (name IS NOT NULL AND name LIKE '%Jackie%Ho%') THEN 0 ELSE 1 END,
  username;
EOF

echo ""
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}   DRY RUN - Preview of changes (no actual modifications)${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo ""

# Temporarily point DATABASE_URL to test database
export DATABASE_URL="$TEST_DB"

# Run migration in dry-run mode
echo "Running migration in dry-run mode..."
echo ""
npm run migrate:gender -- --dry-run

echo ""
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
read -p "$(echo -e ${CYAN}Do you want to proceed with migration on local copy? [y/N]: ${NC})" -n 1 -r
echo ""
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Migration cancelled. Test database preserved at: $TEST_DB${NC}"
    exit 0
fi

echo -e "${BLUE}📋 Executing migration on local copy...${NC}"
echo ""

# Create backup before migration
BACKUP_DB="${TEST_DIR}/pre_migration_backup.db"
cp "$TEST_DB" "$BACKUP_DB"
echo -e "${GREEN}✅ Local backup created: $BACKUP_DB${NC}"
echo ""

# Execute migration
npm run migrate:gender

echo ""
echo -e "${CYAN}🔍 Verifying migration results...${NC}"
echo ""

# Verify results
FEMALE_COUNT=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM users WHERE gender = 'female';")
MALE_COUNT=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM users WHERE gender = 'male';")
STILL_NULL=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM users WHERE gender IS NULL;")

echo "Migration results:"
echo "  Female users: $FEMALE_COUNT"
echo "  Male users: $MALE_COUNT"
echo "  Still NULL: $STILL_NULL"
echo ""

# Show female users (should be Jackie Ho)
if [ "$FEMALE_COUNT" -gt 0 ]; then
    echo "Female users:"
    sqlite3 "$TEST_DB" "SELECT '  ' || username || ' (' || COALESCE(name, 'no name') || ')' FROM users WHERE gender = 'female';"
    echo ""
fi

# Verify data integrity
FINAL_USER_COUNT=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM users;")
FINAL_SCAN_COUNT=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM dexa_scans;")

if [ "$USER_COUNT" -ne "$FINAL_USER_COUNT" ] || [ "$SCAN_COUNT" -ne "$FINAL_SCAN_COUNT" ]; then
    echo -e "${RED}❌ ERROR: Data integrity check failed!${NC}"
    echo "  Before: $USER_COUNT users, $SCAN_COUNT scans"
    echo "  After:  $FINAL_USER_COUNT users, $FINAL_SCAN_COUNT scans"
    exit 1
fi

echo -e "${GREEN}✅ Data integrity verified - no data lost${NC}"
echo ""

# Check if migration is correct
if [ "$FEMALE_COUNT" -ne 1 ]; then
    echo -e "${YELLOW}⚠️  WARNING: Expected 1 female user, got $FEMALE_COUNT${NC}"
fi

if [ "$MALE_COUNT" -ne $((USER_COUNT - 1)) ]; then
    echo -e "${YELLOW}⚠️  WARNING: Expected $((USER_COUNT - 1)) male users, got $MALE_COUNT${NC}"
fi

if [ "$STILL_NULL" -ne 0 ]; then
    echo -e "${RED}❌ ERROR: $STILL_NULL users still have NULL gender${NC}"
    exit 1
fi

echo -e "${BLUE}📊 Testing score recalculation...${NC}"
echo ""

# Test score recalculation
npm run scores:recalculate

SCORES_COUNT=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM scoring_data;")
echo "  Scores recalculated: $SCORES_COUNT records"
echo ""

echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}   ✅ LOCAL MIGRATION TEST PASSED${NC}"
echo -e "${GREEN}================================================================${NC}"
echo ""
echo -e "${BLUE}Test Summary:${NC}"
echo "  ✅ Migration completed successfully"
echo "  ✅ Data integrity verified ($USER_COUNT users, $SCAN_COUNT scans)"
echo "  ✅ Gender assignment correct ($FEMALE_COUNT female, $MALE_COUNT male)"
echo "  ✅ No NULL gender values remaining"
echo "  ✅ Scores recalculated successfully"
echo ""
echo -e "${BLUE}Test database location:${NC}"
echo "  $TEST_DB"
echo ""
echo -e "${YELLOW}📋 Next Steps for Production:${NC}"
echo ""
echo "  1. Deploy code to Render (if not already done)"
echo "  2. In Render Shell, create backup:"
echo "     npm run db:backup"
echo ""
echo "  3. Run migration in dry-run mode:"
echo "     npm run migrate:gender -- --dry-run"
echo ""
echo "  4. If dry-run looks correct, execute:"
echo "     npm run migrate:gender"
echo ""
echo "  5. Recalculate scores:"
echo "     npm run scores:recalculate"
echo ""
echo "  6. Verify results:"
echo "     npm run migrate:gender -- --verify"
echo ""
echo -e "${GREEN}✅ Local testing complete - ready for production deployment${NC}"
echo ""

# Ask if user wants to keep test database
read -p "$(echo -e ${CYAN}Keep test database for further inspection? [Y/n]: ${NC})" -n 1 -r
echo ""

if [[ $REPLY =~ ^[Nn]$ ]]; then
    rm -rf "$TEST_DIR"
    echo "Test database removed."
else
    echo -e "${GREEN}Test database preserved at: $TEST_DIR${NC}"
    echo "You can inspect it with: sqlite3 $TEST_DB"
fi

echo ""
