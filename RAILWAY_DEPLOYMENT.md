# 🚂 Railway Deployment Guide

## Overview

This application supports dual deployment: **Render (SQLite)** and **Railway (PostgreSQL)**. The database adapter automatically detects the environment and uses the appropriate database system.

- **Render**: Uses SQLite with persistent disk storage
- **Railway**: Uses PostgreSQL with automatic persistence

## 📋 Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Connected to Railway
3. **PostgreSQL Knowledge**: Basic understanding helpful for troubleshooting

## 🚀 Step-by-Step Deployment

### 1. Create Railway Project

```bash
# Install Railway CLI (optional)
npm install -g @railway/cli

# Login to Railway
railway login
```

Or use the Railway web dashboard:
1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Connect your GitHub repository

### 2. Add PostgreSQL Database

In Railway Dashboard:
1. Click "Add Service" → "Database" → "PostgreSQL"
2. Railway will automatically provision a PostgreSQL instance
3. Note the `DATABASE_URL` environment variable

### 3. Configure Environment Variables

In Railway Dashboard → Environment Variables, add:

```env
# Core Configuration
NODE_ENV=production
PLATFORM=railway
PORT=${{PORT}}

# Database (Auto-provided by Railway PostgreSQL)
DATABASE_URL=${{DATABASE_URL}}
DATABASE_POOL_URL=${{DATABASE_POOL_URL}}

# Application Settings
SESSION_SECRET=[generate-64-char-secret]
UPLOADS_DIR=/tmp/uploads
ADMIN_USERNAMES=Jaron

# Competition Settings
COMPETITION_START_DATE=2025-08-04T00:00:00.000Z
COMPETITION_END_DATE=2025-11-26T23:59:59.999Z

# Optional Features
OPENAI_API_KEY=[your-openai-key]
OPENAI_MODEL=gpt-4o-mini
```

**⚠️ Important**: Generate a secure `SESSION_SECRET`:
```bash
openssl rand -hex 32
```

### 4. Deploy Application

Railway will automatically deploy when you:
1. Push to your connected GitHub branch
2. Or manually trigger deployment in dashboard

The build process:
1. **Install**: `npm ci --production=false`
2. **Build**: `npm run build` (compiles TypeScript + Vite)
3. **Start**: `npm run start:railway` (runs compiled code)

### 5. Initialize Database Schema

Once deployed, run migrations to set up PostgreSQL schema:

**Option A: Local Development Machine**
```bash
# Set Railway PostgreSQL URL
export DATABASE_URL="postgresql://user:pass@host:port/db"

# Generate PostgreSQL migrations
npm run db:pg:generate

# Apply migrations
npm run db:pg:migrate
```

**Option B: Railway Console**
1. Go to Railway Dashboard → Your Service → Console
2. Run migration commands:
```bash
npm run db:pg:generate
npm run db:pg:migrate
```

## 🔧 Configuration Files

### Railway Configuration Files Created:

1. **`railway.toml`** - Railway V2 configuration
2. **`nixpacks.toml`** - Build optimization
3. **`railway.json`** - Legacy configuration (updated)
4. **`drizzle.config.postgres.ts`** - PostgreSQL migrations

### Start Script Enhancement:

- **`scripts/railway-start.cjs`** - Fixed to run compiled JavaScript
- Detects PostgreSQL vs SQLite automatically
- Provides detailed logging for troubleshooting

## 🔍 Monitoring & Troubleshooting

### Check Deployment Logs

In Railway Dashboard:
1. Go to your service → "Logs" tab
2. Look for these success messages:
```
🚂 Railway Platform Startup Script
📍 Platform: Railway
💾 Database Type: PostgreSQL
✅ PostgreSQL connection established
🚀 Starting production server...
```

### Common Issues & Solutions

**1. Build Failures**
```bash
# Check if build completes locally
npm run build
ls -la dist/server/index.js  # Should exist
```

**2. Database Connection Issues**
- Verify `DATABASE_URL` is set in Railway environment
- Check PostgreSQL service is running
- Ensure migrations have been applied

**3. Start Script Issues**
```bash
# Test Railway start script locally
npm run start:railway
```

**4. Health Check Failures**
- Application provides `/health` endpoint
- Railway will monitor this automatically
- Check logs for specific errors

### Environment Detection Debug

The application logs environment detection:
```
📍 Platform: Railway
🔌 Port: 3000
🌍 Environment: production
💾 Database Type: PostgreSQL
📊 Database URL: postgresql://postgres:****@...
```

## 🔄 Database Migration from Render

If migrating from Render (SQLite) to Railway (PostgreSQL):

### 1. Export Data from Render
```bash
# On your local machine with Render database access
npm run db:backup
```

### 2. Transform Data for PostgreSQL
```bash
# Convert SQLite backup to PostgreSQL format
# (Manual process - UUIDs, data types, etc.)
```

### 3. Import to Railway
```bash
# Apply schema
export DATABASE_URL="[railway-postgresql-url]"
npm run db:pg:migrate

# Import transformed data
# (Use PostgreSQL import tools or custom script)
```

## 🚀 Performance Optimization

### PostgreSQL Configuration
- Railway automatically configures PostgreSQL for performance
- Connection pooling handled by Railway
- Automatic backups included

### Application Configuration
- Node.js memory limit: 512MB (configurable in railway.toml)
- Automatic scaling based on demand
- Health checks ensure uptime

## 📊 Comparison: Render vs Railway

| Feature | Render (SQLite) | Railway (PostgreSQL) |
|---------|----------------|---------------------|
| **Database** | SQLite file | Managed PostgreSQL |
| **Persistence** | Persistent disk | Built-in persistence |
| **Scaling** | Limited | Auto-scaling |
| **Backups** | Manual | Automatic |
| **Cost** | $7/month | Usage-based (~$5-20) |
| **Setup** | Simple | Moderate |

## ✅ Deployment Checklist

- [ ] Railway project created
- [ ] GitHub repository connected
- [ ] PostgreSQL database added
- [ ] Environment variables configured
- [ ] Application deployed successfully
- [ ] Database migrations applied
- [ ] Health check endpoint responding
- [ ] Application functionality verified
- [ ] DNS/domain configured (optional)

## 🆘 Support

If deployment fails:

1. **Check Railway Logs**: Most issues visible in deployment logs
2. **Verify Environment Variables**: Ensure all required vars set
3. **Test Locally**: Run `npm run start:railway` locally first
4. **Database Connection**: Verify PostgreSQL service status
5. **GitHub Issues**: Report issues with logs attached

## 🔗 Useful Commands

```bash
# Local development with PostgreSQL
export DATABASE_URL="postgresql://..."
npm run dev

# Generate PostgreSQL migrations
npm run db:pg:generate

# Apply migrations
npm run db:pg:migrate

# View database in browser
npm run db:pg:studio

# Test Railway start script
npm run start:railway

# Build and test production
npm run build
NODE_ENV=production node dist/server/index.js
```

---

**✨ Result**: Your fitness application will be successfully deployed on Railway with PostgreSQL, maintaining full functionality while keeping the Render deployment intact!