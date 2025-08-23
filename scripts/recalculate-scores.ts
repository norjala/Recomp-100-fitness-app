#!/usr/bin/env tsx
/**
 * Recalculate Scores Script
 * Manually triggers score recalculation to fix existing data after scoring changes
 */

import { storage } from '../server/storage.js';

async function recalculateScores(): Promise<void> {
  console.log('🧮 Starting score recalculation...');
  console.log('📊 Using research-based scoring system with normalization');
  console.log('   • Fat Loss: ln(start_bf / end_bf) × 100 × leanness_multiplier');
  console.log('   • Muscle Gain: lean_mass_change% × 100 × 17 × gender_multiplier');
  console.log('   • Each component normalized to 1-100 scale');
  console.log('   • Total: Fat Loss + Muscle Gain (max 200)\n');

  try {
    await storage.recalculateAllScores();
    console.log('\n🎉 Score recalculation completed successfully!');
    console.log('💡 Check the leaderboard to see corrected scores');
  } catch (error) {
    console.error('❌ Score recalculation failed:', error);
    process.exit(1);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  recalculateScores().catch(error => {
    console.error('💥 Script execution failed:', error);
    process.exit(1);
  });
}

export { recalculateScores };