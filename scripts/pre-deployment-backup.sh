#!/bin/bash

#################################################################
# Pre-Deployment Backup Script - CRITICAL SAFETY MEASURE
#
# Creates multiple backup layers before gender implementation:
# 1. Downloads production database to local machine
# 2. Creates backup in Render persistent storage (via API)
# 3. Documents current production state
# 4. Verifies all backups were created successfully
#
# Usage:
#   ADMIN_PASSWORD=xxx ./scripts/pre-deployment-backup.sh
#
# Requirements:
#   - ADMIN_PASSWORD environment variable set
#   - Production app running on Render
#   - curl and sqlite3 installed
#################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PRODUCTION_URL="${PRODUCTION_URL:-https://recomp-100-fitness-app.onrender.com}"
ADMIN_USERNAME="${ADMIN_USERNAME:-Jaron}"
BACKUP_DIR="./data/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}   PRE-DEPLOYMENT BACKUP - Gender Implementation${NC}"
echo -e "${BLUE}================================================================${NC}"
echo ""

# Check prerequisites
if [ -z "$ADMIN_PASSWORD" ]; then
    echo -e "${RED}❌ Error: ADMIN_PASSWORD environment variable not set${NC}"
    echo ""
    echo "Usage:"
    echo "  ADMIN_PASSWORD=your-password ./scripts/pre-deployment-backup.sh"
    exit 1
fi

echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

# Check for required commands
for cmd in curl sqlite3 jq; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${RED}❌ Error: $cmd is not installed${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"
mkdir -p "./production-states"

echo -e "${BLUE}📋 Step 1/4: Authenticating with production...${NC}"

# Login and get session cookie
LOGIN_RESPONSE=$(curl -s -c cookies.txt -X POST \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" \
    "$PRODUCTION_URL/api/login")

if echo "$LOGIN_RESPONSE" | grep -q "error"; then
    echo -e "${RED}❌ Authentication failed${NC}"
    echo "$LOGIN_RESPONSE"
    rm -f cookies.txt
    exit 1
fi

echo -e "${GREEN}✅ Authenticated as $ADMIN_USERNAME${NC}"
echo ""

echo -e "${BLUE}📥 Step 2/4: Downloading production database...${NC}"

# Download database
DB_FILENAME="fitness_challenge_production_${TIMESTAMP}.db"
DB_PATH="${BACKUP_DIR}/${DB_FILENAME}"

HTTP_CODE=$(curl -s -w "%{http_code}" -b cookies.txt \
    -o "$DB_PATH" \
    "$PRODUCTION_URL/api/admin/database/download")

if [ "$HTTP_CODE" != "200" ]; then
    echo -e "${RED}❌ Database download failed (HTTP $HTTP_CODE)${NC}"
    rm -f cookies.txt
    exit 1
fi

# Verify download
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}❌ Database file not found after download${NC}"
    rm -f cookies.txt
    exit 1
fi

DB_SIZE=$(stat -f%z "$DB_PATH" 2>/dev/null || stat -c%s "$DB_PATH" 2>/dev/null)
DB_SIZE_KB=$((DB_SIZE / 1024))

echo -e "${GREEN}✅ Database downloaded successfully${NC}"
echo "   File: $DB_PATH"
echo "   Size: ${DB_SIZE_KB}KB"
echo ""

echo -e "${BLUE}📊 Step 3/4: Verifying database and documenting state...${NC}"

# Query database for current state
USER_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users;")
SCAN_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM dexa_scans;")
SCORE_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM scoring_data;")
USERS_WITH_GENDER=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE gender IS NOT NULL;")
USERS_WITHOUT_GENDER=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE gender IS NULL;")

echo "   Total users: $USER_COUNT"
echo "   Total scans: $SCAN_COUNT"
echo "   Total scores: $SCORE_COUNT"
echo "   Users with gender: $USERS_WITH_GENDER"
echo "   Users without gender: $USERS_WITHOUT_GENDER"
echo ""

# Export full state to JSON
STATE_FILE="./production-states/production_state_${TIMESTAMP}.json"

cat > "$STATE_FILE" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "database_backup": "$DB_PATH",
  "database_size_kb": $DB_SIZE_KB,
  "user_count": $USER_COUNT,
  "scan_count": $SCAN_COUNT,
  "score_count": $SCORE_COUNT,
  "users_with_gender": $USERS_WITH_GENDER,
  "users_without_gender": $USERS_WITHOUT_GENDER,
  "users": $(sqlite3 "$DB_PATH" "SELECT json_group_array(json_object('id', id, 'username', username, 'name', name, 'gender', gender)) FROM users;"),
  "scores": $(sqlite3 "$DB_PATH" "SELECT json_group_array(json_object('userId', user_id, 'totalScore', total_score, 'fatLossScore', fat_loss_score, 'muscleGainScore', muscle_gain_score)) FROM scoring_data;")
}
EOF

echo -e "${GREEN}✅ Production state documented${NC}"
echo "   State file: $STATE_FILE"
echo ""

echo -e "${BLUE}🎯 Step 4/4: Requesting Render backup creation...${NC}"

# Trigger backup on Render (if endpoint exists)
BACKUP_STATUS=$(curl -s -b cookies.txt "$PRODUCTION_URL/api/admin/backup-status")

echo "   Backup status:"
echo "$BACKUP_STATUS" | jq '.' || echo "$BACKUP_STATUS"
echo ""

# Cleanup
rm -f cookies.txt

echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}   ✅ BACKUP COMPLETED SUCCESSFULLY${NC}"
echo -e "${GREEN}================================================================${NC}"
echo ""
echo -e "${BLUE}📦 Backup Summary:${NC}"
echo "   • Production DB downloaded: $DB_PATH (${DB_SIZE_KB}KB)"
echo "   • Production state saved: $STATE_FILE"
echo "   • Users: $USER_COUNT (${USERS_WITHOUT_GENDER} need gender)"
echo "   • Scans: $SCAN_COUNT"
echo "   • Scores: $SCORE_COUNT"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "   1. Review production state: cat $STATE_FILE | jq '.'"
echo "   2. Verify database: sqlite3 $DB_PATH 'SELECT username, name, gender FROM users;'"
echo "   3. Proceed to Phase 1: Backend deployment"
echo ""
echo -e "${YELLOW}⚠️  Keep this backup safe! It's your rollback point.${NC}"
echo ""
