#!/usr/bin/env tsx
/**
 * Classify Existing Scans
 * Update existing scans with proper competition classification
 */

import { execSync } from 'child_process';
import { classifyScanDate } from '../shared/competition-config.js';

console.log('📊 Classifying existing DEXA scans...\n');

// Get all existing scans using sqlite3
const scanQuery = `SELECT id, scan_date, is_competition_eligible, scan_category FROM dexa_scans ORDER BY scan_date`;
const scanResult = execSync(`sqlite3 ./data/fitness_challenge.db "${scanQuery}"`, { encoding: 'utf8' });

if (!scanResult.trim()) {
  console.log('No existing scans found.');
  process.exit(0);
}

const scanLines = scanResult.trim().split('\n');
console.log(`Found ${scanLines.length} existing scans to classify:\n`);

let updated = 0;
let skipped = 0;

for (const line of scanLines) {
  const [id, scanDateMs, isEligible, category] = line.split('|');
  const scanDate = new Date(parseInt(scanDateMs));
  const classification = classifyScanDate(scanDate);
  
  console.log(`Scan ${id.substring(0, 8)}...`);
  console.log(`  Date: ${scanDate.toLocaleDateString()}`);
  console.log(`  Current: eligible=${isEligible}, category="${category}"`);
  console.log(`  Classified: eligible=${classification.isCompetitionEligible ? 1 : 0}, category="${classification.category}"`);
  
  // Update if classification has changed
  const newEligible = classification.isCompetitionEligible ? 1 : 0;
  if (parseInt(isEligible) !== newEligible || category !== classification.category) {
    
    const updateQuery = `UPDATE dexa_scans SET is_competition_eligible = ${newEligible}, scan_category = '${classification.category}', updated_at = ${Date.now()} WHERE id = '${id}'`;
    
    try {
      execSync(`sqlite3 ./data/fitness_challenge.db "${updateQuery}"`);
      console.log(`  ✅ Updated classification`);
      updated++;
    } catch (error) {
      console.log(`  ❌ Failed to update: ${error.message}`);
    }
  } else {
    console.log(`  ⏭️  No change needed`);
    skipped++;
  }
  
  if (classification.message) {
    console.log(`  ⚠️  Warning: ${classification.message}`);
  }
  
  console.log('');
}

console.log(`\n📊 Classification Summary:`);
console.log(`  Updated: ${updated} scans`);
console.log(`  Skipped: ${skipped} scans`);
console.log(`\n✅ Existing scan classification completed!`);