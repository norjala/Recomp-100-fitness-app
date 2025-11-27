# Recomp-100 Fitness Challenge App

## Overview

A 100-day body recomposition competition platform where users track DEXA scan progress, compete for body fat loss and muscle gain improvements, and view leaderboards.

**Challenge Period**: August 4, 2025 - November 26, 2025 (114 days)

## Features

- **DEXA Scan Upload**: Manual data entry with optional image/PDF upload and AI extraction
- **Progress Tracking**: Timeline charts showing body fat % and lean mass changes over time
- **Automated Scoring**: Real-time scoring based on body composition percentage improvements
- **Public Leaderboard**: Rankings with estimated scores and progress visualization
- **Profile Management**: Complete scan history, target goals, and scan editing capabilities
- **Admin Panel**: User management and competition oversight for administrators
- **Target Goals**: Personal body fat and lean mass targets with progress tracking

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Shadcn/UI components
- **Backend**: Express.js + Node.js with RESTful API
- **Database**: SQLite with Drizzle ORM for type-safe database operations
- **Authentication**: Session-based authentication with scrypt password hashing
- **File Storage**: Object storage system for DEXA scan images and PDFs

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Git

### Quick Start

```bash
# Clone and install dependencies
git clone <repository-url>
cd Recomp-100-fitness-app
npm install

# Initialize database
npm run db:push

# Start development server
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server (http://localhost:5000)
- `npm run build` - Build for production (client + server)
- `npm run start` - Start production server
- `npm run preview` - Build and start for testing
- `npm run test` - Run all tests (backend + frontend)
- `npm run test:backend` - Run backend tests only (Jest + Supertest)
- `npm run test:frontend` - Run frontend tests only (Vitest + React Testing Library)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage reports
- `npm run db:push` - Push schema changes to database
- `npm run db:init` - Initialize database manually
- `npm run type-check` - Run TypeScript validation
- `npm run clean` - Clean build artifacts

## Database Management

- **Database File**: Configured via `DATABASE_URL` environment variable (default: `./data/fitness_challenge.db`)
- **Schema Location**: `shared/schema.ts`
- **Migrations**: Use `npm run db:generate` to create migrations, `npm run db:migrate` to apply
- **Direct Schema Push**: `npm run db:push` (for development)
- **Reset Database**: Delete database file and run `npm run db:push` or `npm run db:init`
- **Database Studio**: `npm run db:studio` - Visual database explorer
- **Backup Database**: `npm run db:backup` - Creates timestamped backups
- **Restore Database**: `npm run db:restore <backup-file>` - Restores from backup

### Database Tables

- `users` - User accounts and profile information
- `dexa_scans` - DEXA scan data and measurements
- `scoring_data` - Calculated scores and competition metrics

## Testing

### Test Coverage

The application includes comprehensive test coverage for critical functionality:

**Backend Tests (Jest + Supertest):**

- **Scoring System Tests** - Validates competition scoring algorithms and fairness
- **Authentication Tests** - Ensures password security and admin access control
- **Database Operations** - Tests data integrity and CRUD operations
- **API Integration Tests** - Validates endpoint functionality and security

**Frontend Tests (Vitest + React Testing Library):**

- **Component Tests** - UI component behavior and props
- **Hook Tests** - Custom React hooks like `useAuth`
- **User Interaction Tests** - Form validation and user flows

### Running Tests

```bash
# Run all tests
npm run test

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend

# Watch mode for development
npm run test:watch

# Generate coverage reports
npm run test:coverage
```

### Test Database

Tests use isolated SQLite databases to ensure:

- No interference between tests
- Fast test execution
- Reliable test results
- Safe testing of destructive operations

## Scoring System

### Fat Loss Score (FLS)

- **Formula**: 10 points per 1% body fat lost
- **Maximum**: 50 points
- **Calculation**: Based on percentage change from baseline scan

### Muscle Gain Score (MGS)

- **Formula**: 20 points per 1% lean mass gained
- **Maximum**: 50 points
- **Gender Modifier**: Women receive 1.5x multiplier for muscle building difficulty

### Total Score

- **Formula**: Fat Loss Score + Muscle Gain Score
- **Maximum**: 100 points
- **Requirements**: Minimum 2 scans (1 baseline + 1 progress scan)

## API Endpoints

### Authentication

- `POST /api/register` - Create new user account
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/user` - Get current user profile

### DEXA Scans

- `GET /api/users/:userId/scans` - Get user's scan history
- `POST /api/scans` - Create new scan
- `PUT /api/scans/:scanId` - Update existing scan
- `DELETE /api/scans/:scanId` - Delete scan

### Competition Data

- `GET /api/leaderboard` - Get leaderboard rankings
- `GET /api/contestants` - Get all contestants with baseline data
- `GET /api/scoring/:userId` - Get user's scoring data

### File Upload

