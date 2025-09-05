#!/usr/bin/env tsx
/**
 * Test Competition Date Validation
 * Verify the scan classification logic works correctly
 */

import { classifyScanDate, getCompetitionStatus } from '../shared/competition-config.js';

console.log('🧪 Testing Competition Date Validation\n');

// Test dates
const testDates = [
  new Date('2024-05-01'), // 3 months before start (historical)
  new Date('2025-07-15'), // 3 weeks before start (pre-challenge warning)
  new Date('2025-08-04'), // Competition start
  new Date('2025-09-15'), // Mid-challenge
  new Date('2025-11-26'), // Competition end
  new Date('2025-12-15'), // 3 weeks after end (post-challenge)
  new Date('2026-03-01'), // Way after end (historical)
];

console.log('📅 Testing scan date classifications:');
testDates.forEach(date => {
  const classification = classifyScanDate(date);
  console.log(`\n${date.toLocaleDateString()}:`);
  console.log(`  Category: ${classification.category}`);
  console.log(`  Competition Eligible: ${classification.isCompetitionEligible}`);
  if (classification.warningType) {
    console.log(`  Warning: ${classification.warningType}`);
  }
  if (classification.message) {
    console.log(`  Message: ${classification.message}`);
  }
});

console.log('\n📊 Competition Status:');
const status = getCompetitionStatus();
console.log(`Status: ${status.status}`);
console.log(`Message: ${status.message}`);
if (status.daysElapsed !== undefined) {
  console.log(`Days Elapsed: ${status.daysElapsed}`);
}
if (status.daysRemaining !== undefined) {
  console.log(`Days Remaining: ${status.daysRemaining}`);
}

console.log('\n✅ Competition validation test completed!');