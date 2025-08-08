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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, isNull, isNotNull, ne } from "drizzle-orm";

export interface IStorage {
  // User operations for email/password auth
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByIdentifier(identifier: string): Promise<User | undefined>; // Email or username
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(userData: { username?: string; email?: string; password: string; emailVerificationToken?: string }): Promise<User>;
  verifyUserEmail(id: string): Promise<void>;
  updateVerificationToken(id: string, token: string): Promise<void>;
  setPasswordResetToken(id: string, token: string, expires: Date): Promise<void>;
  resetPassword(id: string, hashedPassword: string): Promise<void>;
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
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  getContestants(): Promise<ContestantEntry[]>;
  recalculateAllScores(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations for email/password auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
    return user;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByIdentifier(identifier: string): Promise<User | undefined> {
    // Check if identifier is email format
    const isEmail = identifier.includes('@');
    
    if (isEmail) {
      return this.getUserByEmail(identifier);
    } else {
      return this.getUserByUsername(identifier);
    }
  }

  async createUser(userData: { username?: string; email?: string; password: string; emailVerificationToken?: string }): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async verifyUserEmail(id: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        isEmailVerified: true, 
        emailVerificationToken: null,
        updatedAt: new Date() 
      })
      .where(eq(users.id, id));
  }

  async updateVerificationToken(id: string, token: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        emailVerificationToken: token,
        updatedAt: new Date() 
      })
      .where(eq(users.id, id));
  }

  async setPasswordResetToken(id: string, token: string, expires: Date): Promise<void> {
    await db
      .update(users)
      .set({ 
        passwordResetToken: token,
        passwordResetExpires: expires,
        updatedAt: new Date() 
      })
      .where(eq(users.id, id));
  }

  async resetPassword(id: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date() 
      })
      .where(eq(users.id, id));
  }

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
    
    // Auto-manage baseline scan: mark earliest scan as baseline when user has ≥2 scans
    await this.autoManageBaselineScan(scanData.userId);
    
    // Recalculate scores after new scan
    await this.calculateAndUpdateUserScore(scanData.userId);
    
    return scan;
  }

  private async autoManageBaselineScan(userId: string): Promise<void> {
    // Get all scans for this user ordered by scan date
    const allScans = await db
      .select()
      .from(dexaScans)
      .where(eq(dexaScans.userId, userId))
      .orderBy(asc(dexaScans.scanDate));

    // Only proceed if user has at least 2 scans
    if (allScans.length < 2) {
      return;
    }

    // Find current baseline scans
    const currentBaselines = allScans.filter(scan => scan.isBaseline);
    const earliestScan = allScans[0];

    // If no baseline exists, or if earliest scan is not marked as baseline
    if (currentBaselines.length === 0 || !earliestScan.isBaseline) {
      // First, unmark all current baselines
      if (currentBaselines.length > 0) {
        await db
          .update(dexaScans)
          .set({ isBaseline: false })
          .where(and(
            eq(dexaScans.userId, userId),
            eq(dexaScans.isBaseline, true)
          ));
      }

      // Then mark the earliest scan as baseline
      await db
        .update(dexaScans)
        .set({ isBaseline: true })
        .where(eq(dexaScans.id, earliestScan.id));
      
      console.log(`Auto-marked earliest scan (${earliestScan.scanDate}) as baseline for user ${userId}`);
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
        const nameParts = scanName.split(/[,\s]+/).filter(part => part.trim());
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

      if (baselineScan && latestScan) {
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
        totalScore: scoring.totalScore,
        fatLossScore: scoring.fatLossScore,
        muscleGainScore: scoring.muscleGainScore,
        bodyFatChange,
        leanMassChange,
        progressPercent,
        displayName,
        latestScan,
      });
    }

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

    const baselineScan = await this.getBaselineScan(userId);
    const allScans = await this.getUserScans(userId);
    
    // Require exactly 1 baseline scan and at least 1 additional scan
    const nonBaselineScans = allScans.filter(scan => !scan.isBaseline);
    
    if (!baselineScan) {
      console.log(`No baseline scan found for user ${userId}`);
      return;
    }

    if (nonBaselineScans.length === 0) {
      console.log(`User ${userId} needs at least 2 scans (1 baseline + 1 progress) to calculate score`);
      // Don't create scoring record yet - user needs more scans
      return;
    }

    // Get the latest non-baseline scan for comparison
    const latestScan = nonBaselineScans[0]; // Already sorted by desc date

    console.log(`Calculating scores for user ${userId}:`);
    console.log(`Baseline: BF=${baselineScan.bodyFatPercent}%, LM=${baselineScan.leanMass}lbs`);
    console.log(`Latest: BF=${latestScan.bodyFatPercent}%, LM=${latestScan.leanMass}lbs`);

    // Calculate percentage changes from baseline
    const bodyFatPercentChange = ((latestScan.bodyFatPercent - baselineScan.bodyFatPercent) / baselineScan.bodyFatPercent) * 100;
    const leanMassPercentChange = ((latestScan.leanMass - baselineScan.leanMass) / baselineScan.leanMass) * 100;

    console.log(`Body fat % change: ${bodyFatPercentChange.toFixed(2)}%`);
    console.log(`Lean mass % change: ${leanMassPercentChange.toFixed(2)}%`);

    // Calculate scores based on percentage improvements
    const fatLossScore = this.calculateFatLossScoreFromPercent(bodyFatPercentChange, user.gender || "male");
    const muscleGainScore = this.calculateMuscleGainScoreFromPercent(leanMassPercentChange, user.gender || "male");

    console.log(`Calculated scores: FLS=${fatLossScore.toFixed(2)}, MGS=${muscleGainScore.toFixed(2)}`);

    // Store scores
    await this.upsertScoringData({
      userId,
      fatLossScore,
      muscleGainScore,
      totalScore: fatLossScore + muscleGainScore,
      fatLossRaw: fatLossScore,
      muscleGainRaw: muscleGainScore,
    });
  }

  private calculateFatLossScoreFromPercent(bodyFatPercentChange: number, gender: string): number {
    // Negative change means fat loss (good), positive means fat gain (bad)
    if (bodyFatPercentChange >= 0) return 0; // No fat loss
    
    // Convert to positive for scoring (e.g., -5% becomes 5% fat loss)
    const fatLossPercent = Math.abs(bodyFatPercentChange);
    
    // Base score: 10 points per 1% body fat lost
    const baseScore = fatLossPercent * 10;
    
    // Maximum score cap at 50 points for fat loss component
    return Math.min(50, baseScore);
  }

  private calculateMuscleGainScoreFromPercent(leanMassPercentChange: number, gender: string): number {
    // Positive change means muscle gain (good)
    if (leanMassPercentChange <= 0) return 0; // No muscle gain
    
    // Base score: 20 points per 1% lean mass gained
    const baseScore = leanMassPercentChange * 20;
    
    // Gender multiplier: women get bonus for muscle building difficulty
    const genderMultiplier = gender === "female" ? 1.5 : 1.0;
    
    // Maximum score cap at 50 points for muscle gain component
    return Math.min(50, baseScore * genderMultiplier);
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
}

export const storage = new DatabaseStorage();
