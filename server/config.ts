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
  const dbUrl = config.DATABASE_URL;

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
      "https://recomp-100-fitness-app-onrender.com", // Alternative format
    ];
    
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
