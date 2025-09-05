import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").unique(),
  email: text("email").unique(),
  password: text("password").notNull(),
  name: text("name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  gender: text("gender", { enum: ["male", "female"] }),
  height: text("height"),
  startingWeight: real("starting_weight"),
  targetBodyFatPercent: real("target_body_fat_percent"),
  targetLeanMass: real("target_lean_mass"),
  profileImageUrl: text("profile_image_url"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  isEmailVerified: integer("is_email_verified", { mode: "boolean" }).default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpires: integer("email_verification_expires", { mode: "timestamp" }),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: integer("password_reset_expires", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// DEXA Scans table
export const dexaScans = sqliteTable("dexa_scans", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scanDate: integer("scan_date", { mode: "timestamp" }).notNull(),
  bodyFatPercent: real("body_fat_percent").notNull(),
  leanMass: real("lean_mass").notNull(),
  totalWeight: real("total_weight").notNull(),
  fatMass: real("fat_mass"),
  rmr: real("rmr"),
  scanName: text("scan_name"),
  scanImagePath: text("scan_image_path"),
  isBaseline: integer("is_baseline", { mode: "boolean" }).default(false),
  isFinal: integer("is_final", { mode: "boolean" }).default(false),
  notes: text("notes"),
  // Competition validation fields
  isCompetitionEligible: integer("is_competition_eligible", { mode: "boolean" }).default(true), // Conservative default
  scanCategory: text("scan_category", { enum: ["historical", "competition", "post-challenge"] }).default("competition"),
  competitionRole: text("competition_role", { enum: ["baseline", "progress", "final"] }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Scoring Data table
export const scoringData = sqliteTable("scoring_data", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  fatLossScore: real("fat_loss_score").default(0),
  muscleGainScore: real("muscle_gain_score").default(0),
  totalScore: real("total_score").default(0),
  fatLossRaw: real("fat_loss_raw").default(0),
  muscleGainRaw: real("muscle_gain_raw").default(0),
  lastCalculated: integer("last_calculated", { mode: "timestamp" }).$defaultFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Scoring Ranges table for normalization
export const scoringRanges = sqliteTable("scoring_ranges", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  competitionId: text("competition_id").default("recomp100_2025"), // Support multiple competitions
  minFatLoss: real("min_fat_loss").notNull().default(0),
  maxFatLoss: real("max_fat_loss").notNull().default(100),
  minMuscleGain: real("min_muscle_gain").notNull().default(0),
  maxMuscleGain: real("max_muscle_gain").notNull().default(100),
  participantCount: integer("participant_count").default(0),
  lastUpdated: integer("last_updated", { mode: "timestamp" }).$defaultFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email().optional(),
  password: z.string().min(6),
  gender: z.enum(["male", "female"]).optional(),
  startingWeight: z.number().positive().optional(),
  targetBodyFatPercent: z.number().min(1).max(50).optional(),
  targetLeanMass: z.number().positive().optional(),
});

export const selectUserSchema = createSelectSchema(users);

export const loginUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertDexaScanSchema = createInsertSchema(dexaScans, {
  bodyFatPercent: z.number().min(0).max(100),
  leanMass: z.number().positive(),
  totalWeight: z.number().positive(),
  fatMass: z.number().min(0).optional(),
  rmr: z.number().min(0).optional(),
  scanDate: z.date(),
  isCompetitionEligible: z.boolean().default(true),
  scanCategory: z.enum(["historical", "competition", "post-challenge"]).default("competition"),
  competitionRole: z.enum(["baseline", "progress", "final"]).optional(),
});

export const selectDexaScanSchema = createSelectSchema(dexaScans);

export const insertScoringDataSchema = createInsertSchema(scoringData);
export const selectScoringDataSchema = createSelectSchema(scoringData);

export const insertScoringRangesSchema = createInsertSchema(scoringRanges);
export const selectScoringRangesSchema = createSelectSchema(scoringRanges);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type RegisterUser = z.infer<typeof registerUserSchema>;

export type DexaScan = typeof dexaScans.$inferSelect;
export type InsertDexaScan = typeof dexaScans.$inferInsert;

export type ScoringData = typeof scoringData.$inferSelect;
export type InsertScoringData = typeof scoringData.$inferInsert;

export type ScoringRanges = typeof scoringRanges.$inferSelect;
export type InsertScoringRanges = typeof scoringRanges.$inferInsert;

// Extended types for API responses
export interface UserWithStats extends User {
  currentBodyFat?: number;
  currentLeanMass?: number;
  currentWeight?: number;
  latestScan?: DexaScan;
  baselineScan?: DexaScan;
  totalScans: number;
  totalScore?: number;
  fatLossScore?: number;
  muscleGainScore?: number;
}

export interface LeaderboardEntry {
  user: User;
  rank: number;
  totalScore: number;
  fatLossScore: number;
  muscleGainScore: number;
  bodyFatChange: number;
  leanMassChange: number;
  progressPercent: number;
  displayName: string;
  latestScan?: DexaScan;
}

export interface ContestantEntry {
  user: {
    id: string;
    name: string | null;
    username: string | null;
    targetBodyFatPercent: number | null;
    targetLeanMass: number | null;
  };
  baselineScan: {
    bodyFatPercent: number;
    leanMass: number;
    scanDate: Date;
  };
}

// Extraction Analytics tables
export const extractionAttempts = sqliteTable("extraction_attempts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileType: text("file_type", { enum: ["image", "pdf"] }).notNull(),
  fileSize: integer("file_size").notNull(),
  extractionMethod: text("extraction_method").notNull(), // 'vision', 'text', 'ocr_fallback', 'manual'
  vendor: text("vendor"), // detected vendor
  confidence: real("confidence").default(0),
  success: integer("success", { mode: "boolean" }).default(false),
  errorMessage: text("error_message"),
  processingTime: integer("processing_time"), // milliseconds
  tokenUsage: integer("token_usage"),
  retryAttempts: integer("retry_attempts").default(0),
  fallbackUsed: integer("fallback_used", { mode: "boolean" }).default(false),
  userCorrected: integer("user_corrected", { mode: "boolean" }).default(false),
  extractedData: text("extracted_data"), // JSON blob of extracted values
  finalData: text("final_data"), // JSON blob of user-corrected final values
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const extractionFeedback = sqliteTable("extraction_feedback", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  extractionId: text("extraction_id").notNull().references(() => extractionAttempts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accuracy: integer("accuracy"), // 1-5 rating
  fieldCorrections: text("field_corrections"), // JSON of which fields were wrong
  userComments: text("user_comments"),
  suggestedVendor: text("suggested_vendor"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const extractionPatterns = sqliteTable("extraction_patterns", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  vendor: text("vendor").notNull(),
  fileType: text("file_type", { enum: ["image", "pdf"] }).notNull(),
  pattern: text("pattern").notNull(), // regex or text pattern that worked
  fieldType: text("field_type").notNull(), // 'bodyFat', 'leanMass', etc.
  confidence: real("confidence").default(0),
  successCount: integer("success_count").default(1),
  lastUsed: integer("last_used", { mode: "timestamp" }).$defaultFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const ocrFallbackData = sqliteTable("ocr_fallback_data", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  extractionId: text("extraction_id").notNull().references(() => extractionAttempts.id, { onDelete: "cascade" }),
  ocrEngine: text("ocr_engine").notNull(), // 'tesseract', 'vision_api', etc.
  ocrText: text("ocr_text").notNull(),
  confidence: real("confidence").default(0),
  processingTime: integer("processing_time"),
  success: integer("success", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// Zod schemas for new tables
export const insertExtractionAttemptSchema = createInsertSchema(extractionAttempts);
export const selectExtractionAttemptSchema = createSelectSchema(extractionAttempts);

export const insertExtractionFeedbackSchema = createInsertSchema(extractionFeedback, {
  accuracy: z.number().min(1).max(5),
});
export const selectExtractionFeedbackSchema = createSelectSchema(extractionFeedback);

export const insertExtractionPatternSchema = createInsertSchema(extractionPatterns);
export const selectExtractionPatternSchema = createSelectSchema(extractionPatterns);

export const insertOcrFallbackDataSchema = createInsertSchema(ocrFallbackData);
export const selectOcrFallbackDataSchema = createSelectSchema(ocrFallbackData);

// Types for new tables
export type ExtractionAttempt = typeof extractionAttempts.$inferSelect;
export type InsertExtractionAttempt = typeof extractionAttempts.$inferInsert;

export type ExtractionFeedback = typeof extractionFeedback.$inferSelect;
export type InsertExtractionFeedback = typeof extractionFeedback.$inferInsert;

export type ExtractionPattern = typeof extractionPatterns.$inferSelect;
export type InsertExtractionPattern = typeof extractionPatterns.$inferInsert;

export type OcrFallbackData = typeof ocrFallbackData.$inferSelect;
export type InsertOcrFallbackData = typeof ocrFallbackData.$inferInsert;

// Extended types for analytics
export interface ExtractionAnalytics {
  totalAttempts: number;
  successRate: number;
  averageConfidence: number;
  commonFailures: Array<{
    error: string;
    count: number;
  }>;
  vendorBreakdown: Array<{
    vendor: string;
    attempts: number;
    successRate: number;
  }>;
  methodBreakdown: Array<{
    method: string;
    attempts: number;
    successRate: number;
  }>;
}

export interface SmartSuggestion {
  field: string;
  value: number | string;
  confidence: number;
  source: 'historical' | 'pattern' | 'ocr' | 'estimation';
  reasoning: string;
}