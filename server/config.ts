// Environment configuration and validation
import { z } from "zod";
import path from "path";
import fs from "fs";
import { config as dotenvConfig } from "dotenv";

// Load environment variables from .env file
dotenvConfig();

// Define the configuration schema
const configSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().min(1).max(65535).default(5000),

  // Session
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters for security"),

  // Database
  DATABASE_URL: z.string().default("./data/fitness_challenge.db"),

  // Admin
  ADMIN_USERNAMES: z.string().default("Jaron"),

  // Competition
  COMPETITION_START_DATE: z
    .string()
    .datetime()
    .default("2025-08-04T00:00:00.000Z"),
  COMPETITION_END_DATE: z
    .string()
    .datetime()
    .default("2025-11-14T23:59:59.999Z"),

  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  LOG_FORMAT: z.enum(["simple", "json"]).default("simple"),
  ENABLE_REQUEST_LOGGING: z.coerce.boolean().default(true),

  // Security
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.coerce.number().min(1).default(100),
  FORCE_HTTPS: z.coerce.boolean().default(false),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:5173"),

  // File Upload
  MAX_FILE_SIZE: z.coerce.number().min(1024).default(52428800), // 50MB default
  ALLOWED_FILE_TYPES: z
    .string()
    .default("image/jpeg,image/png,image/gif,application/pdf"),

  // Optional features
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  // Email (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  FROM_EMAIL: z.string().email().optional(),

  // Monitoring (optional)
  SENTRY_DSN: z.string().optional(),
  ANALYTICS_ID: z.string().optional(),

  // Backup
  BACKUP_FREQUENCY_HOURS: z.coerce.number().min(0).default(24),
  BACKUP_RETENTION_COUNT: z.coerce.number().min(1).default(7),
  BACKUP_PATH: z.string().default("./backups"),
});

export type AppConfig = z.infer<typeof configSchema>;

let config: AppConfig;

export function loadConfig(): AppConfig {
  if (config) {
    return config;
  }

  try {
    // Load environment variables
    const env = process.env;

    // Validate and parse configuration
    const result = configSchema.safeParse(env);

    if (!result.success) {
      console.error("❌ Invalid environment configuration:");
      result.error.errors.forEach((error) => {
        console.error(`  - ${error.path.join(".")}: ${error.message}`);
      });

      console.error(
        "\n💡 Please check your .env file and ensure all required variables are set."
      );
      console.error("📄 See .env.example for reference.\n");

      process.exit(1);
    }

    config = result.data;

    // Validate additional constraints
    validateConfig(config);

    // Create necessary directories
    createDirectories(config);

    // Log configuration (excluding sensitive data)
    logConfiguration(config);

    return config;
  } catch (error) {
    console.error("❌ Failed to load configuration:", error);
    process.exit(1);
  }
}

function validateConfig(config: AppConfig) {
  // Validate competition dates
  const startDate = new Date(config.COMPETITION_START_DATE);
  const endDate = new Date(config.COMPETITION_END_DATE);

  if (startDate >= endDate) {
    throw new Error(
      "COMPETITION_END_DATE must be after COMPETITION_START_DATE"
    );
  }

  // Validate admin usernames
  const adminUsernames = config.ADMIN_USERNAMES.split(",")
    .map((u) => u.trim())
    .filter((u) => u);
  if (adminUsernames.length === 0) {
    throw new Error(
      "At least one admin username must be specified in ADMIN_USERNAMES"
    );
  }

  // Validate production requirements
  if (config.NODE_ENV === "production") {
    if (config.SESSION_SECRET.length < 64) {
      console.warn(
        "⚠️  WARNING: SESSION_SECRET should be at least 64 characters in production"
      );
    }

    if (
      config.DATABASE_URL.startsWith("./") &&
      !config.DATABASE_URL.startsWith("./data/")
    ) {
      console.warn(
        "⚠️  WARNING: Consider using absolute path for DATABASE_URL in production"
      );
    }
  }

  // Validate file types
  const allowedTypes = config.ALLOWED_FILE_TYPES.split(",").map((t) =>
    t.trim()
  );
  const validMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
  ];

  for (const type of allowedTypes) {
    if (!validMimeTypes.includes(type)) {
      console.warn(
        `⚠️  WARNING: Potentially invalid MIME type in ALLOWED_FILE_TYPES: ${type}`
      );
    }
  }
}

