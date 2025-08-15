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
  notes: text("notes"),
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
});

export const selectDexaScanSchema = createSelectSchema(dexaScans);

export const insertScoringDataSchema = createInsertSchema(scoringData);
export const selectScoringDataSchema = createSelectSchema(scoringData);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type RegisterUser = z.infer<typeof registerUserSchema>;

export type DexaScan = typeof dexaScans.$inferSelect;
export type InsertDexaScan = typeof dexaScans.$inferInsert;

export type ScoringData = typeof scoringData.$inferSelect;
export type InsertScoringData = typeof scoringData.$inferInsert;

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