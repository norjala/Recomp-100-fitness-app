import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  isAdmin: integer("is_admin", { mode: "boolean" }).default(false),
});

export const dexaScans = sqliteTable("dexa_scans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  scanDate: text("scan_date").default(sql`CURRENT_TIMESTAMP`),
  bodyFatPercentage: real("body_fat_percentage"),
  muscleMass: real("muscle_mass"),
  boneDensity: real("bone_density"),
  visceralFat: real("visceral_fat"),
  totalWeight: real("total_weight"),
  imageUrl: text("image_url"),
  notes: text("notes"),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DexaScan = typeof dexaScans.$inferSelect;
export type NewDexaScan = typeof dexaScans.$inferInsert;