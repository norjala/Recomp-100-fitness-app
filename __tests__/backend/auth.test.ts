// Authentication security tests - protecting user accounts and admin access
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { hashPassword, comparePasswords } from '../../server/auth.js';

describe('Authentication System - Security Critical', () => {

  describe('Password Hashing', () => {
    test('should hash passwords securely', async () => {
      const password = 'testPassword123!';
      const hashedPassword = await hashPassword(password);

      // Should not store password in plaintext
      expect(hashedPassword).not.toBe(password);
      
      // Should include salt (format: hash.salt)
      expect(hashedPassword).toMatch(/^[a-f0-9]+\.[a-f0-9]+$/);
      
      // Should be consistent length (128 char hash + 32 char salt + 1 dot = 161)
      expect(hashedPassword.length).toBe(161);
    });

    test('should generate different hashes for same password', async () => {
      const password = 'samePassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      // Each hash should be unique due to random salt
      expect(hash1).not.toBe(hash2);
    });

    test('should handle various password types', async () => {
      const passwords = [
        'short',
        'verylongpasswordwithlotsofcharacters123456789',
        'password with spaces',
        'pássword_wïth_spéciâl_chärs_123!@#$%^&*()',
        '12345678',
        'MixedCasePassword123!'
      ];

      for (const password of passwords) {
        const hashedPassword = await hashPassword(password);
        expect(hashedPassword).toBeDefined();
        expect(hashedPassword.length).toBe(161);
      }
    });
  });

  describe('Password Verification', () => {
    test('should verify correct passwords', async () => {
      const password = 'correctPassword123!';
      const hashedPassword = await hashPassword(password);

      const isValid = await comparePasswords(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect passwords', async () => {
      const correctPassword = 'correctPassword123!';
      const wrongPassword = 'wrongPassword123!';
      const hashedPassword = await hashPassword(correctPassword);

      const isValid = await comparePasswords(wrongPassword, hashedPassword);
      expect(isValid).toBe(false);
    });

    test('should reject passwords with slight variations', async () => {
      const password = 'Password123!';
      const hashedPassword = await hashPassword(password);

      const variations = [
        'password123!', // lowercase
        'Password123', // missing special char
        'Password123!!', // extra char
        'Password 123!', // added space
        'Password1234!', // extra digit
        'Password12!', // missing digit
      ];

      for (const variation of variations) {
        const isValid = await comparePasswords(variation, hashedPassword);
        expect(isValid).toBe(false);
      }
    });

    test('should handle empty and null passwords safely', async () => {
      const password = 'validPassword123!';
      const hashedPassword = await hashPassword(password);

      // Empty password
      const emptyValid = await comparePasswords('', hashedPassword);
      expect(emptyValid).toBe(false);

      // Should not crash on malformed hash
      await expect(comparePasswords(password, 'malformed.hash')).resolves.toBe(false);
      await expect(comparePasswords(password, 'incomplete')).rejects.toThrow();
    });
  });

  describe('Security Properties', () => {
    test('should be resistant to timing attacks', async () => {
      const password = 'testPassword123!';
      const hashedPassword = await hashPassword(password);

      // Measure verification time for correct password
      const correctStart = Date.now();
      await comparePasswords(password, hashedPassword);
      const correctTime = Date.now() - correctStart;

      // Measure verification time for incorrect password  
      const incorrectStart = Date.now();
      await comparePasswords('wrongPassword', hashedPassword);
      const incorrectTime = Date.now() - incorrectStart;

      // Times should be similar (within reasonable variance)
      // This is a basic test - timing attacks are complex to test properly
      const timeDifference = Math.abs(correctTime - incorrectTime);
      expect(timeDifference).toBeLessThan(50); // 50ms threshold
    });

    test('should handle concurrent hash operations', async () => {
      const password = 'concurrentTest123!';
      
      // Create multiple hash operations simultaneously
      const hashPromises = Array(10).fill(null).map(() => hashPassword(password));
      const hashes = await Promise.all(hashPromises);

      // All should complete successfully
      expect(hashes).toHaveLength(10);
      
      // All should be unique
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(10);

      // All should verify correctly
      const verifyPromises = hashes.map(hash => comparePasswords(password, hash));
      const verifications = await Promise.all(verifyPromises);
      expect(verifications.every(result => result === true)).toBe(true);
    });
  });

  describe('Admin Access Control', () => {
    test('should respect ADMIN_USERNAMES environment variable', () => {
      // Mock the admin check logic (simplified version of requireAdmin)
      function checkAdminAccess(username: string): boolean {
        const adminUsernames = (process.env.ADMIN_USERNAMES || "Jaron").split(',').map(u => u.trim());
        return adminUsernames.includes(username);
      }

      // Test default admin (from globalSetup)
      expect(checkAdminAccess('Jaron')).toBe(true);
      expect(checkAdminAccess('TestAdmin')).toBe(true);
      
      // Test non-admin users
      expect(checkAdminAccess('regularUser')).toBe(false);
      expect(checkAdminAccess('hacker')).toBe(false);
      expect(checkAdminAccess('')).toBe(false);
    });

    test('should handle multiple admin usernames', () => {
      // Temporarily override environment
      const originalAdmins = process.env.ADMIN_USERNAMES;
      process.env.ADMIN_USERNAMES = 'Admin1,Admin2,Admin3';

      function checkAdminAccess(username: string): boolean {
        const adminUsernames = (process.env.ADMIN_USERNAMES || "Jaron").split(',').map(u => u.trim());
        return adminUsernames.includes(username);
      }

      expect(checkAdminAccess('Admin1')).toBe(true);
      expect(checkAdminAccess('Admin2')).toBe(true);
      expect(checkAdminAccess('Admin3')).toBe(true);
      expect(checkAdminAccess('Admin4')).toBe(false);

      // Restore original
      process.env.ADMIN_USERNAMES = originalAdmins;
    });

    test('should handle admin usernames with whitespace', () => {
      const originalAdmins = process.env.ADMIN_USERNAMES;
      process.env.ADMIN_USERNAMES = ' Admin1 , Admin2, Admin3 ';

      function checkAdminAccess(username: string): boolean {
        const adminUsernames = (process.env.ADMIN_USERNAMES || "Jaron").split(',').map(u => u.trim());
        return adminUsernames.includes(username);
      }

      expect(checkAdminAccess('Admin1')).toBe(true);
      expect(checkAdminAccess('Admin2')).toBe(true);
      expect(checkAdminAccess(' Admin1 ')).toBe(false); // Exact match after trim

      process.env.ADMIN_USERNAMES = originalAdmins;
    });
  });

  describe('Security Edge Cases', () => {
    test('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000); // 1000 character password
      const hashedPassword = await hashPassword(longPassword);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword.length).toBe(161); // Hash length should be consistent
      
      const isValid = await comparePasswords(longPassword, hashedPassword);
      expect(isValid).toBe(true);
    });

    test('should handle unicode and special characters', async () => {
      const unicodePassword = '🔒🚀密码测试🎯💻';
      const hashedPassword = await hashPassword(unicodePassword);
      
      expect(hashedPassword).toBeDefined();
      
      const isValid = await comparePasswords(unicodePassword, hashedPassword);
      expect(isValid).toBe(true);
    });

    test('should reject malformed hash attempts', async () => {
      const password = 'testPassword123!';
      
      const malformedHashes = [
        'justhash', // no salt
        'hash.', // empty salt
        '.salt', // empty hash
        '', // empty string
        'hash.salt.extra', // too many parts
      ];

      for (const malformedHash of malformedHashes) {
        await expect(comparePasswords(password, malformedHash)).rejects.toThrow();
      }
    });
  });

  describe('Performance and Reliability', () => {
    test('should complete hashing operations within reasonable time', async () => {
      const password = 'performanceTest123!';
      
      const start = Date.now();
      await hashPassword(password);
      const duration = Date.now() - start;
      
      // Hashing should complete within 2 seconds (scrypt is intentionally slow)
      expect(duration).toBeLessThan(2000);
    });

    test('should handle multiple simultaneous authentication attempts', async () => {
      const password = 'loadTest123!';
      const hashedPassword = await hashPassword(password);
      
      // Simulate 20 concurrent login attempts
      const verifyPromises = Array(20).fill(null).map(() => 
        comparePasswords(password, hashedPassword)
      );
      
      const results = await Promise.all(verifyPromises);
      
      // All should succeed
      expect(results.every(result => result === true)).toBe(true);
    });
  });
});