# Overview

💯 Day Recomp is a 100-day body recomposition competition web application built with React, TypeScript, and Express. The app tracks contestants' body composition changes through DEXA scan uploads, implements gender-specific scoring algorithms, and provides competitive leaderboards. Users can register for the competition using simple email/password authentication, upload and track multiple DEXA scans, view their progress over time, and compete with others in a fair scoring system.

# User Preferences

Preferred communication style: Simple, everyday language.

# Recent Changes

**Date: 2025-08-05**
- Changed project name from "FitChallenge Pro" to "FitnessForge"

**Date: 2025-08-07**
- Changed application name from "FitnessForge" to "💯 Day Recomp" and finally to "Recomp 💯"
- Removed trophy icon from header navigation while keeping it in Leaderboard page
- Implemented automatic baseline scan marking: when a user has ≥2 scans, the earliest scan by date is automatically marked as baseline
- Fixed leaderboard display issues where users weren't appearing due to missing baseline scans
- Added comprehensive cache invalidation after scan uploads for automatic app refresh
- Updated dashboard countdown from "Day X of 100" to "X days left" with global challenge dates
- All users see same countdown regardless of when they join (Aug 4 - Nov 14, 2025)
- Added "X days remaining" countdown to leaderboard header showing time until Nov 14, 2025
- Replaced Replit Auth with simple email/password authentication system
- Added email confirmation and password reset functionality using SendGrid
- Updated database schema to support traditional user authentication
- Implemented secure password hashing and session management
- Added development bypass for email verification when SendGrid API has issues
- Authentication system is fully functional with manual verification option
- Fixed scoring system to calculate from actual DEXA scan data instead of hardcoded values
- Implemented gender-specific body composition scoring algorithm
- Updated challenge timeline to single 100-day competition (August 4 - November 14, 2025)
- Dashboard now displays real calculated scores based on body fat percentage reduction and lean mass gains
- **MOBILE OPTIMIZATION COMPLETE**: Added comprehensive mobile-first responsive design
- Implemented touch-friendly mobile navigation with bottom tab bar
- Updated all pages (dashboard, leaderboard, upload, profile) for mobile responsiveness
- Added mobile-specific CSS utilities for proper touch targets and layouts
- Fixed mobile viewport settings for optimal phone/tablet experience
- Responsive tables with mobile-friendly layouts and hidden columns on small screens
- Enhanced form inputs with proper mobile sizing to prevent zoom on iOS

**Date: 2025-08-08**
- **FLEXIBLE AUTH SYSTEM COMPLETE**: Upgraded authentication to support both username and email login
- Added unique username field to database schema (optional, alternative to email)
- Modified login/registration forms to accept "Username or Email" as identifier
- Username accounts work immediately without email verification requirement
- Email accounts still require verification (with dev bypass for development)
- Password reset only available for email accounts (username users contact support)
- Fixed display name logic across dashboard, profile, and leaderboard for username accounts
- Updated profile page to handle null email/name fields for username accounts
- Authentication system now supports: usernames (3+ chars), emails, or both account types

**Date: 2025-08-12**
- **LEADERBOARD REDESIGN COMPLETE**: Converted leaderboard from card layout to fantasy football style table
- Added clean table format with columns: Name, Body Fat %, Target BF %, Lean Mass (lbs), Target LM (lbs), Days Left
- Implemented progress bars showing challenge completion percentage (8% complete, 94 days remaining)
- Added user highlighting with blue background and "You" badge for current user's row
- Color-coded stats: red for body fat metrics, green for lean mass metrics
- Mobile-responsive table with horizontal scrolling for smaller screens
- **SIMPLIFIED PARTICIPATION REQUIREMENTS**: Users now appear on leaderboard with just 1 DEXA scan
- Removed outdated "2 scans required" messaging from dashboard
- Updated dashboard welcome message to encourage single baseline scan upload
- Changed minimum participation from 2 scans to 1 baseline scan for competition entry

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/ui components built on top of Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **File Uploads**: Uppy.js for file upload functionality with S3 integration

## Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL (configured for Neon serverless)
- **Authentication**: Simple email/password authentication with email confirmation and password reset
- **Session Management**: Express sessions with PostgreSQL storage
- **File Storage**: Google Cloud Storage with custom ACL system

## Database Schema
- **Users Table**: Stores competition participant data including baseline measurements
- **DEXA Scans Table**: Tracks multiple scan results per user with timestamps
- **Scoring Data Table**: Caches calculated competition scores
- **Sessions Table**: Manages user authentication sessions

## Authentication & Authorization
- **Authentication Provider**: Custom email/password system with SendGrid email integration
- **Session Storage**: PostgreSQL-backed sessions with configurable TTL
- **Authorization**: Custom middleware for protecting API routes
- **User Management**: Automatic user creation and profile management

## File Upload System
- **Storage Backend**: Google Cloud Storage
- **Upload Method**: Direct browser-to-cloud uploads using presigned URLs
- **File Types**: Support for DEXA scan images and PDFs
- **Access Control**: Custom ACL system for object-level permissions

## API Architecture
- **Style**: RESTful API with JSON responses
- **Validation**: Zod schemas for request/response validation
- **Error Handling**: Centralized error handling middleware
- **Logging**: Request/response logging with performance metrics

## Scoring System
- **Algorithm**: Gender-specific body composition scoring
- **Metrics**: Body fat percentage reduction and lean mass gain
- **Leaderboard**: Real-time ranking system with fair competition mechanics
- **Progress Tracking**: Timeline-based progress visualization

# External Dependencies

## Authentication Services
- **Replit Auth**: Primary authentication provider using OpenID Connect
- **Session Management**: connect-pg-simple for PostgreSQL session storage

## Database Services
- **Neon Database**: Serverless PostgreSQL database
- **Connection Pooling**: @neondatabase/serverless for database connections

## File Storage Services
- **Google Cloud Storage**: Object storage for DEXA scan images
- **Uppy.js**: Client-side file upload handling with S3 integration

## UI Component Libraries
- **Radix UI**: Accessible UI primitives for complex components
- **Shadcn/ui**: Pre-built component library based on Radix UI
- **Lucide Icons**: Icon library for consistent iconography

## Development Tools
- **Vite**: Build tool and development server
- **TypeScript**: Type checking and development experience
- **Tailwind CSS**: Utility-first CSS framework
- **Drizzle Kit**: Database migration and schema management

## Third-party Integrations
- **TanStack Query**: Server state management and caching
- **Recharts**: Data visualization for progress charts
- **React Hook Form**: Form handling and validation
- **Wouter**: Lightweight routing library