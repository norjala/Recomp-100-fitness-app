#!/bin/bash

#################################################################
# Rollback Testing Script
#
# Tests the rollback procedure on a local database copy to ensure
# we can safely restore if something goes wrong in production.
#
# What this tests:
# 1. Creates a test database
# 2. Runs migration
# 3. Tests backup/restore process
# 4. Verifies data integrity after rollback
#
# Usage:
#   ./scripts/test-rollback.sh [path-to-production-db-copy]
#
# If no path provided, uses most recent downloaded production DB
#################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
TEST_DIR="./data/rollback-test-${TIMESTAMP}"

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}   ROLLBACK PROCEDURE TEST${NC}"
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
    exit 1
fi

echo -e "${GREEN}✅ Using database: $PROD_DB${NC}"
echo ""

# Create test directory
mkdir -p "$TEST_DIR"

echo -e "${BLUE}📋 Test 1/4: Creating test database copy...${NC}"

TEST_DB="${TEST_DIR}/test.db"
cp "$PROD_DB" "$TEST_DB"

# Get initial state
INITIAL_USER_COUNT=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM users;")
INITIAL_SCAN_COUNT=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM dexa_scans;")
INITIAL_GENDER_NULL=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM users WHERE gender IS NULL;")

echo "   Initial state:"
echo "   - Users: $INITIAL_USER_COUNT"
echo "   - Scans: $INITIAL_SCAN_COUNT"
echo "   - Users without gender: $INITIAL_GENDER_NULL"
echo -e "${GREEN}✅ Test database created${NC}"
echo ""

echo -e "${BLUE}📋 Test 2/4: Creating backup before migration...${NC}"

BACKUP_DB="${TEST_DIR}/backup.db"
cp "$TEST_DB" "$BACKUP_DB"

BACKUP_SIZE=$(stat -f%z "$BACKUP_DB" 2>/dev/null || stat -c%s "$BACKUP_DB" 2>/dev/null)
BACKUP_SIZE_KB=$((BACKUP_SIZE / 1024))

echo "   Backup: $BACKUP_DB (${BACKUP_SIZE_KB}KB)"
echo -e "${GREEN}✅ Backup created${NC}"
echo ""

echo -e "${BLUE}📋 Test 3/4: Simulating migration...${NC}"

# Simulate migration (update gender fields)
sqlite3 "$TEST_DB" <<EOF
-- Update Jackie Ho to female
UPDATE users
SET gender = 'female', updated_at = strftime('%s', 'now') * 1000
WHERE username = 'ohho' OR (name IS NOT NULL AND name LIKE '%Jackie%Ho%');

-- Update all other users to male
UPDATE users
SET gender = 'male', updated_at = strftime('%s', 'now') * 1000
WHERE gender IS NULL;
EOF

# Verify migration
MIGRATED_USERS=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM users WHERE gender IS NOT NULL;")
FEMALE_USERS=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM users WHERE gender = 'female';")
MALE_USERS=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM users WHERE gender = 'male';")

echo "   After migration:"
echo "   - Female users: $FEMALE_USERS"
echo "   - Male users: $MALE_USERS"
echo "   - Total with gender: $MIGRATED_USERS"
echo -e "${GREEN}✅ Migration simulated${NC}"
echo ""

echo -e "${BLUE}📋 Test 4/4: Testing rollback...${NC}"

# Restore from backup
cp "$BACKUP_DB" "$TEST_DB"

# Verify rollback
RESTORED_USER_COUNT=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM users;")
RESTORED_SCAN_COUNT=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM dexa_scans;")
RESTORED_GENDER_NULL=$(sqlite3 "$TEST_DB" "SELECT COUNT(*) FROM users WHERE gender IS NULL;")

echo "   After rollback:"
echo "   - Users: $RESTORED_USER_COUNT"
echo "   - Scans: $RESTORED_SCAN_COUNT"
echo "   - Users without gender: $RESTORED_GENDER_NULL"
echo ""

# Verify data integrity
if [ "$INITIAL_USER_COUNT" -eq "$RESTORED_USER_COUNT" ] && \
   [ "$INITIAL_SCAN_COUNT" -eq "$RESTORED_SCAN_COUNT" ] && \
   [ "$INITIAL_GENDER_NULL" -eq "$RESTORED_GENDER_NULL" ]; then
    echo -e "${GREEN}✅ Rollback successful - data integrity verified${NC}"
else
    echo -e "${RED}❌ Rollback verification failed - data mismatch${NC}"
    echo "   Expected users: $INITIAL_USER_COUNT, got: $RESTORED_USER_COUNT"
    echo "   Expected scans: $INITIAL_SCAN_COUNT, got: $RESTORED_SCAN_COUNT"
    echo "   Expected NULL gender: $INITIAL_GENDER_NULL, got: $RESTORED_GENDER_NULL"
    exit 1
fi

echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}   ✅ ROLLBACK TEST PASSED${NC}"
echo -e "${GREEN}================================================================${NC}"
echo ""
echo -e "${BLUE}Test Results:${NC}"
echo "   • Backup creation: ✅ Working"
echo "   • Migration simulation: ✅ Working"
echo "   • Rollback procedure: ✅ Working"
echo "   • Data integrity: ✅ Verified"
echo ""
echo -e "${YELLOW}📋 Rollback Procedure for Production:${NC}"
echo ""
echo "If you need to rollback in production Render Shell:"
echo ""
echo "  1. List backups:"
echo "     ls -lh /opt/render/persistent/backups/"
echo ""
echo "  2. Find pre-migration backup:"
echo "     (Look for fitness_challenge_PRE_GENDER_MIGRATION_*.db)"
echo ""
echo "  3. Restore database:"
echo "     cp /opt/render/persistent/backups/[backup-file] \\"
echo "        /opt/render/persistent/data/fitness_challenge.db"
echo ""
echo "  4. Restart app via Render dashboard"
echo ""
echo -e "${GREEN}✅ You are prepared for production deployment${NC}"
echo ""

# Cleanup
echo "Cleaning up test files..."
rm -rf "$TEST_DIR"
echo "Done."
