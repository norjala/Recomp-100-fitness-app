# Railway Deployment Guide

## Free Tier Deployment Steps

### 1. Sign Up for Railway
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub account
3. You get $5 in free credits monthly

### 2. Push Code to GitHub
```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

### 3. Deploy on Railway
1. Click "Deploy from GitHub repo"
2. Select your repository
3. Railway will auto-detect Node.js

### 4. Set Environment Variables
In Railway dashboard, add these variables:

**Required:**
```
NODE_ENV=production
SESSION_SECRET=701bede17932f5cfea85e05f67b6856d4f5d03969cc2af5b1081b7fe8847f25a
DATABASE_URL=./data/fitness_challenge.db
ADMIN_USERNAMES=Jaron
```

**Competition Settings:**
```
COMPETITION_START_DATE=2025-08-04T00:00:00.000Z
COMPETITION_END_DATE=2025-11-14T23:59:59.999Z
```

**Security (Optional):**
```
FORCE_HTTPS=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

**OpenAI (Optional for PDF extraction):**
```
OPENAI_API_KEY=your-key-here
```

### 5. Deploy!
Railway automatically:
- Runs `npm run build` 
- Starts with `npm start`
- Provides public HTTPS URL
- Creates persistent disk for SQLite

### 6. Monitor
- Check health at: `https://your-app.railway.app/health`
- View logs in Railway dashboard
- Monitor usage (free tier limits)

## Free Tier Limits
- $5 credit per month
- Should handle ~100K requests
- Persistent storage included
- Custom domains available

## Troubleshooting
1. Check Railway logs if deployment fails
2. Verify all environment variables are set
3. Test locally with `npm run preview` first
4. Database initializes automatically on first run