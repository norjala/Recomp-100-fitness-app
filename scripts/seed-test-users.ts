#!/usr/bin/env tsx
/**
 * Seed Test Users Script
 * Creates 6 test users with realistic DEXA scan progressions for user testing simulation
 */

import { hashPassword } from '../server/auth.js';
import { storage } from '../server/storage.js';
import type { InsertUser, InsertDexaScan } from '../shared/schema.js';

// Test user profiles with realistic body composition data
interface TestUserProfile {
  username: string;
  password: string;
  name: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  height: string;
  targetBodyFatPercent: number;
  targetLeanMass: number;
  scans: {
    scanDate: string;
    bodyFatPercent: number;
    leanMass: number;
    totalWeight: number;
    fatMass: number;
    rmr: number;
    scanName?: string;
    isBaseline?: boolean;
  }[];
}

const testUsers: TestUserProfile[] = [
  {
    username: 'joe',
    password: 'password123',
    name: 'Joe Smith',
    firstName: 'Joe',
    lastName: 'Smith',
    gender: 'male',
    height: '5\'10"',
    targetBodyFatPercent: 8,
    targetLeanMass: 155,
    scans: [
      {
        scanDate: '2025-08-05',
        bodyFatPercent: 12.0,
        leanMass: 145.0,
        totalWeight: 165.0,
        fatMass: 19.8,
        rmr: 1750,
        scanName: 'Baseline Scan',
        isBaseline: true
      },
      {
        scanDate: '2025-09-10',
        bodyFatPercent: 11.2,
        leanMass: 147.5,
        totalWeight: 166.5,
        fatMass: 18.6,
        rmr: 1780,
        scanName: '5-Week Progress'
      },
      {
        scanDate: '2025-10-15',
        bodyFatPercent: 10.5,
        leanMass: 150.0,
        totalWeight: 167.8,
        fatMass: 17.6,
        rmr: 1810,
        scanName: '10-Week Progress'
      }
    ]
  },
  {
    username: 'takeshi',
    password: 'password123',
    name: 'Takeshi Yamamoto',
    firstName: 'Takeshi',
    lastName: 'Yamamoto',
    gender: 'male',
    height: '5\'8"',
    targetBodyFatPercent: 12,
    targetLeanMass: 170,
    scans: [
      {
        scanDate: '2025-08-05',
        bodyFatPercent: 18.0,
        leanMass: 160.0,
        totalWeight: 195.0,
        fatMass: 35.1,
        rmr: 1950,
        scanName: 'Baseline Scan',
        isBaseline: true
      },
      {
        scanDate: '2025-09-12',
        bodyFatPercent: 16.8,
        leanMass: 162.5,
        totalWeight: 195.5,
        fatMass: 32.8,
        rmr: 1975,
        scanName: '5-Week Check-in'
      },
      {
        scanDate: '2025-10-20',
        bodyFatPercent: 14.5,
        leanMass: 165.0,
        totalWeight: 193.0,
        fatMass: 28.0,
        rmr: 2000,
        scanName: '11-Week Progress'
      }
    ]
  },
  {
    username: 'olarn',
    password: 'password123',
    name: 'Olarn Patel',
    firstName: 'Olarn',
    lastName: 'Patel',
    gender: 'male',
    height: '5\'6"',
    targetBodyFatPercent: 15,
    targetLeanMass: 150,
    scans: [
      {
        scanDate: '2025-08-05',
        bodyFatPercent: 28.0,
        leanMass: 140.0,
        totalWeight: 195.0,
        fatMass: 54.6,
        rmr: 1800,
        scanName: 'Baseline Scan',
        isBaseline: true
      },
      {
        scanDate: '2025-09-08',
        bodyFatPercent: 25.5,
        leanMass: 141.0,
        totalWeight: 189.5,
        fatMass: 48.3,
        rmr: 1820,
        scanName: '4-Week Progress'
      },
      {
        scanDate: '2025-10-12',
        bodyFatPercent: 22.8,
        leanMass: 142.0,
        totalWeight: 184.0,
        fatMass: 41.9,
        rmr: 1840,
        scanName: '9-Week Progress'
      }
    ]
  },
  {
    username: 'danny',
    password: 'password123',
    name: 'Danny Rodriguez',
    firstName: 'Danny',
    lastName: 'Rodriguez',
    gender: 'male',
    height: '6\'1"',
    targetBodyFatPercent: 15,
    targetLeanMass: 190,
    scans: [
      {
        scanDate: '2025-08-05',
        bodyFatPercent: 22.0,
        leanMass: 180.0,
        totalWeight: 230.0,
        fatMass: 50.6,
        rmr: 2100,
        scanName: 'Baseline Scan',
        isBaseline: true
      },
      {
        scanDate: '2025-09-15',
        bodyFatPercent: 20.5,
        leanMass: 183.0,
        totalWeight: 230.5,
        fatMass: 47.3,
        rmr: 2130,
        scanName: '6-Week Progress'
      },
      {
        scanDate: '2025-10-25',
        bodyFatPercent: 18.2,
        leanMass: 185.0,
        totalWeight: 226.0,
        fatMass: 41.1,
        rmr: 2160,
        scanName: '12-Week Progress'
      }
    ]
  },
  {
    username: 'jaron',
    password: 'password123',
    name: 'Jaron Parnala',
    firstName: 'Jaron',
    lastName: 'Parnala',
    gender: 'male',
    height: '5\'11"',
    targetBodyFatPercent: 10,
    targetLeanMass: 165,
    scans: [
      {
        scanDate: '2025-08-05',
        bodyFatPercent: 16.0,
        leanMass: 155.0,
        totalWeight: 185.0,
        fatMass: 29.6,
        rmr: 1850,
        scanName: 'Baseline Scan',
        isBaseline: true
      },
      {
        scanDate: '2025-09-05',
        bodyFatPercent: 14.8,
        leanMass: 157.5,
        totalWeight: 185.0,
        fatMass: 27.4,
        rmr: 1875,
        scanName: '4-Week Progress'
      },
      {
        scanDate: '2025-10-10',
        bodyFatPercent: 13.2,
        leanMass: 160.0,
        totalWeight: 184.5,
        fatMass: 24.4,
        rmr: 1900,
        scanName: '9-Week Progress'
      }
    ]
  },
  {
    username: 'ben',
    password: 'password123',
    name: 'Ben Thompson',
    firstName: 'Ben',
    lastName: 'Thompson',
    gender: 'male',
    height: '5\'7"',
    targetBodyFatPercent: 6,
    targetLeanMass: 145,
    scans: [
      {
        scanDate: '2025-08-05',
        bodyFatPercent: 8.0,
        leanMass: 135.0,
        totalWeight: 147.0,
        fatMass: 11.8,
        rmr: 1650,
        scanName: 'Baseline Scan',
        isBaseline: true
      },
      {
        scanDate: '2025-09-18',
        bodyFatPercent: 8.5,
        leanMass: 137.5,
        totalWeight: 150.5,
        fatMass: 12.8,
        rmr: 1675,
        scanName: '6-Week Progress'
      },
      {
        scanDate: '2025-10-28',
        bodyFatPercent: 9.0,
        leanMass: 140.0,
        totalWeight: 154.0,
        fatMass: 13.9,
        rmr: 1700,
        scanName: '12-Week Progress'
      }
    ]
  }
];

