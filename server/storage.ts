import {
  users,
  dexaScans,
  scoringData,
  type User,
  type InsertUser,
  type RegisterUser,
  type DexaScan,
  type InsertDexaScan,
  type ScoringData,
  type InsertScoringData,
  type UserWithStats,
  type LeaderboardEntry,
  type ContestantEntry,
} from "../shared/schema.js";
import { calculateFatLossScore, calculateMuscleGainScore } from "../shared/scoring-utils.js";
import { db } from "./db.js";
import { eq, desc, asc, and, isNull, isNotNull, ne, gt, sql } from "drizzle-orm";
import { classifyScanDate } from "../shared/competition-config.js";

export interface IStorage {
  // User operations for username/password auth
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(userData: { username: string; password: string }): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  
  // Competition user operations
  createCompetitionUser(user: InsertUser & { id: string }): Promise<User>;
  getUserWithStats(id: string): Promise<UserWithStats | undefined>;
  getAllUsersWithStats(): Promise<UserWithStats[]>;
  
  // DEXA scan operations
  createDexaScan(scan: InsertDexaScan): Promise<DexaScan>;
  getUserScans(userId: string): Promise<DexaScan[]>;
  getLatestScan(userId: string): Promise<DexaScan | undefined>;
  getBaselineScan(userId: string): Promise<DexaScan | undefined>;
  updateScanImagePath(scanId: string, imagePath: string): Promise<void>;
  updateDexaScan(scanId: string, updates: Partial<InsertDexaScan>): Promise<DexaScan>;
  deleteDexaScan(scanId: string): Promise<void>;
  getDexaScan(scanId: string): Promise<DexaScan | null>;
  
  // Scoring operations
  upsertScoringData(data: InsertScoringData): Promise<ScoringData>;
  getScoringData(userId: string): Promise<ScoringData | undefined>;
  getAllScoringData(): Promise<ScoringData[]>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  getContestants(): Promise<ContestantEntry[]>;
  recalculateAllScores(): Promise<void>;
  
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  getAllScans(): Promise<DexaScan[]>;
  deleteUser(id: string): Promise<void>;
  adminCreateUser(userData: { username: string; password: string; name?: string }): Promise<User>;
  adminUpdateUser(id: string, updates: Partial<User>): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  // User operations for username/password auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: { username: string; password: string }): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  // Password reset methods removed - username/password only

  // Method to update user profile
  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    if (!updatedUser) {
      throw new Error("User not found");
    }
    
    return updatedUser;
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
        targetBodyFatPercent: userData.targetBodyFatPercent,
        targetLeanMass: userData.targetLeanMass,
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
      totalScore: scoring?.totalScore ?? undefined,
      fatLossScore: scoring?.fatLossScore ?? undefined,
      muscleGainScore: scoring?.muscleGainScore ?? undefined,
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
    // Classify scan based on date if not explicitly provided
    const scanDate = scanData.scanDate instanceof Date ? scanData.scanDate : new Date(scanData.scanDate);
    const classification = classifyScanDate(scanDate);
    
    // Apply automatic classification if not explicitly set
    const enrichedScanData = {
      ...scanData,
      isCompetitionEligible: scanData.isCompetitionEligible ?? classification.isCompetitionEligible,
      scanCategory: scanData.scanCategory ?? classification.category,
      // Don't auto-set competitionRole - let baseline management handle it
    };

    console.log(`📅 Creating scan for ${scanDate.toLocaleDateString()}:`, {
      category: enrichedScanData.scanCategory,
      isCompetitionEligible: enrichedScanData.isCompetitionEligible,
      warningType: classification.warningType,
      message: classification.message
    });

    const [scan] = await db.insert(dexaScans).values(enrichedScanData).returning();
    
    // Auto-manage baseline scan: mark earliest competition-eligible scan as baseline
    await this.autoManageBaselineScan(scanData.userId);
    
    // Recalculate scores after new scan (only for competition-eligible scans)
    if (enrichedScanData.isCompetitionEligible) {
      await this.calculateAndUpdateUserScore(scanData.userId);
    }
    
