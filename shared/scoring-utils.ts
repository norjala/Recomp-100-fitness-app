// Shared scoring calculation utilities for client-side score projections
// Based on the competition scoring system used in the backend

export type Gender = 'male' | 'female' | string;

export interface ScanData {
  bodyFatPercent: number;
  leanMass: number;
  totalWeight: number;
  fatMass?: number;
}

export interface ScoreBreakdown {
  fatLossScore: number;
  muscleGainScore: number;
  totalScore: number;
  fatLossPercent: number;
  muscleGainPercent: number;
  rawFatLossScore?: number;
  rawMuscleGainScore?: number;
}

export interface ScoringRange {
  minFatLoss: number;
  maxFatLoss: number;
  minMuscleGain: number;
  maxMuscleGain: number;
}

export interface NormalizedScoreBreakdown extends ScoreBreakdown {
  normalizedFatLossScore: number;
  normalizedMuscleGainScore: number;
  normalizedTotalScore: number;
}

/**
 * Get leanness multiplier based on baseline body fat percentage
 * Rewards contestants who start at lower body fat percentages
 */
export function getLeanessMultiplier(gender: Gender, baselineBodyFat: number): number {
  if (gender.toLowerCase() === 'male') {
    if (baselineBodyFat < 15) return 1.4;
    if (baselineBodyFat < 18) return 1.3;
    if (baselineBodyFat < 21) return 1.2;
    if (baselineBodyFat < 25) return 1.1;
    return 1.0;
  } else {
    // Female
    if (baselineBodyFat < 20) return 1.4;
    if (baselineBodyFat < 23) return 1.3;
    if (baselineBodyFat < 26) return 1.2;
    if (baselineBodyFat < 30) return 1.1;
    return 1.0;
  }
}

/**
 * Calculate Fat Loss Score using logarithmic formula
 * Formula: ln(BF%_start / BF%_end) × 100 × Leanness_Multiplier
 * No maximum cap (but typically maxes around 200 points)
 */
export function calculateFatLossScore(
  startBodyFat: number, 
  endBodyFat: number, 
  gender: Gender, 
  baselineBodyFat: number
): number {
  // Only count fat loss (end < start), not gains
  if (endBodyFat >= startBodyFat) {
    return 0;
  }
  
  // Use logarithmic formula as per original requirements
  const leanessMultiplier = getLeanessMultiplier(gender, baselineBodyFat);
  const score = Math.log(startBodyFat / endBodyFat) * 100 * leanessMultiplier;
  
  return Math.max(0, score);
}

/**
 * Calculate Muscle Gain Score using calibrated formula
 * Formula: (Lean_Mass_%_Change) × 17 × Gender_Multiplier
 * Gender Multiplier: Men = 1.0, Women = 2.0
 * Calibrated factor of 17 for proper balance with fat loss scoring
 */
export function calculateMuscleGainScore(
  startLeanMass: number, 
  endLeanMass: number, 
  gender: Gender
): number {
  // Only count muscle gains (positive changes), not losses
  const leanMassChangePercent = ((endLeanMass - startLeanMass) / startLeanMass) * 100;
  if (leanMassChangePercent <= 0) {
    return 0;
  }
  
  // Apply gender multiplier as per original requirements
  const genderMultiplier = gender.toLowerCase() === 'female' ? 2.0 : 1.0;
  
  // Use calibrated formula: lean_mass_change% × 17 × gender_multiplier
  const score = leanMassChangePercent * 17 * genderMultiplier;
  
  return Math.max(0, score);
}

/**
 * Calculate percentage change between two values
 * Returns the percentage change from baseline to target
 */
export function calculatePercentageChange(baseline: number, target: number): number {
  if (baseline === 0) return 0;
  return ((target - baseline) / baseline) * 100;
}

/**
 * Normalize a raw score to 1-100 range using min-max normalization
 */
export function normalizeScore(rawScore: number, minScore: number, maxScore: number): number {
  if (maxScore === minScore) {
    return rawScore > 0 ? 100 : 0;
  }
  
  const normalized = ((rawScore - minScore) / (maxScore - minScore)) * 99 + 1;
  return Math.max(1, Math.min(100, normalized));
}

/**
 * Calculate normalized scores based on competition-wide score ranges
 */
export function calculateNormalizedScores(
  baselineScan: ScanData,
  latestScan: ScanData,
  gender: Gender,
  scoringRange: ScoringRange
): NormalizedScoreBreakdown {
  // Calculate raw scores
  const rawScores = calculateActualScores(baselineScan, latestScan, gender);
  
  // Normalize scores to 1-100 range
  const normalizedFatLossScore = normalizeScore(
    rawScores.fatLossScore,
    scoringRange.minFatLoss,
    scoringRange.maxFatLoss
  );
  
  const normalizedMuscleGainScore = normalizeScore(
    rawScores.muscleGainScore,
    scoringRange.minMuscleGain,
    scoringRange.maxMuscleGain
  );
  
  const normalizedTotalScore = normalizedFatLossScore + normalizedMuscleGainScore;
  
  return {
    ...rawScores,
    rawFatLossScore: rawScores.fatLossScore,
    rawMuscleGainScore: rawScores.muscleGainScore,
    normalizedFatLossScore,
    normalizedMuscleGainScore,
    normalizedTotalScore,
    fatLossScore: normalizedFatLossScore,
    muscleGainScore: normalizedMuscleGainScore,
    totalScore: normalizedTotalScore
  };
}

/**
 * Project scores based on current baseline scan and target goals
 * Optionally normalized using scoring ranges
 */
