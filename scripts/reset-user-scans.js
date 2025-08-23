import { db } from '../server/db.ts';
import { dexaScans, scoringData } from '../shared/schema.ts';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Define realistic "after" scan improvements for each user
const userImprovements = {
  'jaron': { bodyFatDelta: -2.8, leanMassDelta: 5.0 },      // 16.0% -> 13.2%, 155->160 lbs
  'ben': { bodyFatDelta: 1.0, leanMassDelta: 5.0 },        // 8.0% -> 9.0%, 135->140 lbs (harder to lose when already lean)
  'danny': { bodyFatDelta: -3.8, leanMassDelta: 5.0 },     // 22.0% -> 18.2%, 180->185 lbs
  'joe': { bodyFatDelta: -1.5, leanMassDelta: 5.0 },       // 12.0% -> 10.5%, 145->150 lbs
  'olarn': { bodyFatDelta: -5.2, leanMassDelta: 2.0 },     // 28.0% -> 22.8%, 140->142 lbs
  'takeshi': { bodyFatDelta: -3.5, leanMassDelta: 5.0 },   // 18.0% -> 14.5%, 160->165 lbs
  'testuser': { bodyFatDelta: 1.1, leanMassDelta: 22.8 }   // 16.9% -> 18.0%, 123.2->146 lbs (different trajectory)
};

async function resetUserScans() {
  console.log('Starting to reset user scans to exactly 2 per user...');
  
  try {
    // Get all users with their current scans
    const users = await db.query.users.findMany({
      with: {
        dexaScans: {
          orderBy: (scans, { asc }) => [asc(scans.scanDate)]
        }
      }
    });

    for (const user of users) {
      if (user.dexaScans.length === 0) continue;
      
      console.log(`\nProcessing user: ${user.username} (${user.dexaScans.length} current scans)`);
      
      // Find baseline scan (or use earliest scan)
      const baselineScan = user.dexaScans.find(scan => scan.isBaseline) || user.dexaScans[0];
      
      // Delete all existing scans for this user
      await db.delete(dexaScans).where(eq(dexaScans.userId, user.id));
      console.log(`  Deleted all existing scans for ${user.username}`);
      
      // Create new baseline scan (keeping original baseline data)
      const newBaselineScan = {
        id: uuidv4(),
        userId: user.id,
        scanDate: new Date('2025-08-04'), // Challenge start date
        bodyFatPercent: baselineScan.bodyFatPercent,
        leanMass: baselineScan.leanMass,
        totalWeight: baselineScan.totalWeight || baselineScan.leanMass + (baselineScan.leanMass * baselineScan.bodyFatPercent / (100 - baselineScan.bodyFatPercent)),
        fatMass: baselineScan.fatMass || (baselineScan.leanMass * baselineScan.bodyFatPercent / (100 - baselineScan.bodyFatPercent)),
        isBaseline: true,
        scanName: 'Baseline DEXA Scan',
        notes: 'Challenge baseline measurement',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.insert(dexaScans).values(newBaselineScan);
      console.log(`  Created baseline scan: ${newBaselineScan.bodyFatPercent}% BF, ${newBaselineScan.leanMass} lbs LM`);
      
      // Create "after" scan with improvements
      const improvements = userImprovements[user.username];
      if (improvements) {
        const afterBodyFat = Math.max(3, baselineScan.bodyFatPercent + improvements.bodyFatDelta);
        const afterLeanMass = Math.max(50, baselineScan.leanMass + improvements.leanMassDelta);
        const afterFatMass = afterLeanMass * afterBodyFat / (100 - afterBodyFat);
        const afterTotalWeight = afterLeanMass + afterFatMass;
        
        const afterScan = {
          id: uuidv4(),
          userId: user.id,
          scanDate: new Date('2025-08-23'), // Today's date (19 days into challenge)
          bodyFatPercent: Math.round(afterBodyFat * 10) / 10, // Round to 1 decimal
          leanMass: Math.round(afterLeanMass * 10) / 10,
          totalWeight: Math.round(afterTotalWeight * 10) / 10,
          fatMass: Math.round(afterFatMass * 10) / 10,
          isBaseline: false,
          scanName: 'Progress DEXA Scan',
          notes: '19 days into the challenge',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await db.insert(dexaScans).values(afterScan);
        console.log(`  Created after scan: ${afterScan.bodyFatPercent}% BF, ${afterScan.leanMass} lbs LM`);
        console.log(`  Changes: ${improvements.bodyFatDelta >= 0 ? '+' : ''}${improvements.bodyFatDelta}% BF, ${improvements.leanMassDelta >= 0 ? '+' : ''}${improvements.leanMassDelta} lbs LM`);
      }
      
      // Clear existing scoring data so it gets recalculated
      await db.delete(scoringData).where(eq(scoringData.userId, user.id));
      console.log(`  Cleared scoring data for recalculation`);
    }
    
    console.log('\n✅ Successfully reset all users to have exactly 2 DEXA scans each!');
    console.log('📊 Scoring data cleared - scores will be recalculated on next API call.');
    
  } catch (error) {
    console.error('❌ Error resetting user scans:', error);
    process.exit(1);
  }
}

// Run the script
resetUserScans().then(() => {
  console.log('\n🎉 Scan reset complete! Each user now has:');
  console.log('   1. Baseline scan (August 4, 2025 - challenge start)');
  console.log('   2. Progress scan (August 23, 2025 - current date)');
  process.exit(0);
}).catch(console.error);