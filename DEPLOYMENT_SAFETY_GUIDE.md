# Deployment Safety Guide

## CRITICAL: Preventing Data Loss During Deployments

This guide ensures user data persistence during manual deployments to prevent incidents like the Jackie data loss.

## Pre-Deployment Safety Checklist

### ✅ BEFORE Every Manual Deployment

1. **Run Pre-Deployment Check**:
   ```bash
   npm run deploy:check
   ```
   This verifies:
   - Database is in persistent storage (`/opt/render/persistent`)
   - Current user/scan counts
   - Backup status
   - Environment configuration

2. **Create Safety Backup**:
   ```bash
   npm run deploy:safe
   ```
   This runs the check AND creates a verified backup

3. **Verify Current Data State**:
   - Check production health: `https://your-app.onrender.com/api/health`
   - Note user/scan counts for post-deployment verification

### ✅ Environment Variables Verification

**CRITICAL**: These MUST be set correctly in Render Dashboard:

```bash
# PERSISTENCE (CRITICAL)
DATABASE_URL=/opt/render/persistent/data/fitness_challenge.db
UPLOADS_DIR=/opt/render/persistent/uploads

# REQUIRED
NODE_ENV=production
SESSION_SECRET=<64-character-secure-string>
ADMIN_USERNAMES=Jaron

# COMPETITION
COMPETITION_START_DATE=2025-08-04T00:00:00.000Z
COMPETITION_END_DATE=2025-11-26T23:59:59.999Z
```

**How to verify in Render**:
1. Go to Render Dashboard → Your Service
2. Navigate to "Environment" tab
3. Verify `DATABASE_URL` contains `/opt/render/persistent`
4. Verify `UPLOADS_DIR` contains `/opt/render/persistent`

### ✅ Persistent Disk Configuration

**CRITICAL**: Verify in `render.yaml`:
```yaml
disk:
  name: fitness-app-storage
  mountPath: /opt/render/persistent  # MUST be this path
  sizeGB: 2
```

## During Deployment

### ⚠️ Deployment Process

1. **Push to GitHub**: Your code changes trigger auto-deploy
2. **Monitor Build Logs**: Watch for persistence verification messages
3. **Check Startup Logs**: Look for these critical messages:
   ```
   ✅ Database is properly configured for persistent storage
   ✅ Using existing database (X.XX MB) - PRESERVING USER DATA
   📊 Database contains X users, X scans, X scores
   🔒 Existing data detected - creating safety backup...
   ```

### 🚨 Red Flags in Logs

**STOP DEPLOYMENT** if you see:
```
🚨 CRITICAL DATA LOSS RISK: Database not in persistent storage!
❌ USER DATA WILL BE LOST ON DEPLOYMENT!
📝 Creating new database file
```

## Post-Deployment Verification

### ✅ AFTER Every Deployment

1. **Check Health Endpoint**:
   ```bash
   curl https://your-app.onrender.com/api/health | jq
   ```

2. **Verify Data Persistence**:
   - User count matches pre-deployment count
   - Scan count matches pre-deployment count
   - Database size is similar to before

3. **Test Application**:
   - Log in with existing account
   - Verify DEXA scan data is intact
   - Check leaderboard shows correct users

### ✅ Health Endpoint Verification

The `/api/health` endpoint shows critical deployment info:

```json
{
  "status": "healthy",
  "database": {
    "path": "/opt/render/persistent/data/fitness_challenge.db",
    "exists": true,
    "size": "0.04 MB"
  },
  "persistence": {
    "isConfiguredForPersistence": true,
    "isPersistenceRequired": true,
    "persistenceWarnings": []
  },
  "data": {
    "users": 3,
    "scans": 2,
    "scores": 0
  },
  "backup": {
    "hasRecentBackup": true,
    "backupCount": 5,
    "mostRecentBackup": "deployment_backup_2025-09-09_23-55-16.db"
  }
}
```

**Good signs**:
- `isConfiguredForPersistence: true`
- `persistenceWarnings: []`
- Data counts match expectations

**Bad signs**:
- `isConfiguredForPersistence: false`
- Persistence warnings present
- User/scan counts are 0 when they should have data

## Rollback Procedures

### 🚨 If Data Loss is Detected

1. **Immediate Rollback**:
   - Go to Render Dashboard → Deployments
   - Click "Rollback" to previous working deployment

2. **Restore from Backup**:
   ```bash
   # If you have SSH access to Render shell
   cp /opt/render/persistent/backups/latest_backup.db /opt/render/persistent/data/fitness_challenge.db
   ```

3. **Contact Users**:
   - Use Jackie incident communication template
   - Explain the situation transparently
   - Offer to help recreate accounts

## Automated Backup Integration

### 📅 Automatic Backups

The application automatically creates backups:
- **Pre-deployment**: When existing data is detected
- **Scheduled**: Every 24 hours (configurable)
- **Manual**: Using `npm run db:backup:safe`

### 📂 Backup Locations

```
/opt/render/persistent/
├── data/
│   └── fitness_challenge.db          # Main database
├── backups/
│   ├── deployment_backup_*.db        # Auto deployment backups
│   └── fitness_challenge_backup_*.db # Manual/scheduled backups
└── uploads/                          # User file uploads
```

## Manual Deployment Best Practices

### 🎯 Before Committing Changes

1. **Test Locally**: Ensure your changes work in development
2. **Review Database Changes**: Any schema changes need migration scripts
3. **Check Dependencies**: New packages won't break deployment

### 🎯 Deployment Timing

- **Avoid Peak Hours**: Deploy during low-usage times
- **Monitor First**: Watch the deployment complete before walking away
- **Have Rollback Ready**: Know how to quickly rollback if needed

### 🎯 Communication

- **Notify Users**: For major updates, consider maintenance window notifications
- **Document Changes**: Keep deployment notes for troubleshooting
- **Test Critical Paths**: User registration, scan upload, leaderboard

## Troubleshooting

### ❓ "Database not in persistent storage" Error

**Cause**: DATABASE_URL not set to persistent path
**Fix**: 
1. Go to Render Dashboard → Environment
2. Set `DATABASE_URL=/opt/render/persistent/data/fitness_challenge.db`
3. Redeploy

### ❓ "No users found after deployment"

**Cause**: Database was recreated instead of preserved
**Fix**:
1. Check if backup exists in `/opt/render/persistent/backups/`
2. Restore from most recent backup
3. Verify DATABASE_URL configuration

### ❓ Pre-deployment check fails to connect

**Cause**: Production app may be down or unhealthy
**Fix**:
1. Check Render service status
2. Review application logs
3. Manually verify health endpoint

---

## Quick Reference Commands

```bash
# Pre-deployment safety
npm run deploy:check          # Verify production is safe for deployment
npm run deploy:safe           # Check + create backup

# Backup management
npm run db:backup:safe        # Create verified backup
npm run db:backup:list        # List all backups
npm run db:backup:verify      # Verify database integrity

# Incident analysis
npm run audit:analyze         # Generate incident report
npm run audit:critical        # Show critical database operations

# Health monitoring
curl https://your-app.onrender.com/api/health
```

---

**Remember**: Jackie's data loss occurred because of a database reset script, but improper deployment configuration could cause similar losses. These safety measures protect against both scenarios.