async function createTestUser(profile: TestUserProfile): Promise<void> {
  console.log(`Creating user: ${profile.name} (${profile.username})`);
  
  try {
    // Check if user already exists
    const existingUser = await storage.getUserByUsername(profile.username);
    if (existingUser) {
      console.log(`  ⚠️  User ${profile.username} already exists, skipping...`);
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(profile.password);

    // Create user account
    const user = await storage.createUser({
      username: profile.username,
      password: hashedPassword
    });

    // Update user profile with competition data
    await storage.updateUser(user.id, {
      name: profile.name,
      firstName: profile.firstName,
      lastName: profile.lastName,
      gender: profile.gender,
      height: profile.height,
      startingWeight: profile.scans[0].totalWeight,
      targetBodyFatPercent: profile.targetBodyFatPercent,
      targetLeanMass: profile.targetLeanMass
    });

    console.log(`  ✅ Created user account for ${profile.name}`);

    // Create DEXA scans
    for (const scanData of profile.scans) {
      const scan: InsertDexaScan = {
        userId: user.id,
        scanDate: new Date(scanData.scanDate),
        bodyFatPercent: scanData.bodyFatPercent,
        leanMass: scanData.leanMass,
        totalWeight: scanData.totalWeight,
        fatMass: scanData.fatMass,
        rmr: scanData.rmr,
        scanName: scanData.scanName,
        isBaseline: scanData.isBaseline || false
      };

      await storage.createDexaScan(scan);
      console.log(`  📊 Created scan: ${scanData.scanName} (${scanData.scanDate})`);
    }

    console.log(`  🎯 User ${profile.name} setup complete with ${profile.scans.length} scans`);

  } catch (error) {
    console.error(`❌ Failed to create user ${profile.name}:`, error);
    throw error;
  }
}

async function seedTestUsers(): Promise<void> {
  console.log('🌱 Starting test user seeding process...');
  console.log(`📋 Creating ${testUsers.length} test users with DEXA scan progressions\n`);

  try {
    // Create all test users
    for (const profile of testUsers) {
      await createTestUser(profile);
      console.log(); // Add spacing between users
    }

    // Recalculate all scores to populate leaderboard
    console.log('🧮 Recalculating competition scores...');
    await storage.recalculateAllScores();
    console.log('✅ Scores recalculated successfully');

    console.log('\n🎉 Test user seeding completed successfully!');
    console.log('\n📊 Created test users:');
    testUsers.forEach(user => {
      console.log(`  • ${user.name} (${user.username}) - ${user.scans.length} scans`);
    });

    console.log('\n🔑 Login credentials for all users:');
    console.log('   Password: password123');
    console.log('\n🏆 Visit the leaderboard to see competitive standings');
    console.log('📈 Check individual profiles to view DEXA scan progressions');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

async function cleanupTestUsers(): Promise<void> {
  console.log('🧹 Cleaning up existing test users...');
  
  for (const profile of testUsers) {
    try {
      const existingUser = await storage.getUserByUsername(profile.username);
      if (existingUser) {
        await storage.deleteUser(existingUser.id);
        console.log(`  🗑️  Deleted user: ${profile.name}`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to delete user ${profile.name}:`, error);
    }
  }
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes('--cleanup') || args.includes('-c')) {
    await cleanupTestUsers();
    console.log('✅ Cleanup completed');
    return;
  }

  if (args.includes('--reset') || args.includes('-r')) {
    await cleanupTestUsers();
    console.log('🔄 Reset: Cleanup completed, now seeding...\n');
  }

  await seedTestUsers();
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Script execution failed:', error);
    process.exit(1);
  });
}

export { seedTestUsers, cleanupTestUsers, testUsers };