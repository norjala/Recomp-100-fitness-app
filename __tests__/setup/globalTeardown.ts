// Global teardown for Jest tests - runs once after all tests
import fs from 'fs';
import path from 'path';

export default async function globalTeardown() {
  // Clean up test database
  const testDbPath = path.join(process.cwd(), '__tests__', 'data', 'test_fitness_challenge.db');
  
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
      console.log('Test database cleaned up');
    } catch (error) {
      console.warn('Could not clean up test database:', error);
    }
  }
  
  console.log('Global test teardown complete');
}