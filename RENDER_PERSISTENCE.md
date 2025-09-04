# Render.com Persistent Storage Configuration

## Critical Information About Data Persistence

This application is configured to use Render's persistent disk storage to maintain user data, DEXA scans, and uploaded files between deployments.

## Persistent Storage Configuration

### Storage Paths
- **Database**: `/opt/render/persistent/data/fitness_challenge.db`
- **Uploads**: `/opt/render/persistent/uploads/`
- **Mount Point**: `/opt/render/persistent` (1GB disk)

### Why This Configuration?

Previously, the persistent disk was mounted at `/opt/render/project` (the project root), which caused:
- Database to be wiped on every deployment
- User accounts to be lost
- Session/database mismatches causing 500 errors

Now, the disk is mounted at `/opt/render/persistent`, separate from the code directory, ensuring:
- Database persists across deployments
- User accounts and data remain intact
- Uploaded files are preserved

## Important Notes

### First Deployment
1. On first deployment to Render, create the persistent disk if not already created
2. The application will automatically create the database and required directories
3. Users can register and their data will persist

### Subsequent Deployments
1. The application will detect the existing database
2. User data, scans, and uploads will be preserved
3. Sessions may need to be re-established (users might need to log in again)

### Manual Database Reset (if needed)
If you ever need to reset the database on Render:

1. Access Render dashboard → Your service → Shell tab
2. Run: `rm -f /opt/render/persistent/data/fitness_challenge.db`
3. Restart the service
4. The database will be recreated fresh

### Monitoring Database Status
The application logs will show:
- `✅ Using persistent storage - data will survive deployments` (good)
- `⚠️ Using local storage - data will be lost on deployment` (bad - check configuration)
- `✅ Found existing database (X.XX MB) - preserving user data` (database exists)
- `📝 No existing database found - will create new database on first run` (fresh start)

## Troubleshooting

### Issue: User accounts lost after deployment
**Cause**: Database not on persistent storage
**Fix**: Ensure render.yaml has correct disk configuration with mountPath: `/opt/render/persistent`

### Issue: 500 errors when saving data
**Cause**: Session references user that doesn't exist in database
**Fix**: Clear browser cookies/localStorage and log in again

### Issue: 502 Bad Gateway
**Cause**: Application crashed or taking too long to start
**Fix**: Check Render logs for startup errors

## Environment Variables Required on Render

Make sure these are set in Render dashboard:
```
DATABASE_URL=/opt/render/persistent/data/fitness_challenge.db
UPLOADS_DIR=/opt/render/persistent/uploads
SESSION_SECRET=<your-secure-64-character-secret>
OPENAI_API_KEY=<your-openai-api-key>
ADMIN_USERNAMES=Jaron
COMPETITION_START_DATE=2025-08-04T00:00:00.000Z
COMPETITION_END_DATE=2025-11-26T23:59:59.999Z
```

## Verification Steps After Deployment

1. Check logs for "Using persistent storage" message
2. Register a test account
3. Add a DEXA scan
4. Trigger a new deployment (push any small change)
5. Verify the account and scan data still exist after deployment completes