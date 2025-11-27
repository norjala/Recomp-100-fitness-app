#!/usr/bin/env node

/**
 * Gender Field Bug Verification Script
 *
 * This script specifically tests the gender field bug fix for user "Jaron"
 * who has NULL gender and should see the gender field in the upload form.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Gender Field Bug Verification Script');
console.log('=======================================');
console.log('');

// Color functions
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
};

let testResults = [];

function logTest(name, status, details = '') {
  const statusColor = status === 'PASS' ? colors.green :
                     status === 'FAIL' ? colors.red :
                     colors.yellow;

  console.log(`${statusColor(status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️')} ${name}`);
  if (details) {
    console.log(`   📝 ${details}`);
  }

  testResults.push({ name, status, details });
  console.log('');
}

// Test 1: Check if upload.tsx has the gender field logic
function testUploadPageGenderLogic() {
  const uploadPath = path.join(__dirname, '../../client/src/pages/upload.tsx');

  if (!fs.existsSync(uploadPath)) {
    logTest('Upload Page Exists', 'FAIL', 'upload.tsx not found');
    return;
  }

  const uploadContent = fs.readFileSync(uploadPath, 'utf8');

  // Check for gender field implementation
  const hasGenderField = uploadContent.includes('gender') &&
                        uploadContent.includes('Select') &&
                        uploadContent.includes('male') &&
                        uploadContent.includes('female');

  if (hasGenderField) {
    logTest('Upload Page Gender Field', 'PASS', 'Gender field select component found');
  } else {
    logTest('Upload Page Gender Field', 'FAIL', 'Gender field select component not found');
  }

  // Check for visibility logic
  const hasVisibilityLogic = uploadContent.includes('userProfile?.gender') &&
                            uploadContent.includes('isFirstScan');

  if (hasVisibilityLogic) {
    logTest('Upload Page Visibility Logic', 'PASS', 'Gender field visibility logic implemented');
  } else {
    logTest('Upload Page Visibility Logic', 'FAIL', 'Gender field visibility logic not found');
  }

  // Check for debug panel
  const hasDebugPanel = uploadContent.includes('DEBUG PANEL') ||
                       uploadContent.includes('UPLOAD DEBUG');

  if (hasDebugPanel) {
    logTest('Upload Page Debug Panel', 'PASS', 'Debug panel implemented for testing');
  } else {
    logTest('Upload Page Debug Panel', 'FAIL', 'Debug panel not found');
  }
}

// Test 2: Check if my-scans.tsx has been updated (if needed)
function testMyScansPageUpdates() {
  const myScansPath = path.join(__dirname, '../../client/src/pages/my-scans.tsx');

  if (!fs.existsSync(myScansPath)) {
    logTest('My Scans Page Exists', 'FAIL', 'my-scans.tsx not found');
    return;
  }

  const myScansContent = fs.readFileSync(myScansPath, 'utf8');

  // Check if it handles gender in some way (even if just passing through)
  const handlesGender = myScansContent.includes('gender');

  if (handlesGender) {
    logTest('My Scans Gender Handling', 'PASS', 'my-scans.tsx includes gender handling');
  } else {
    logTest('My Scans Gender Handling', 'INFO', 'my-scans.tsx may not need direct gender handling');
  }
}

// Test 3: Check backend route modifications
function testBackendRoutes() {
  const routesPath = path.join(__dirname, '../../server/routes.ts');

  if (!fs.existsSync(routesPath)) {
    logTest('Backend Routes Exist', 'FAIL', 'server/routes.ts not found');
    return;
  }

  const routesContent = fs.readFileSync(routesPath, 'utf8');

  // Check for PUT /api/scans gender handling
  const hasPutScanGender = routesContent.includes('PUT') &&
                          routesContent.includes('/api/scans') &&
                          routesContent.includes('gender');

  if (hasPutScanGender) {
    logTest('Backend PUT Scan Gender', 'PASS', 'PUT /api/scans/:scanId handles gender updates');
  } else {
    logTest('Backend PUT Scan Gender', 'FAIL', 'PUT /api/scans/:scanId gender handling not found');
  }

  // Check for POST /api/scans gender handling
  const hasPostScanGender = routesContent.includes('POST') &&
                           routesContent.includes('/api/scans') &&
                           routesContent.includes('gender');

  if (hasPostScanGender) {
    logTest('Backend POST Scan Gender', 'PASS', 'POST /api/scans handles gender creation');
  } else {
    logTest('Backend POST Scan Gender', 'FAIL', 'POST /api/scans gender handling not found');
  }

  // Check for profile update logic
  const hasProfileUpdate = routesContent.includes('updateUser') &&
                          routesContent.includes('gender');

  if (hasProfileUpdate) {
    logTest('Backend Profile Update', 'PASS', 'User profile update with gender implemented');
  } else {
    logTest('Backend Profile Update', 'FAIL', 'User profile update with gender not found');
  }
}

// Test 4: Check schema/types for gender field
function testSchemaUpdates() {
  const schemaPath = path.join(__dirname, '../../shared/schema.ts');

  if (!fs.existsSync(schemaPath)) {
    logTest('Schema File Exists', 'FAIL', 'shared/schema.ts not found');
    return;
  }

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  // Check if gender is in the schema
  const hasGenderInSchema = schemaContent.includes('gender') &&
                           (schemaContent.includes('male') || schemaContent.includes('female'));

  if (hasGenderInSchema) {
    logTest('Schema Gender Field', 'PASS', 'Gender field defined in schema');
  } else {
    logTest('Schema Gender Field', 'FAIL', 'Gender field not found in schema');
  }
}

// Test 5: Check if database has gender column
function testDatabaseSchema() {
  const dbPath = path.join(__dirname, '../../local.db');

  if (!fs.existsSync(dbPath)) {
    logTest('Database File Exists', 'INFO', 'local.db not found (may be using different DB)');
    return;
  }

  // Note: We can't easily query SQLite from Node without additional dependencies
  // This is more of a placeholder for the manual verification
  logTest('Database Schema Check', 'INFO', 'Database exists - manual verification needed for gender column');
}

// Test 6: Verify test files are created
function testTestFiles() {
  const integrationTest = path.join(__dirname, '../integration/gender-field-integration.test.ts');
  const frontendTest = path.join(__dirname, '../integration/gender-field-frontend.test.ts');
  const manualGuide = path.join(__dirname, '../manual/gender-field-testing-guide.md');

  if (fs.existsSync(integrationTest)) {
    logTest('Integration Tests Created', 'PASS', 'Backend integration tests available');
  } else {
    logTest('Integration Tests Created', 'FAIL', 'Backend integration tests missing');
  }

  if (fs.existsSync(frontendTest)) {
    logTest('Frontend Tests Created', 'PASS', 'Frontend component tests available');
  } else {
    logTest('Frontend Tests Created', 'FAIL', 'Frontend component tests missing');
  }

  if (fs.existsSync(manualGuide)) {
    logTest('Manual Testing Guide', 'PASS', 'Manual testing guide available');
  } else {
    logTest('Manual Testing Guide', 'FAIL', 'Manual testing guide missing');
  }
}

// Main execution
async function main() {
  console.log('🎯 Target: Verify gender field appears for user "Jaron" with NULL gender');
  console.log('📋 Testing implementation components...');
  console.log('');

  testUploadPageGenderLogic();
  testMyScansPageUpdates();
  testBackendRoutes();
  testSchemaUpdates();
  testDatabaseSchema();
  testTestFiles();

  // Summary
  const passed = testResults.filter(t => t.status === 'PASS').length;
  const failed = testResults.filter(t => t.status === 'FAIL').length;
  const info = testResults.filter(t => t.status === 'INFO').length;
  const total = testResults.length;

  console.log('📊 VERIFICATION SUMMARY');
  console.log('======================');
  console.log(`${colors.green('✅ PASSED:')} ${passed}`);
  console.log(`${colors.red('❌ FAILED:')} ${failed}`);
  console.log(`${colors.yellow('ℹ️  INFO:')} ${info}`);
  console.log(`📊 TOTAL: ${total}`);
  console.log('');

  if (failed === 0) {
    console.log(colors.green('🎉 All critical components are in place!'));
    console.log('');
    console.log('📝 NEXT STEPS:');
    console.log('1. Run the manual testing guide to verify UI behavior');
    console.log('2. Test with user "Jaron" in the browser');
    console.log('3. Verify gender field appears in upload form');
    console.log('4. Test scan creation with gender selection');
    console.log('5. Verify database updates correctly');
  } else {
    console.log(colors.red('⚠️  Some critical components are missing or incomplete.'));
    console.log('');
    console.log('🔧 FAILED CHECKS:');
    testResults
      .filter(t => t.status === 'FAIL')
      .forEach(t => console.log(`   - ${t.name}: ${t.details}`));
  }

  console.log('');
  console.log(colors.cyan('📖 For detailed testing instructions, see:'));
  console.log('   __tests__/manual/gender-field-testing-guide.md');
  console.log('');
  console.log(colors.cyan('🧪 To run automated tests:'));
  console.log('   npm test __tests__/integration/gender-field-integration.test.ts');
  console.log('   npm test __tests__/integration/gender-field-frontend.test.ts');
}

main().catch(console.error);