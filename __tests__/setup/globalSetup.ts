// Global setup for Jest tests - runs once before all tests
import fs from 'fs';
import path from 'path';

export default async function globalSetup() {
  // Ensure test database directory exists
  const testDbDir = path.join(process.cwd(), '__tests__', 'data');
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }
  
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = path.join(testDbDir, 'test_fitness_challenge.db');
  process.env.SESSION_SECRET = 'test-session-secret-for-testing-only';
  process.env.ADMIN_USERNAMES = 'TestAdmin,Jaron';
  
  console.log('Global test setup complete');
}