function createDirectories(config: AppConfig) {
  const directories = [
    path.dirname(config.DATABASE_URL),
    config.BACKUP_PATH,
    "./logs",
    process.env.UPLOADS_DIR || "./uploads", // Render persistent disk uploads
  ];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function logConfiguration(config: AppConfig) {
  if (config.NODE_ENV === "test") {
    return; // Skip logging in test environment
  }

  console.log("🚀 Configuration loaded successfully:");
  console.log(`   Environment: ${config.NODE_ENV}`);
  console.log(`   Port: ${config.PORT}`);
  console.log(`   Database: ${config.DATABASE_URL}`);
  console.log(
    `   Admin Users: ${config.ADMIN_USERNAMES.split(",").length} configured`
  );
  console.log(
    `   Competition: ${config.COMPETITION_START_DATE} to ${config.COMPETITION_END_DATE}`
  );
  console.log(`   Log Level: ${config.LOG_LEVEL}`);

  if (config.OPENAI_API_KEY) {
    console.log(`   OpenAI: Enabled (Model: ${config.OPENAI_MODEL})`);
  }

  if (config.SMTP_HOST) {
    console.log(`   Email: Enabled (${config.SMTP_HOST}:${config.SMTP_PORT})`);
  }

  console.log("");
}

// Utility functions for accessing specific config values
export function getConfig(): AppConfig {
  if (!config) {
    return loadConfig();
  }
  return config;
}

export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === "development";
}

export function isProduction(): boolean {
  return getConfig().NODE_ENV === "production";
}

export function isTest(): boolean {
  return getConfig().NODE_ENV === "test";
}

export function getAdminUsernames(): string[] {
  return getConfig()
    .ADMIN_USERNAMES.split(",")
    .map((u) => u.trim())
    .filter((u) => u);
}

export function getDatabasePath(): string {
  const config = getConfig();
  let dbUrl = config.DATABASE_URL;

  // Environment-specific database path handling
  if (config.NODE_ENV === 'production') {
    // In production, prefer persistent storage paths
    if (process.env.RENDER && !dbUrl.includes('/opt/render/persistent')) {
      console.warn('⚠️  Production database not in persistent storage');
      console.warn(`   Current: ${dbUrl}`);
      console.warn('   Consider: /opt/render/persistent/data/fitness_challenge.db');
      
      // Auto-correct for Render if no explicit path is set
      if (dbUrl === './data/fitness_challenge.db') {
        const renderPath = '/opt/render/persistent/data/fitness_challenge.db';
        console.warn(`   Auto-correcting to: ${renderPath}`);
        dbUrl = renderPath;
      }
    }
    
    // Check for other cloud platform specific paths
    if (process.env.RAILWAY_ENVIRONMENT && !dbUrl.includes('/app/data')) {
      console.warn('⚠️  Railway deployment detected - consider using /app/data path');
    }
    
    if (process.env.VERCEL && !dbUrl.includes('/tmp/')) {
      console.warn('⚠️  Vercel deployment detected - database will be ephemeral');
      console.warn('   Consider using external database service');
    }
  }

  // If it's already an absolute path, return as-is
  if (path.isAbsolute(dbUrl)) {
    return dbUrl;
  }

  // If it starts with ./ or ../, resolve relative to process.cwd()
  if (dbUrl.startsWith("./") || dbUrl.startsWith("../")) {
    return path.resolve(process.cwd(), dbUrl);
  }

  // If it's just a filename or relative path without ./, resolve relative to process.cwd()
  return path.resolve(process.cwd(), dbUrl);
}

export function getCompetitionDates(): { start: Date; end: Date } {
  const config = getConfig();
  return {
    start: new Date(config.COMPETITION_START_DATE),
    end: new Date(config.COMPETITION_END_DATE),
  };
}

export function getCorsOrigins(): string[] {
  const configOrigins = getConfig()
    .CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin);

  // In production, automatically include common production domains
  if (process.env.NODE_ENV === "production") {
    const productionOrigins = [
      "https://recomp-100-fitness-app.onrender.com",
      "https://recomp-100-fitness-app-*.onrender.com", // Wildcard for auto-generated URLs
    ];
    
    // Auto-detect Render URL from environment
    if (process.env.RENDER_EXTERNAL_URL) {
      productionOrigins.push(process.env.RENDER_EXTERNAL_URL);
    }
    
    // Add production origins if they're not already included
    productionOrigins.forEach(origin => {
      if (!configOrigins.includes(origin)) {
        configOrigins.push(origin);
      }
    });
  }

  return configOrigins;
}

export function getAllowedFileTypes(): string[] {
  return getConfig()
    .ALLOWED_FILE_TYPES.split(",")
    .map((type) => type.trim())
    .filter((type) => type);
}

/**
 * Detect current deployment environment and platform
 */
