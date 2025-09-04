# Production Deployment Guide

## Railway Deployment (Recommended)

Railway is the recommended hosting platform for this application due to its excellent support for:
- SQLite database persistence
- File storage with persistent volumes  
- Free tier suitable for 10 users
- Easy deployment and scaling

### Quick Deploy to Railway

1. **Create Railway Account**: Sign up at [railway.app](https://railway.app)

2. **Connect Repository**: 
   ```bash
   railway login
   railway link
   ```

3. **Deploy**:
   ```bash
   railway up
   ```

### Environment Configuration

Create these environment variables in Railway dashboard or use `railway variables set`:

#### Required Variables
```bash
SESSION_SECRET=your-secure-64-character-session-secret
NODE_ENV=production
PORT=5000

# Database (Railway will create persistent volume)
DATABASE_URL=/app/data/fitness_challenge.db
UPLOADS_DIR=/app/uploads

# Admin Access
ADMIN_USERNAMES=YourUsername,AdminUser2

# Competition Dates
COMPETITION_START_DATE=2025-08-04T00:00:00.000Z
COMPETITION_END_DATE=2025-11-26T23:59:59.999Z
```

#### Security & Performance
```bash
RATE_LIMIT_REQUESTS_PER_MINUTE=50
CORS_ORIGINS=https://your-app.railway.app
FORCE_HTTPS=true
```

#### File Upload Settings
```bash
MAX_FILE_SIZE=52428800
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf
```

### Generate Secure Session Secret

```bash
# Generate a secure session secret
openssl rand -hex 64
```

### Railway Configuration Files

The repository includes railway-specific configuration:

- `railway.toml` - Deployment settings and persistent directories
- `nixpacks.toml` - Build configuration
- `scripts/railway-start.js` - Startup script for directory creation

### Persistent Storage Setup

Railway automatically handles persistent storage based on the configuration:

```toml
# railway.toml
[env]
NODE_ENV = "production"
UPLOADS_DIR = "/app/uploads"
DATABASE_URL = "/app/data/fitness_challenge.db"

[build]
builder = "nixpacks"
```

### Health Monitoring

The application includes comprehensive health monitoring:

- **Basic Health Check**: `GET /health`
- **Detailed Monitoring**: `GET /api/health`
- **Backup Status**: `GET /api/admin/backup-status` (admin only)

Monitor your application with:
```bash
curl https://your-app.railway.app/api/health
```

### Database Management

#### Automatic Database Initialization
The application automatically:
- Creates database file on first run
- Runs migrations
- Sets up required tables

#### Manual Database Operations
```bash
# Initialize database
railway run npm run db:init

# Create backup
railway run npm run db:backup

# Generate migrations (development)
railway run npm run db:generate

# Apply migrations
railway run npm run db:migrate
```

### File Upload System

The production deployment includes:
- **Real file storage** in persistent `/app/uploads` directory
- **Multer-based uploads** with size and type validation
- **Secure file serving** with authentication requirements
- **Automatic cleanup** and backup integration

File upload endpoints:
- `POST /api/objects/upload` - Upload files (authenticated)
- `GET /api/objects/uploads/:filename` - Download files (authenticated)

### Security Features

Production deployment includes:
- **Helmet** security headers
- **CORS** configuration for your domain
- **Rate limiting** (configurable)
- **Secure session management** with production settings
- **File type validation** for uploads
- **Authentication** required for all sensitive endpoints

### Monitoring & Logging

#### Health Checks
Monitor application health with detailed metrics:
```json
{
  "status": "healthy",
  "database": {
    "connected": true,
    "userCount": 10,
    "scanCount": 45
  },
  "fileStorage": {
    "status": "available",
    "filesCount": 23
  },
  "system": {
    "memory": {"used": "125MB", "total": "256MB"},
    "platform": "linux", 
    "nodeVersion": "v20.x"
  },
  "competition": {
    "status": "active",
    "daysRemaining": 45
  }
}
```

#### Backup Monitoring
Admin users can check backup status:
```bash
curl -H "Cookie: your-session-cookie" \
  https://your-app.railway.app/api/admin/backup-status
```

### Scaling Considerations

For 10 users, the free Railway tier provides:
- **512MB RAM** (sufficient)
- **1GB persistent storage** (adequate for database + files)
- **100GB bandwidth** (more than enough)
- **No usage limits** on free tier

### Troubleshooting

#### Common Issues

1. **Database Connection Errors**
   - Check `/api/health` endpoint
   - Verify `DATABASE_URL` points to persistent volume

2. **File Upload Issues**
   - Check `UPLOADS_DIR` environment variable
   - Verify persistent volume is mounted
   - Check file size limits (`MAX_FILE_SIZE`)

3. **Session Issues**
   - Verify `SESSION_SECRET` is set and secure
   - Check cookie settings in production

4. **Performance Issues**
   - Monitor `/api/health` for memory usage
   - Check database size and optimize if needed
   - Review rate limiting settings

#### Debug Commands
```bash
# Check logs
railway logs

# Connect to database
railway run npm run db:studio

# Run health check
railway run curl localhost:$PORT/api/health

# Check environment
railway variables
```

### Alternative Hosting Options

#### Render.com
- Similar to Railway with free tier
- Good SQLite support
- Easy deployment process

#### Fly.io
- More complex setup
- Better for advanced users
- Persistent volumes available

#### DigitalOcean App Platform
- $5/month minimum
- Good performance
- Managed databases available

### Cost Analysis

**Railway (Recommended for 10 users)**
- Free tier: $0/month with $5 usage credits
- Estimated usage: < $2/month for 10 active users
- Persistent storage included

**Render**
- Free tier with limitations
- $7/month for production features

**Traditional VPS**
- $5-10/month for basic VPS
- Requires more setup and maintenance

### Security Checklist

- [ ] Set secure `SESSION_SECRET` (64+ characters)
- [ ] Configure `CORS_ORIGINS` for your domain
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS (`FORCE_HTTPS=true`)
- [ ] Set appropriate rate limits
- [ ] Configure admin usernames
- [ ] Verify file upload restrictions
- [ ] Test authentication endpoints
- [ ] Monitor health endpoints

### Deployment Verification

After deployment, verify:

1. **Application loads**: Visit your Railway URL
2. **Health check**: `curl https://your-app.railway.app/api/health`
3. **Authentication**: Test login/register
4. **File uploads**: Test DEXA scan upload
5. **Database**: Check user registration works
6. **Admin access**: Verify admin panel access

### Maintenance

#### Regular Tasks
- Monitor health endpoints weekly
- Check backup status monthly
- Review database size quarterly
- Update dependencies as needed

#### Backup Strategy
- Database backups: Automatic via health monitoring
- File uploads: Stored in persistent volumes
- Environment variables: Document separately

---

## Development vs Production Differences

| Feature | Development | Production |
|---------|------------|------------|
| Database | Local SQLite | Persistent SQLite on Railway |
| File Storage | Local `./uploads` | Persistent `/app/uploads` |
| Sessions | In-memory | Secure with rolling sessions |
| HTTPS | Optional | Required |
| Monitoring | Basic | Comprehensive health checks |
| Rate Limiting | Disabled | Enabled |
| Error Handling | Detailed errors | Sanitized responses |

This deployment guide ensures your fitness challenge application is production-ready with proper security, monitoring, and scalability for your 10-user base.