import { sql, relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  real,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for username/email and password authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique(), // Optional unique username
  email: varchar("email").unique(), // Optional unique email
  password: varchar("password").notNull(),
  isEmailVerified: boolean("is_email_verified").default(false).notNull(),
  emailVerificationToken: varchar("email_verification_token"),
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  // Competition specific fields - optional until profile is completed
  name: text("name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  gender: varchar("gender", { enum: ["male", "female"] }),
  height: text("height"),
  startingWeight: real("starting_weight"),
  targetBodyFatPercent: real("target_body_fat_percent"), // User's target body fat %
  targetLeanMass: real("target_lean_mass"), // User's target lean mass in lbs
  profileImageUrl: text("profile_image_url"), // Add profile image URL field
  joinDate: timestamp("join_date").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// DEXA scans table
export const dexaScans = pgTable("dexa_scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  scanDate: timestamp("scan_date").notNull(),
  bodyFatPercent: real("body_fat_percent").notNull(),
  leanMass: real("lean_mass").notNull(), // in lbs
  totalWeight: real("total_weight").notNull(), // in lbs
  fatMass: real("fat_mass").notNull(), // in lbs
  rmr: real("rmr"), // Resting Metabolic Rate
  scanName: text("scan_name"), // Name from the scan
  scanImagePath: text("scan_image_path"), // object storage path
  isBaseline: boolean("is_baseline").default(false).notNull(),
  notes: text("notes"), // Add notes field for DEXA scans
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Scoring data table for caching calculated scores
export const scoringData = pgTable("scoring_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  fatLossScore: real("fat_loss_score").notNull(),
  muscleGainScore: real("muscle_gain_score").notNull(),
  totalScore: real("total_score").notNull(),
  fatLossRaw: real("fat_loss_raw").notNull(),
  muscleGainRaw: real("muscle_gain_raw").notNull(),
  lastCalculated: timestamp("last_calculated").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  dexaScans: many(dexaScans),
  scoringData: many(scoringData),
}));

export const dexaScansRelations = relations(dexaScans, ({ one }) => ({
  user: one(users, {
    fields: [dexaScans.userId],
    references: [users.id],
  }),
}));

export const scoringDataRelations = relations(scoringData, ({ one }) => ({
  user: one(users, {
    fields: [scoringData.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Make competition fields required when creating a competition profile
  name: z.string().min(1, "Name is required"),
  gender: z.enum(["male", "female"]),
  height: z.string().min(1, "Height is required"),
  startingWeight: z.number().positive("Starting weight must be positive"),
});

export const insertDexaScanSchema = createInsertSchema(dexaScans).omit({
  id: true,
  createdAt: true,
});

export const insertScoringDataSchema = createInsertSchema(scoringData).omit({
  id: true,
  lastCalculated: true,
});

// Auth schemas
export const registerUserSchema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => {
  // Check if identifier is email format
  const isEmail = z.string().email().safeParse(data.identifier).success;
  return isEmail || data.identifier.length >= 3; // Username must be at least 3 chars
}, {
  message: "Must be a valid email or username (minimum 3 characters)",
  path: ["identifier"]
});

export const loginUserSchema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "Username or email is required"),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type RegisterUser = z.infer<typeof registerUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type ForgotPassword = z.infer<typeof forgotPasswordSchema>;
export type ResetPassword = z.infer<typeof resetPasswordSchema>;
export type DexaScan = typeof dexaScans.$inferSelect;
export type InsertDexaScan = z.infer<typeof insertDexaScanSchema>;
export type ScoringData = typeof scoringData.$inferSelect;
export type InsertScoringData = z.infer<typeof insertScoringDataSchema>;

// Extended types for API responses
export type UserWithStats = User & {
  currentBodyFat?: number;
  currentLeanMass?: number;
  currentWeight?: number;
  latestScan?: DexaScan;
  baselineScan?: DexaScan;
  totalScans: number;
  currentRank?: number;
  totalScore?: number;
  fatLossScore?: number;
  muscleGainScore?: number;
};

export type LeaderboardEntry = {
  user: User;
  rank: number;
  totalScore: number;
  fatLossScore: number;
  muscleGainScore: number;
  bodyFatChange: number;
  leanMassChange: number;
  progressPercent: number;
  displayName: string; // Name from DEXA scan or user account name
  latestScan?: DexaScan;
};

export type ContestantEntry = {
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
};