export function projectScores(
  baselineScan: ScanData,
  targetBodyFat: number,
  targetLeanMass: number,
  gender: Gender,
  scoringRange?: ScoringRange
): ScoreBreakdown {
  // Calculate percentage changes needed to reach targets
  const fatLossPercent = calculatePercentageChange(baselineScan.bodyFatPercent, targetBodyFat);
  const muscleGainPercent = calculatePercentageChange(baselineScan.leanMass, targetLeanMass);
  
  // Calculate projected scores using correct formulas
  const fatLossScore = calculateFatLossScore(
    baselineScan.bodyFatPercent, 
    targetBodyFat, 
    gender, 
    baselineScan.bodyFatPercent  // baseline is same as starting for projections
  );
  const muscleGainScore = calculateMuscleGainScore(
    baselineScan.leanMass, 
    targetLeanMass, 
    gender
  );
  const totalScore = fatLossScore + muscleGainScore;
  
  // Apply normalization if scoring ranges are provided
  if (scoringRange) {
    const normalizedFatLossScore = normalizeScore(
      fatLossScore,
      scoringRange.minFatLoss,
      scoringRange.maxFatLoss
    );
    const normalizedMuscleGainScore = normalizeScore(
      muscleGainScore,
      scoringRange.minMuscleGain,
      scoringRange.maxMuscleGain
    );
    const normalizedTotalScore = normalizedFatLossScore + normalizedMuscleGainScore;
    
    return {
      fatLossScore: normalizedFatLossScore,
      muscleGainScore: normalizedMuscleGainScore,
      totalScore: normalizedTotalScore,
      fatLossPercent,
      muscleGainPercent,
      rawFatLossScore: fatLossScore,
      rawMuscleGainScore: muscleGainScore
    };
  }
  
  return {
    fatLossScore,
    muscleGainScore,
    totalScore,
    fatLossPercent,
    muscleGainPercent,
    rawFatLossScore: fatLossScore,
    rawMuscleGainScore: muscleGainScore
  };
}

/**
 * Calculate actual scores based on baseline and latest scans
 */
export function calculateActualScores(
  baselineScan: ScanData,
  latestScan: ScanData,
  gender: Gender
): ScoreBreakdown {
  // Calculate percentage changes from baseline to latest scan
  const fatLossPercent = calculatePercentageChange(baselineScan.bodyFatPercent, latestScan.bodyFatPercent);
  const muscleGainPercent = calculatePercentageChange(baselineScan.leanMass, latestScan.leanMass);
  
  // Calculate actual scores using correct formulas
  const fatLossScore = calculateFatLossScore(
    baselineScan.bodyFatPercent, 
    latestScan.bodyFatPercent, 
    gender, 
    baselineScan.bodyFatPercent
  );
  const muscleGainScore = calculateMuscleGainScore(
    baselineScan.leanMass, 
    latestScan.leanMass, 
    gender
  );
  const totalScore = fatLossScore + muscleGainScore;
  
  return {
    fatLossScore,
    muscleGainScore,
    totalScore,
    fatLossPercent,
    muscleGainPercent,
    rawFatLossScore: fatLossScore,
    rawMuscleGainScore: muscleGainScore
  };
}

/**
 * Validate if target goals are realistic and achievable
 */
export function validateTargetGoals(
  baselineScan: ScanData,
  targetBodyFat: number,
  targetLeanMass: number
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  // Validate body fat percentage range
  if (targetBodyFat < 3 || targetBodyFat > 50) {
    warnings.push('Target body fat should be between 3% and 50%');
  }
  
  // Check for realistic body fat reduction
  const fatLossNeeded = baselineScan.bodyFatPercent - targetBodyFat;
  if (fatLossNeeded > 15) {
    warnings.push('Targeting more than 15% body fat reduction may be unrealistic in 100 days');
  }
  
  // Check for realistic muscle gain
  const muscleGainNeeded = targetLeanMass - baselineScan.leanMass;
  const muscleGainPercent = (muscleGainNeeded / baselineScan.leanMass) * 100;
  if (muscleGainPercent > 10) {
    warnings.push('Targeting more than 10% lean mass gain may be unrealistic in 100 days');
  }
  
  // Validate lean mass is positive
  if (targetLeanMass < 50) {
    warnings.push('Target lean mass should be at least 50 lbs');
  }
  
  return {
    isValid: warnings.length === 0,
    warnings
  };
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Calculate score ranges across all participants for normalization
 */
export function calculateScoringRanges(allScores: ScoreBreakdown[]): ScoringRange {
  if (allScores.length === 0) {
    return {
      minFatLoss: 0,
      maxFatLoss: 100,
      minMuscleGain: 0,
      maxMuscleGain: 100
    };
  }
  
  const fatLossScores = allScores.map(s => s.rawFatLossScore || s.fatLossScore);
  const muscleGainScores = allScores.map(s => s.rawMuscleGainScore || s.muscleGainScore);
  
  return {
    minFatLoss: Math.min(...fatLossScores, 0),
    maxFatLoss: Math.max(...fatLossScores, 1),
    minMuscleGain: Math.min(...muscleGainScores, 0),
    maxMuscleGain: Math.max(...muscleGainScores, 1)
  };
}

/**
 * Format score for display
 */
export function formatScore(score: number, decimals: number = 1): string {
  return score.toFixed(decimals);
}

/**
 * Format normalized score for display with raw score in parentheses
 */
export function formatNormalizedScore(normalizedScore: number, rawScore: number, decimals: number = 1): string {
  return `${normalizedScore.toFixed(decimals)} (${rawScore.toFixed(decimals)} raw)`;
}