    return scan;
  }

  private async autoManageBaselineScan(userId: string): Promise<void> {
    // Get all competition-eligible scans for this user ordered by scan date
    const competitionScans = await db
      .select()
      .from(dexaScans)
      .where(and(
        eq(dexaScans.userId, userId),
        eq(dexaScans.isCompetitionEligible, true)
      ))
      .orderBy(asc(dexaScans.scanDate));

    // Mark baseline for any user with competition-eligible scans
    if (competitionScans.length < 1) {
      console.log(`User ${userId} has no competition-eligible scans for baseline assignment`);
      return;
    }

    // Find current baseline scans (only among competition-eligible)
    const currentBaselines = competitionScans.filter(scan => scan.isBaseline);
    const earliestCompetitionScan = competitionScans[0];

    // If no baseline exists, or if earliest competition scan is not marked as baseline
    if (currentBaselines.length === 0 || !earliestCompetitionScan.isBaseline) {
      // First, unmark all current baselines for this user
      await db
        .update(dexaScans)
        .set({ 
          isBaseline: false,
          competitionRole: null
        })
        .where(and(
          eq(dexaScans.userId, userId),
          eq(dexaScans.isBaseline, true)
        ));

      // Then mark the earliest competition-eligible scan as baseline
      await db
        .update(dexaScans)
        .set({ 
          isBaseline: true,
          competitionRole: 'baseline'
        })
        .where(eq(dexaScans.id, earliestCompetitionScan.id));
      
      console.log(`Auto-marked earliest competition scan (${earliestCompetitionScan.scanDate}) as baseline for user ${userId}`);
    }
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
    // Get all active users who have at least one DEXA scan
    const usersWithScans = await db
      .select({
        user: users,
      })
      .from(users)
      .innerJoin(dexaScans, eq(users.id, dexaScans.userId))
      .where(eq(users.isActive, true))
      .groupBy(users.id, users.username, users.password, users.name, users.firstName, users.lastName, users.email, users.gender, users.height, users.startingWeight, users.targetBodyFatPercent, users.targetLeanMass, users.isActive, users.createdAt, users.updatedAt);

    const leaderboard: LeaderboardEntry[] = [];

    for (let i = 0; i < usersWithScans.length; i++) {
      const { user } = usersWithScans[i];
      const baselineScan = await this.getBaselineScan(user.id);
      const latestScan = await this.getLatestScan(user.id);
      const scoring = await this.getScoringData(user.id);

      // Get scan name from latest scan that has a name
      const scansWithNames = await db
        .select()
        .from(dexaScans)
        .where(and(
          eq(dexaScans.userId, user.id),
          isNotNull(dexaScans.scanName),
          ne(dexaScans.scanName, '')
        ))
        .orderBy(desc(dexaScans.createdAt))
        .limit(1);

      // Prioritize user's firstName, then extract from scan name, then fall back to user name or email
      let displayName = user.firstName || 'Anonymous';
      
      // If no firstName in user record, try to extract from scan name
      if (!user.firstName && scansWithNames[0]?.scanName) {
        const scanName = scansWithNames[0].scanName;
        // Handle formats like "Parnala, Jaron" -> "Jaron" or "Jaron Parnala" -> "Jaron"
        const nameParts = scanName.split(/[,\s]+/).filter((part: string) => part.trim());
        if (nameParts.length > 1 && scanName.includes(',')) {
          // Format: "Last, First" -> use second part
          displayName = nameParts[1] || nameParts[0];
        } else if (nameParts.length > 0) {
          // Format: "First Last" or just "First" -> use first part
          displayName = nameParts[0];
        }
      }
      
      // Final fallback to user name, email, or username
      if (displayName === 'Anonymous') {
        if (user.name) {
          displayName = user.name.split(' ')[0];
        } else if (user.email) {
          displayName = user.email.split('@')[0];
        } else if (user.username) {
          displayName = user.username;
        } else {
          displayName = 'Anonymous';
        }
      }

      let bodyFatChange = 0;
      let leanMassChange = 0;
      let progressPercent = 0;

      if (baselineScan && latestScan && baselineScan.id !== latestScan.id) {
        // Only calculate changes if there are 2+ scans
        bodyFatChange = ((latestScan.bodyFatPercent - baselineScan.bodyFatPercent) / baselineScan.bodyFatPercent) * 100;
        leanMassChange = ((latestScan.leanMass - baselineScan.leanMass) / baselineScan.leanMass) * 100;
        
        // Calculate progress based on individual user targets
        if (user.targetBodyFatPercent && user.targetLeanMass) {
          // Calculate progress toward user's individual targets
          const bodyFatProgress = this.calculateTargetProgress(
            baselineScan.bodyFatPercent,
            latestScan.bodyFatPercent,
            user.targetBodyFatPercent,
            'decrease' // lower is better for body fat
          );
          
          const leanMassProgress = this.calculateTargetProgress(
            baselineScan.leanMass,
            latestScan.leanMass,
            user.targetLeanMass,
            'increase' // higher is better for lean mass
          );
          
          // Average the two progress components (50% each)
          progressPercent = Math.min(100, (bodyFatProgress + leanMassProgress) / 2);
        } else {
          // Fallback to old calculation if targets not set
          const fatProgress = Math.max(0, -bodyFatChange / 20) * 50;
          const muscleProgress = Math.max(0, leanMassChange / 5) * 50;
          progressPercent = Math.min(100, fatProgress + muscleProgress);
        }
      }

      leaderboard.push({
        user,
        rank: i + 1,
        totalScore: scoring?.totalScore || 0,
        fatLossScore: scoring?.fatLossScore || 0,
        muscleGainScore: scoring?.muscleGainScore || 0,
        bodyFatChange,
        leanMassChange,
        progressPercent,
        displayName,
        latestScan,
        baselineScan,
      });
    }

    // Sort by total score (users with 0 score will be at the bottom)
    leaderboard.sort((a, b) => b.totalScore - a.totalScore);
    
    // Update ranks after sorting
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return leaderboard;
  }

  async getContestants(): Promise<ContestantEntry[]> {
    // Get all active users with baseline scans
    const usersWithBaseline = await db
      .select({
        user: users,
        baselineScan: dexaScans,
      })
      .from(users)
      .innerJoin(dexaScans, and(
        eq(users.id, dexaScans.userId),
        eq(dexaScans.isBaseline, true)
      ))
      .where(eq(users.isActive, true))
      .orderBy(asc(dexaScans.scanDate));

    const contestants: ContestantEntry[] = usersWithBaseline.map(({ user, baselineScan }) => ({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        targetBodyFatPercent: user.targetBodyFatPercent,
        targetLeanMass: user.targetLeanMass,
      },
      baselineScan: {
        bodyFatPercent: baselineScan.bodyFatPercent,
        leanMass: baselineScan.leanMass,
        scanDate: baselineScan.scanDate,
      },
    }));

    return contestants;
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.createdAt));
  }

  async getAllScans(): Promise<DexaScan[]> {
    return await db.select().from(dexaScans).orderBy(desc(dexaScans.scanDate));
  }

  async deleteUser(id: string): Promise<void> {
    // Delete user's DEXA scans first
    await db.delete(dexaScans).where(eq(dexaScans.userId, id));
    
    // Delete user's scoring data
    await db.delete(scoringData).where(eq(scoringData.userId, id));
    
    // Delete the user
    await db.delete(users).where(eq(users.id, id));
  }

  async adminCreateUser(userData: { username: string; password: string; name?: string }): Promise<User> {
    const [user] = await db.insert(users).values({
      username: userData.username,
      password: userData.password,
      name: userData.name || null,
      isActive: true,
    }).returning();
    
    return user;
  }

  async adminUpdateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db.update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    
    return user;
  }

  // Helper method to calculate progress toward individual targets
  private calculateTargetProgress(
    startValue: number, 
    currentValue: number, 
    targetValue: number, 
    direction: 'increase' | 'decrease'
  ): number {
    if (direction === 'decrease') {
      // For body fat: lower is better
      if (startValue <= targetValue) return 100; // Already at or below target
      
      const totalProgress = startValue - targetValue; // How much they need to lose
      const currentProgress = startValue - currentValue; // How much they've lost
      
      return Math.max(0, Math.min(100, (currentProgress / totalProgress) * 100));
    } else {
      // For lean mass: higher is better  
      if (startValue >= targetValue) return 100; // Already at or above target
      
      const totalProgress = targetValue - startValue; // How much they need to gain
      const currentProgress = currentValue - startValue; // How much they've gained
      
      return Math.max(0, Math.min(100, (currentProgress / totalProgress) * 100));
    }
  }

  private async calculateAndUpdateUserScore(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user) return;

    const allScans = await this.getUserScans(userId);
    
    // P0 Feature: Require BOTH baseline scan AND final scan for competition scoring
    const baselineScan = allScans.find(scan => scan.isBaseline);
    const finalScan = allScans.find(scan => scan.isFinal);
    
    if (!baselineScan) {
      console.log(`User ${userId} needs a designated baseline scan for competition scoring`);
      return;
    }

    // Require at least 2 scans: baseline + at least one more scan
    if (allScans.length < 2) {
      console.log(`User ${userId} needs at least 2 DEXA scans for competition scoring (has ${allScans.length})`);
      
      // Clear any existing scoring data since user no longer qualifies for competition scoring
      const existingScore = await this.getScoringData(userId);
      if (existingScore) {
        console.log(`Clearing stale scoring data for user ${userId} (insufficient scans)`);
        await db.delete(scoringData).where(eq(scoringData.userId, userId));
      }
      return;
    }

    // For now, if no explicit final scan, use latest non-baseline scan
    const competitionFinalScan = finalScan || allScans.filter(scan => !scan.isBaseline)[0];
    
    if (!competitionFinalScan) {
      console.log(`User ${userId} needs both baseline and final scans for competition scoring`);
      return;
    }

    console.log(`Competition scoring: ${baselineScan.isBaseline ? 'Baseline' : 'Latest'} vs ${finalScan ? 'Final' : 'Latest non-baseline'} scan`);
    const latestScan = competitionFinalScan;

    console.log(`Calculating scores for user ${userId}:`);
    console.log(`Baseline: BF=${baselineScan.bodyFatPercent}%, LM=${baselineScan.leanMass}lbs`);
    console.log(`Latest: BF=${latestScan.bodyFatPercent}%, LM=${latestScan.leanMass}lbs`);

    // Calculate percentage changes from baseline
    const bodyFatPercentChange = ((latestScan.bodyFatPercent - baselineScan.bodyFatPercent) / baselineScan.bodyFatPercent) * 100;
    const leanMassPercentChange = ((latestScan.leanMass - baselineScan.leanMass) / baselineScan.leanMass) * 100;

    console.log(`Body fat % change: ${bodyFatPercentChange.toFixed(2)}%`);
    console.log(`Lean mass % change: ${leanMassPercentChange.toFixed(2)}%`);

    // Calculate RAW scores using research-based formulas from PDF
    // Use shared utilities to ensure consistency and correct gender handling (case-insensitive)
    const fatLossRawScore = calculateFatLossScore(
      baselineScan.bodyFatPercent, 
      latestScan.bodyFatPercent, 
      user.gender || "male", 
      baselineScan.bodyFatPercent
    );
    const muscleGainRawScore = calculateMuscleGainScore(
      baselineScan.leanMass, 
      latestScan.leanMass, 
      user.gender || "male"
    );

    console.log(`Calculated raw scores: FLS=${fatLossRawScore.toFixed(2)}, MGS=${muscleGainRawScore.toFixed(2)}, Total=${(fatLossRawScore + muscleGainRawScore).toFixed(2)}`);

    // Store raw scores directly - no normalization
    await this.upsertScoringData({
      userId,
      fatLossScore: fatLossRawScore,
      muscleGainScore: muscleGainRawScore,
      totalScore: fatLossRawScore + muscleGainRawScore,
      fatLossRaw: fatLossRawScore,
      muscleGainRaw: muscleGainRawScore,
    });
  }

  async recalculateAllScores(): Promise<void> {
    // Get all users with scoring data
    const allScoring = await db.select().from(scoringData);
    
    // Recalculate raw scores for all users - now using raw scores directly
    for (const scoring of allScoring) {
      await this.calculateAndUpdateUserScore(scoring.userId);
    }
    
    console.log('✅ All scores recalculated using research-based raw scoring formulas');
  }

  async updateDexaScan(scanId: string, updates: Partial<InsertDexaScan>): Promise<DexaScan> {
    const [result] = await db
      .update(dexaScans)
      .set(updates)
      .where(eq(dexaScans.id, scanId))
      .returning();

    if (!result) {
      throw new Error("Scan not found");
    }

    // Recalculate user's score after updating scan
    await this.calculateAndUpdateUserScore(result.userId);

    return result;
  }

  async deleteDexaScan(scanId: string): Promise<void> {
    const scan = await this.getDexaScan(scanId);
    if (!scan) {
      throw new Error("Scan not found");
    }

    await db
      .delete(dexaScans)
      .where(eq(dexaScans.id, scanId));

    // Recalculate user's score after deleting scan
    await this.calculateAndUpdateUserScore(scan.userId);
  }

  async getDexaScan(scanId: string): Promise<DexaScan | null> {
    const [result] = await db
      .select()
      .from(dexaScans)
      .where(eq(dexaScans.id, scanId))
      .limit(1);

    return result || null;
  }

  async getAllScoringData(): Promise<ScoringData[]> {
    return await db
      .select()
      .from(scoringData);
  }


  private async getParticipantCount(): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(scoringData);
    
    return result?.count || 0;
  }

  // Fix baseline scans for all users - marks earliest scan as baseline
  async fixAllBaselines(): Promise<void> {
    // Get all users who have scans
    const usersWithScans = await db
      .selectDistinct({ userId: dexaScans.userId })
      .from(dexaScans);
    
    console.log(`Fixing baseline scans for ${usersWithScans.length} users`);
    
    for (const { userId } of usersWithScans) {
      await this.autoManageBaselineScan(userId);
    }
    
    console.log('Finished fixing baseline scans for all users');
  }
}

export const storage = new DatabaseStorage();
