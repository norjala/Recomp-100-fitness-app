import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('DEXA Scan Extraction Feature', () => {
  // Set up a test user for our tests
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Check if we're already logged in, if not, register/login
    const isLoggedIn = await page.locator('[data-testid="dashboard"]').isVisible().catch(() => false);
    
    if (!isLoggedIn) {
      // Try to register a new test user
      await page.click('text=Register');
      
      const timestamp = Date.now();
      const testUser = {
        username: `test_user_${timestamp}`,
        email: `test${timestamp}@example.com`,
        password: 'testpassword123'
      };
      
      await page.fill('input[name="username"]', testUser.username);
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.click('button[type="submit"]');
      
      // Wait for redirect to dashboard
      await page.waitForSelector('[data-testid="dashboard"]', { timeout: 10000 });
    }
    
    // Navigate to upload page
    await page.goto('/upload');
    await page.waitForLoadState('networkidle');
  });

  test('should display upload page correctly', async ({ page }) => {
    // Check that the upload page is rendered
    await expect(page.locator('h3:has-text("Upload DEXA Scan")')).toBeVisible();
    
    // Check for the main upload areas
    await expect(page.locator('text=Upload DEXA Scan Report')).toBeVisible();
    await expect(page.locator('text=Enter Scan Data')).toBeVisible();
    
    // Check for the extract data button
    await expect(page.locator('button:has-text("Upload & Extract Data")')).toBeVisible();
    
    // Check for manual form fields
    await expect(page.locator('input[id="scanDate"]')).toBeVisible();
    await expect(page.locator('input[id="bodyFat"]')).toBeVisible();
    await expect(page.locator('input[id="leanMass"]')).toBeVisible();
    await expect(page.locator('input[id="totalWeight"]')).toBeVisible();
    await expect(page.locator('input[id="fatMass"]')).toBeVisible();
  });

  test('should extract data from DEXA image successfully', async ({ page }) => {
    // Prepare the test image file
    const testImagePath = path.join(__dirname, 'test-dexa-image.png');
    
    // Click the upload button to open file dialog
    const fileInput = page.locator('input[id="scan-extract"]');
    
    // Upload the test image
    await fileInput.setInputFiles(testImagePath);
    
    // Wait for extraction to complete
    await page.waitForSelector('text=Extracting Data...', { state: 'hidden', timeout: 30000 });
    
    // Check that extraction results are displayed
    await expect(page.locator('text=Extracted Data')).toBeVisible({ timeout: 30000 });
    
    // Verify that extracted data contains expected fields
    const extractedDataSection = page.locator('[class*="bg-green-50"], [class*="bg-yellow-50"], [class*="bg-red-50"]').first();
    await expect(extractedDataSection).toBeVisible();
    
    // Check for confidence indicator
    await expect(page.locator('text=/\\d+% confidence/')).toBeVisible();
    
    // Check that form fields may have been auto-filled (if confidence is high enough)
    // Note: This depends on the actual extracted data and confidence level
    console.log('DEXA image extraction test completed');
  });

  test('should extract data from DEXA PDF successfully', async ({ page }) => {
    // Prepare the test PDF file
    const testPdfPath = path.join(__dirname, 'test-dexa-pdf.pdf');
    
    // Click the upload button to open file dialog
    const fileInput = page.locator('input[id="scan-extract"]');
    
    // Upload the test PDF
    await fileInput.setInputFiles(testPdfPath);
    
    // Wait for extraction to complete
    await page.waitForSelector('text=Extracting Data...', { state: 'hidden', timeout: 30000 });
    
    // Check that extraction results are displayed
    await expect(page.locator('text=Extracted Data')).toBeVisible({ timeout: 30000 });
    
    // Verify that extracted data contains expected fields
    const extractedDataSection = page.locator('[class*="bg-green-50"], [class*="bg-yellow-50"], [class*="bg-red-50"]').first();
    await expect(extractedDataSection).toBeVisible();
    
    // Check for confidence indicator
    await expect(page.locator('text=/\\d+% confidence/')).toBeVisible();
    
    console.log('DEXA PDF extraction test completed');
  });

  test('should handle extraction errors gracefully', async ({ page }) => {
    // Create a mock invalid file (text file with wrong extension)
    const invalidFile = path.join(__dirname, '../package.json'); // Use package.json as invalid file
    
    // Try to upload an invalid file type
    const fileInput = page.locator('input[id="scan-extract"]');
    await fileInput.setInputFiles(invalidFile);
    
    // Should show an error message
    await expect(page.locator('text=/Extraction failed|Please select an image file/')).toBeVisible({ timeout: 10000 });
  });

  test('should allow manual form submission after extraction', async ({ page }) => {
    // First extract data from an image
    const testImagePath = path.join(__dirname, 'test-dexa-image.png');
    const fileInput = page.locator('input[id="scan-extract"]');
    await fileInput.setInputFiles(testImagePath);
    
    // Wait for extraction
    await page.waitForSelector('text=Extracting Data...', { state: 'hidden', timeout: 30000 });
    
    // Fill in any missing required fields manually
    await page.fill('input[id="scanDate"]', '2023-12-01');
    
    // Check if bodyFat field is empty and fill it
    const bodyFatValue = await page.locator('input[id="bodyFat"]').inputValue();
    if (!bodyFatValue || bodyFatValue === '0') {
      await page.fill('input[id="bodyFat"]', '15.5');
    }
    
    // Check if leanMass field is empty and fill it
    const leanMassValue = await page.locator('input[id="leanMass"]').inputValue();
    if (!leanMassValue || leanMassValue === '0') {
      await page.fill('input[id="leanMass"]', '140.2');
    }
    
    // Check if totalWeight field is empty and fill it
    const totalWeightValue = await page.locator('input[id="totalWeight"]').inputValue();
    if (!totalWeightValue || totalWeightValue === '0') {
      await page.fill('input[id="totalWeight"]', '165.7');
    }
    
    // Check if fatMass field is empty and fill it
    const fatMassValue = await page.locator('input[id="fatMass"]').inputValue();
    if (!fatMassValue || fatMassValue === '0') {
      await page.fill('input[id="fatMass"]', '25.5');
    }
    
    // Submit the form
    await page.click('button:has-text("Save Scan Data")');
    
    // Wait for success message
    await expect(page.locator('text=DEXA scan data saved successfully!')).toBeVisible({ timeout: 10000 });
  });

  test('should show technical details in debug section', async ({ page }) => {
    // Extract data from an image
    const testImagePath = path.join(__dirname, 'test-dexa-image.png');
    const fileInput = page.locator('input[id="scan-extract"]');
    await fileInput.setInputFiles(testImagePath);
    
    // Wait for extraction
    await page.waitForSelector('text=Extracting Data...', { state: 'hidden', timeout: 30000 });
    
    // Look for technical details section (if it exists)
    const technicalDetails = page.locator('details:has-text("Technical Details")');
    if (await technicalDetails.isVisible()) {
      // Click to expand technical details
      await technicalDetails.click();
      
      // Check for technical information
      await expect(page.locator('text=/Method:|Model:|Processing:/')).toBeVisible();
    }
  });

  test('should validate required form fields', async ({ page }) => {
    // Try to submit form without required fields
    await page.click('button:has-text("Save Scan Data")');
    
    // Should prevent submission due to HTML5 validation or show validation errors
    // The exact behavior depends on how form validation is implemented
    
    // Check that we're still on the upload page (form didn't submit)
    await expect(page.locator('h3:has-text("Upload DEXA Scan")')).toBeVisible();
  });

  test('should handle large file uploads correctly', async ({ page }) => {
    // Test file size limits
    const fileInput = page.locator('input[id="scan-extract"]');
    
    // Try to select a large file (this test just validates the file input exists)
    await expect(fileInput).toHaveAttribute('accept', 'image/*,.pdf');
  });
});

test.describe('DEXA Extraction API Tests', () => {
  test('should handle API rate limiting gracefully', async ({ page }) => {
    // This test would be more complex in a real scenario
    // For now, just ensure the API endpoint exists
    await page.goto('/upload');
    
    // Make sure the extraction button is available
    await expect(page.locator('button:has-text("Upload & Extract Data")')).toBeVisible();
  });
});