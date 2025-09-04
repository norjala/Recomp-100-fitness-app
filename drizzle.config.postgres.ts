import { defineConfig } from "drizzle-kit";

// PostgreSQL configuration for Railway deployment
export default defineConfig({
  out: "./migrations-postgres",
  schema: "./shared/schema.ts", 
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  verbose: true,
  strict: true,
  // PostgreSQL specific options
  breakpoints: true,
  migrations: {
    prefix: "timestamp",
  },
});