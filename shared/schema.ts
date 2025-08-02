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

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Competition specific fields
  name: text("name").notNull(),
  gender: varchar("gender", { enum: ["male", "female"] }).notNull(),
  height: text("height").notNull(),
  startingWeight: real("starting_weight").notNull(),
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
  scanImagePath: text("scan_image_path"), // object storage path
  isBaseline: boolean("is_baseline").default(false).notNull(),
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
});

export const insertDexaScanSchema = createInsertSchema(dexaScans).omit({
  id: true,
  createdAt: true,
});

export const insertScoringDataSchema = createInsertSchema(scoringData).omit({
  id: true,
  lastCalculated: true,
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

// Types
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
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
};