- `POST /api/objects/upload` - Get upload URL for scan images
- `POST /api/extract-dexa-data` - Extract data from DEXA scan images (currently disabled)

## Admin Access

Admin access is controlled via the `ADMIN_USERNAMES` environment variable. Multiple usernames can be specified as a comma-separated list.

**Environment Variable Setup:**

```bash
ADMIN_USERNAMES=Jaron,AdminUser2,AdminUser3
```

**Default:** If no environment variable is set, defaults to "Jaron" for backward compatibility.

**Programmatic Configuration:** Modify the `requireAdmin` middleware in `server/routes.ts` if needed.

## Project Structure

```
Recomp-100-fitness-app/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Application pages
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and configurations
├── server/                # Express backend
│   ├── auth.ts           # Authentication system
│   ├── routes.ts         # API route handlers
│   ├── storage.ts        # Database operations
│   └── index.ts          # Server entry point
├── shared/               # Shared types and schemas
└── attached_assets/      # Development assets and examples
```

## Known Issues & Limitations

### Current Limitations

- AI-powered DEXA scan extraction is disabled (manual entry required)
- Admin access is hard-coded to specific username
- Database auto-initialization needs improvement
- Production build configuration incomplete

### Development Notes

- Database file created in project root directory
- Session secret is hard-coded (should use environment variables)
- No automated testing setup currently
- File upload system simplified for development environment

## Deployment Considerations

### For Production Deployment

1. Set up environment variables for sensitive data
2. Configure proper database location and backups
3. Add build scripts and production server configuration
4. Set up proper file storage service
5. Configure HTTPS and security headers
6. Add proper logging and monitoring

### Environment Configuration

**Required Setup:**

1. Copy `.env.example` to `.env`
2. Update values for your environment
3. Generate secure `SESSION_SECRET`: `openssl rand -hex 32`

**Essential Environment Variables:**

```bash
# Application
NODE_ENV=production
PORT=5000
SESSION_SECRET=your-secure-session-secret-64-chars-minimum

# Database
DATABASE_URL=./data/fitness_challenge.db

# Admin Access
ADMIN_USERNAMES=Jaron,AdminUser2,AdminUser3

# Competition Dates
COMPETITION_START_DATE=2025-08-04T00:00:00.000Z
COMPETITION_END_DATE=2025-11-26T23:59:59.999Z
```

**Optional Configuration:**

- **Logging**: `LOG_LEVEL`, `LOG_FORMAT`, `ENABLE_REQUEST_LOGGING`
- **Security**: `RATE_LIMIT_REQUESTS_PER_MINUTE`, `FORCE_HTTPS`, `CORS_ORIGINS`
- **File Upload**: `MAX_FILE_SIZE`, `ALLOWED_FILE_TYPES`
- **OpenAI Integration**: `OPENAI_API_KEY`, `OPENAI_MODEL`
- **Email**: `SMTP_*` variables for notifications
- **Backups**: `BACKUP_FREQUENCY_HOURS`, `BACKUP_RETENTION_COUNT`

See `.env.example` for complete configuration options.

## Competition Rules

### Participation Requirements

- Upload baseline DEXA scan to join competition
- Minimum 2 scans required for scoring (baseline + progress)
- All scans must include: body fat %, lean mass, total weight, fat mass

### Scoring Criteria

- Scores calculated based on percentage improvements from baseline
- Automatic baseline assignment to earliest scan date
- Real-time leaderboard updates after each scan upload
- Progress tracking toward individual target goals

### Data Validation

- Body fat percentage: 0-100%
- Lean mass: Must be positive number (lbs)
- Total weight: Must be positive number (lbs)
- Scan dates: Must be valid dates within reasonable range

## Support & Maintenance

### Common Tasks

- **Add New User**: Use admin panel or direct database registration
- **Reset User Progress**: Delete user's scans and scoring data
- **Backup Database**: Copy `fitness_challenge.db` file
- **View Logs**: Check server console for API request logs

### Health Monitoring

- **Basic Health Check**: `GET /health` - Application status and uptime
- **Detailed Health Check**: `GET /api/health` - Database connection, memory usage, metrics
- **Logs**: Check `./logs/` directory in production
- **Database Backup**: Automatic backups based on `BACKUP_FREQUENCY_HOURS`

### Troubleshooting

- **Configuration Issues**: Check environment variables against `.env.example`
- **Database Issues**: Use `npm run db:backup` before fixes, then `npm run db:init`
- **Login Problems**: Verify `SESSION_SECRET` is set and users exist
- **Scoring Errors**: Check `/api/health` for database connection issues
- **File Upload Issues**: Verify `MAX_FILE_SIZE` and `ALLOWED_FILE_TYPES` settings
- **Performance Issues**: Check `/api/health` for memory usage and database metrics

---

_This application was originally developed through vibe coding on Replit and has been adapted for self-hosted deployment._