export function getDeploymentEnvironment() {
  // Check for various cloud platform indicators
  const environment = {
    platform: 'local',
    isPersistent: true,
    supportsFileSystem: true,
    recommendedDbPath: './data/fitness_challenge.db',
    backupPath: './data/backups',
    warnings: [] as string[]
  };

  if (process.env.RENDER) {
    environment.platform = 'render';
    environment.recommendedDbPath = '/opt/render/persistent/data/fitness_challenge.db';
    environment.backupPath = '/opt/render/persistent/data/backups';
    
    if (!getDatabasePath().includes('/opt/render/persistent')) {
      environment.isPersistent = false;
      environment.warnings.push('Database not in persistent storage - data will be lost on deployment');
    }
    
  } else if (process.env.RAILWAY_ENVIRONMENT) {
    environment.platform = 'railway';
    environment.recommendedDbPath = '/app/data/fitness_challenge.db';
    environment.backupPath = '/app/data/backups';
    
  } else if (process.env.VERCEL) {
    environment.platform = 'vercel';
    environment.isPersistent = false;
    environment.recommendedDbPath = '/tmp/fitness_challenge.db';
    environment.backupPath = '/tmp/backups';
    environment.warnings.push('Vercel has ephemeral filesystem - consider external database');
    
  } else if (process.env.HEROKU_APP_NAME) {
    environment.platform = 'heroku';
    environment.isPersistent = false;
    environment.recommendedDbPath = '/tmp/fitness_challenge.db';
    environment.backupPath = '/tmp/backups';
    environment.warnings.push('Heroku has ephemeral filesystem - consider external database');
    
  } else if (process.env.FLY_APP_NAME) {
    environment.platform = 'fly';
    environment.recommendedDbPath = '/data/fitness_challenge.db';
    environment.backupPath = '/data/backups';
    
  } else if (process.env.NODE_ENV === 'production') {
    environment.platform = 'production-generic';
    environment.warnings.push('Production environment detected but platform unknown');
  }

  return environment;
}

/**
 * Get environment-specific SQLite optimization settings
 */
export function getSQLiteConfig() {
  const deployEnv = getDeploymentEnvironment();
  const config = getConfig();
  
  const sqliteConfig = {
    // Base settings
    journalMode: 'WAL',
    synchronous: 'NORMAL',
    cacheSize: 10000,
    tempStore: 'memory',
    mmapSize: 268435456, // 256MB
    
    // Environment-specific adjustments
    busyTimeout: 30000,
    walCheckpointInterval: 1000,
  };

  // Adjust for different environments
  if (deployEnv.platform === 'vercel' || deployEnv.platform === 'heroku') {
    // More aggressive settings for ephemeral platforms
    sqliteConfig.synchronous = 'OFF';
    sqliteConfig.tempStore = 'memory';
    sqliteConfig.busyTimeout = 5000;
    sqliteConfig.walCheckpointInterval = 100;
    
  } else if (deployEnv.platform === 'render' || deployEnv.platform === 'railway') {
    // Conservative settings for persistent platforms
    sqliteConfig.synchronous = 'NORMAL';
    sqliteConfig.busyTimeout = 30000;
    sqliteConfig.walCheckpointInterval = 1000;
    
  } else if (config.NODE_ENV === 'development') {
    // Development optimizations
    sqliteConfig.synchronous = 'NORMAL';
    sqliteConfig.cacheSize = 5000;
    sqliteConfig.busyTimeout = 10000;
  }

  return sqliteConfig;
}

/**
 * Validate database configuration for current environment
 */
export function validateDatabaseConfiguration(): {
  isValid: boolean;
  warnings: string[];
  recommendations: string[];
} {
  const config = getConfig();
  const deployEnv = getDeploymentEnvironment();
  const dbPath = getDatabasePath();
  
  const validation = {
    isValid: true,
    warnings: [...deployEnv.warnings],
    recommendations: [] as string[]
  };

  // Check persistence in production
  if (config.NODE_ENV === 'production' && !deployEnv.isPersistent) {
    validation.warnings.push('Database will not persist across deployments');
    validation.recommendations.push('Consider using external database service or persistent storage');
  }

  // Check path appropriateness for platform
  if (deployEnv.platform === 'render' && !dbPath.includes('/opt/render/persistent')) {
    validation.warnings.push('Database not in Render persistent storage');
    validation.recommendations.push(`Set DATABASE_URL=${deployEnv.recommendedDbPath}`);
  }

  if (deployEnv.platform === 'railway' && !dbPath.includes('/app')) {
    validation.recommendations.push(`Consider DATABASE_URL=${deployEnv.recommendedDbPath} for Railway`);
  }

  // Check backup path
  const backupDir = path.dirname(dbPath);
  if (!deployEnv.supportsFileSystem) {
    validation.warnings.push('Platform may not support file system backups');
    validation.recommendations.push('Configure external backup service');
  }

  // File system permissions check
  if (config.NODE_ENV === 'production') {
    try {
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        validation.recommendations.push('Database directory created successfully');
      }
    } catch (error) {
      validation.isValid = false;
      validation.warnings.push(`Cannot create database directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return validation;
}
