import {
  users,
  dexaScans,
  scoringData,
  type User,
  type UpsertUser,
  type InsertUser,
  type DexaScan,
  type InsertDexaScan,
  type ScoringData,
  type InsertScoringData,
  type UserWithStats,
  type LeaderboardEntry,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, isNull } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Competition user operations
  createCompetitionUser(user: InsertUser): Promise<User>;
  getUserWithStats(id: string): Promise<UserWithStats | undefined>;
  getAllUsersWithStats(): Promise<UserWithStats[]>;
  
  // DEXA scan operations
  createDexaScan(scan: InsertDexaScan): Promise<DexaScan>;
  getUserScans(userId: string): Promise<DexaScan[]>;
  getLatestScan(userId: string): Promise<DexaScan | undefined>;
  getBaselineScan(userId: string): Promise<DexaScan | undefined>;
  updateScanImagePath(scanId: string, imagePath: string): Promise<void>;
  
  // Scoring operations
  upsertScoringData(data: InsertScoringData): Promise<ScoringData>;
  getScoringData(userId: string): Promise<ScoringData | undefined>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  recalculateAllScores(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Competition user operations  
  async createCompetitionUser(userData: InsertUser & { id: string }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        name: userData.name,
        gender: userData.gender,
        height: userData.height,
        startingWeight: userData.startingWeight,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userData.id))
      .returning();
    return user;
  }

  async getUserWithStats(id: string): Promise<UserWithStats | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    const userScans = await this.getUserScans(id);
    const latestScan = await this.getLatestScan(id);
    const baselineScan = await this.getBaselineScan(id);
    const scoring = await this.getScoringData(id);

    return {
      ...user,
      currentBodyFat: latestScan?.bodyFatPercent,
      currentLeanMass: latestScan?.leanMass,
      currentWeight: latestScan?.totalWeight,
      latestScan,
      baselineScan,
      totalScans: userScans.length,
      totalScore: scoring?.totalScore,
      fatLossScore: scoring?.fatLossScore,
      muscleGainScore: scoring?.muscleGainScore,
    };
  }

  async getAllUsersWithStats(): Promise<UserWithStats[]> {
    const allUsers = await db.select().from(users).where(eq(users.isActive, true));
    const usersWithStats: UserWithStats[] = [];

    for (const user of allUsers) {
      const userStats = await this.getUserWithStats(user.id);
      if (userStats) {
        usersWithStats.push(userStats);
      }
    }

    return usersWithStats;
  }

  // DEXA scan operations
  async createDexaScan(scanData: InsertDexaScan): Promise<DexaScan> {
    const [scan] = await db.insert(dexaScans).values(scanData).returning();
    
    // Recalculate scores after new scan
    await this.calculateAndUpdateUserScore(scanData.userId);
    
    return scan;
  }

  async getUserScans(userId: string): Promise<DexaScan[]> {
    return await db
      .select()
      .from(dexaScans)
      .where(eq(dexaScans.userId, userId))
      .orderBy(desc(dexaScans.scanDate));
  }

  async getLatestScan(userId: string): Promise<DexaScan | undefined> {
    const [scan] = await db
      .select()
      .from(dexaScans)
      .where(eq(dexaScans.userId, userId))
      .orderBy(desc(dexaScans.scanDate))
      .limit(1);
    return scan;
  }

  async getBaselineScan(userId: string): Promise<DexaScan | undefined> {
    const [scan] = await db
      .select()
      .from(dexaScans)
      .where(and(eq(dexaScans.userId, userId), eq(dexaScans.isBaseline, true)))
      .limit(1);
    return scan;
  }

  async updateScanImagePath(scanId: string, imagePath: string): Promise<void> {
    await db
      .update(dexaScans)
      .set({ scanImagePath: imagePath })
      .where(eq(dexaScans.id, scanId));
  }

  // Scoring operations
  async upsertScoringData(data: InsertScoringData): Promise<ScoringData> {
    const [scoring] = await db
      .insert(scoringData)
      .values(data)
      .onConflictDoUpdate({
        target: scoringData.userId,
        set: {
          ...data,
          lastCalculated: new Date(),
        },
      })
      .returning();
    return scoring;
  }

  async getScoringData(userId: string): Promise<ScoringData | undefined> {
    const [data] = await db
      .select()
      .from(scoringData)
      .where(eq(scoringData.userId, userId));
    return data;
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const allScoring = await db
      .select({
        scoring: scoringData,
        user: users,
      })
      .from(scoringData)
      .innerJoin(users, eq(scoringData.userId, users.id))
      .where(eq(users.isActive, true))
      .orderBy(desc(scoringData.totalScore));

    const leaderboard: LeaderboardEntry[] = [];

    for (let i = 0; i < allScoring.length; i++) {
      const { scoring, user } = allScoring[i];
      const baselineScan = await this.getBaselineScan(user.id);
      const latestScan = await this.getLatestScan(user.id);

      let bodyFatChange = 0;
      let leanMassChange = 0;
      let progressPercent = 0;

      if (baselineScan && latestScan) {
        bodyFatChange = ((latestScan.bodyFatPercent - baselineScan.bodyFatPercent) / baselineScan.bodyFatPercent) * 100;
        leanMassChange = ((latestScan.leanMass - baselineScan.leanMass) / baselineScan.leanMass) * 100;
        
        // Calculate progress as combination of fat loss and muscle gain
        const fatProgress = Math.max(0, -bodyFatChange / 20) * 50; // Normalize to 50%
        const muscleProgress = Math.max(0, leanMassChange / 5) * 50; // Normalize to 50%
        progressPercent = Math.min(100, fatProgress + muscleProgress);
      }

      leaderboard.push({
        user,
        rank: i + 1,
        totalScore: scoring.totalScore,
        fatLossScore: scoring.fatLossScore,
        muscleGainScore: scoring.muscleGainScore,
        bodyFatChange,
        leanMassChange,
        progressPercent,
      });
    }

    return leaderboard;
  }

  private async calculateAndUpdateUserScore(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;

    const baselineScan = await this.getBaselineScan(userId);
    const latestScan = await this.getLatestScan(userId);

    if (!baselineScan || !latestScan) return;

    // Calculate raw scores
    const fatLossRaw = this.calculateFatLossScore(
      baselineScan.bodyFatPercent,
      latestScan.bodyFatPercent,
      user.gender || "male", // Default to male if gender not set
      baselineScan.bodyFatPercent
    );

    const muscleGainRaw = this.calculateMuscleGainScore(
      baselineScan.leanMass,
      latestScan.leanMass,
      user.gender || "male" // Default to male if gender not set
    );

    // Store raw scores for now - normalization happens across all users
    await this.upsertScoringData({
      userId,
      fatLossScore: fatLossRaw, // Will be normalized later
      muscleGainScore: muscleGainRaw, // Will be normalized later
      totalScore: fatLossRaw + muscleGainRaw, // Will be recalculated after normalization
      fatLossRaw,
      muscleGainRaw,
    });
  }

  private calculateFatLossScore(
    startBF: number,
    endBF: number,
    gender: string,
    startingBF: number
  ): number {
    if (endBF >= startBF) return 0; // No fat loss

    const leanessMultiplier = this.getLeanessMultiplier(gender, startingBF);
    const score = Math.log(startBF / endBF) * 100 * leanessMultiplier;
    return Math.max(0, score);
  }

  private calculateMuscleGainScore(
    startLM: number,
    endLM: number,
    gender: string
  ): number {
    const leanMassChange = ((endLM - startLM) / startLM) * 100;
    if (leanMassChange <= 0) return 0; // No muscle gain

    const genderMultiplier = gender === "female" ? 2.0 : 1.0;
    return leanMassChange * 100 * 17 * genderMultiplier;
  }

  private getLeanessMultiplier(gender: string, bodyFatPercent: number): number {
    if (gender === "male") {
      if (bodyFatPercent < 15) return 1.4;
      if (bodyFatPercent < 18) return 1.3;
      if (bodyFatPercent < 21) return 1.2;
      if (bodyFatPercent < 25) return 1.1;
      return 1.0;
    } else {
      if (bodyFatPercent < 20) return 1.4;
      if (bodyFatPercent < 23) return 1.3;
      if (bodyFatPercent < 26) return 1.2;
      if (bodyFatPercent < 30) return 1.1;
      return 1.0;
    }
  }

  async recalculateAllScores(): Promise<void> {
    // Get all users with scoring data
    const allScoring = await db.select().from(scoringData);
    
    // Recalculate raw scores for all users
    for (const scoring of allScoring) {
      await this.calculateAndUpdateUserScore(scoring.userId);
    }

    // Get all raw scores for normalization
    const updatedScoring = await db.select().from(scoringData);
    
    if (updatedScoring.length === 0) return;

    // Find min and max for normalization
    const fatLossScores = updatedScoring.map(s => s.fatLossRaw).filter(s => s > 0);
    const muscleGainScores = updatedScoring.map(s => s.muscleGainRaw).filter(s => s > 0);

    const minFLS = Math.min(...fatLossScores);
    const maxFLS = Math.max(...fatLossScores);
    const minMGS = Math.min(...muscleGainScores);
    const maxMGS = Math.max(...muscleGainScores);

    // Normalize and update scores
    for (const scoring of updatedScoring) {
      let normalizedFLS = 0;
      let normalizedMGS = 0;

      if (scoring.fatLossRaw > 0 && maxFLS > minFLS) {
        normalizedFLS = 1 + ((scoring.fatLossRaw - minFLS) / (maxFLS - minFLS)) * 99;
      }

      if (scoring.muscleGainRaw > 0 && maxMGS > minMGS) {
        normalizedMGS = 1 + ((scoring.muscleGainRaw - minMGS) / (maxMGS - minMGS)) * 99;
      }

      await db
        .update(scoringData)
        .set({
          fatLossScore: normalizedFLS,
          muscleGainScore: normalizedMGS,
          totalScore: normalizedFLS + normalizedMGS,
          lastCalculated: new Date(),
        })
        .where(eq(scoringData.userId, scoring.userId));
    }
  }
}

export const storage = new DatabaseStorage();
