/**
 * Competition Configuration Constants
 * Centralized configuration for the 100-day body recomposition challenge
 */

// Competition dates
export const COMPETITION_START_DATE = new Date('2025-08-04T00:00:00.000Z');
export const COMPETITION_END_DATE = new Date('2025-11-26T23:59:59.999Z');

// Buffer periods for scan classification (in days)
export const PRE_CHALLENGE_BUFFER_DAYS = 30; // Allow scans 30 days before start
export const POST_CHALLENGE_BUFFER_DAYS = 14; // Allow scans 14 days after end

// Scan classification thresholds (in days)
export const HISTORICAL_THRESHOLD_DAYS = 90; // Scans >90 days before start are historical
export const WARNING_THRESHOLD_DAYS = 60; // Show warnings for scans >60 days outside window

// Competition window boundaries
export const COMPETITION_WINDOW_START = new Date(
  COMPETITION_START_DATE.getTime() - (PRE_CHALLENGE_BUFFER_DAYS * 24 * 60 * 60 * 1000)
);
export const COMPETITION_WINDOW_END = new Date(
  COMPETITION_END_DATE.getTime() + (POST_CHALLENGE_BUFFER_DAYS * 24 * 60 * 60 * 1000)
);

export const HISTORICAL_CUTOFF_DATE = new Date(
  COMPETITION_START_DATE.getTime() - (HISTORICAL_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)
);

export const WARNING_CUTOFF_DATE = new Date(
  COMPETITION_START_DATE.getTime() - (WARNING_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)
);

/**
 * Classify a scan date into competition categories
 */
export function classifyScanDate(scanDate: Date): {
  category: 'historical' | 'competition' | 'post-challenge';
  isCompetitionEligible: boolean;
  warningType?: 'historical' | 'pre-challenge' | 'post-challenge';
  message?: string;
} {
  const now = new Date();
  
  // Historical: More than 90 days before challenge start
  if (scanDate < HISTORICAL_CUTOFF_DATE) {
    return {
      category: 'historical',
      isCompetitionEligible: false,
      warningType: 'historical',
      message: `This scan is from ${scanDate.toLocaleDateString()} - more than 90 days before the challenge start. It will be saved for historical tracking but won't affect your competition score.`
    };
  }
  
  // Post-challenge: More than 14 days after challenge end
  if (scanDate > COMPETITION_WINDOW_END) {
    return {
      category: 'post-challenge',
      isCompetitionEligible: false,
      warningType: 'post-challenge',
      message: `This scan is from ${scanDate.toLocaleDateString()} - after the challenge ended. It will be saved for historical tracking but won't affect your competition score.`
    };
  }
  
  // Competition eligible: Within the competition window
  if (scanDate >= COMPETITION_WINDOW_START && scanDate <= COMPETITION_WINDOW_END) {
    return {
      category: 'competition',
      isCompetitionEligible: true
    };
  }
  
  // Warning zone: Outside competition window but not historical
  if (scanDate < COMPETITION_WINDOW_START) {
    return {
      category: 'competition', // Still eligible but with warning
      isCompetitionEligible: true,
      warningType: 'pre-challenge',
      message: `This scan is from ${scanDate.toLocaleDateString()} - before the official challenge window. It will be included in competition scoring but may not represent your challenge baseline.`
    };
  }
  
  // Default to competition
  return {
    category: 'competition',
    isCompetitionEligible: true
  };
}

/**
 * Check if a scan date should trigger a warning
 */
export function shouldShowDateWarning(scanDate: Date): boolean {
  return scanDate < WARNING_CUTOFF_DATE || scanDate > COMPETITION_WINDOW_END;
}

/**
 * Get human-readable competition status
 */
export function getCompetitionStatus(): {
  status: 'not-started' | 'active' | 'ended';
  daysRemaining?: number;
  daysElapsed?: number;
  message: string;
} {
  const now = new Date();
  
  if (now < COMPETITION_START_DATE) {
    const daysUntilStart = Math.ceil((COMPETITION_START_DATE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'not-started',
      message: `Challenge starts in ${daysUntilStart} days`
    };
  }
  
  if (now > COMPETITION_END_DATE) {
    return {
      status: 'ended',
      message: 'Challenge has ended'
    };
  }
  
  const daysElapsed = Math.floor((now.getTime() - COMPETITION_START_DATE.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.ceil((COMPETITION_END_DATE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    status: 'active',
    daysElapsed,
    daysRemaining,
    message: `${daysRemaining} days remaining`
  };
}