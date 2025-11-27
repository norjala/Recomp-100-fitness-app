#!/usr/bin/env tsx
/**
 * Download Production Database Script
 *
 * This script downloads the production database from Render via the admin API endpoint.
 * The downloaded database can be used for:
 * - Testing migrations locally before applying to production
 * - Creating backups
 * - Analyzing data locally
 *
 * Usage:
 *   npm run download-prod-db
 *
 * Requirements:
 * - Must be logged in as admin user
 * - Production server must be running
 * - Admin credentials configured
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';

interface DownloadOptions {
  url: string;
  username: string;
  password: string;
  outputPath: string;
}

async function loginAndGetCookie(baseUrl: string, username: string, password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/login', baseUrl);
    const postData = JSON.stringify({ username, password });

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const protocol = url.protocol === 'https:' ? https : http;

    console.log(`🔐 Authenticating as ${username}...`);

    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          const cookies = res.headers['set-cookie'];
          if (cookies && cookies.length > 0) {
            console.log('✅ Authentication successful');
            resolve(cookies[0]);
          } else {
            reject(new Error('No session cookie received'));
          }
        } else {
          reject(new Error(`Authentication failed: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function downloadDatabase(options: DownloadOptions): Promise<void> {
  console.log('\n📥 Starting production database download...\n');

  const { url: baseUrl, username, password, outputPath } = options;

  try {
    // Step 1: Authenticate
    const cookie = await loginAndGetCookie(baseUrl, username, password);

    // Step 2: Download database
    const downloadUrl = new URL('/api/admin/database/download', baseUrl);

    console.log(`📦 Downloading from: ${downloadUrl.href}`);

    await new Promise<void>((resolve, reject) => {
      const options = {
        hostname: downloadUrl.hostname,
        port: downloadUrl.port || (downloadUrl.protocol === 'https:' ? 443 : 80),
        path: downloadUrl.pathname,
        method: 'GET',
        headers: {
          'Cookie': cookie
        }
      };

      const protocol = downloadUrl.protocol === 'https:' ? https : http;

      const req = protocol.request(options, (res) => {
        if (res.statusCode !== 200) {
          let error = '';
          res.on('data', (chunk) => {
            error += chunk;
          });
          res.on('end', () => {
            reject(new Error(`Download failed: ${res.statusCode} ${error}`));
          });
          return;
        }

        // Get file info from headers
        const contentLength = res.headers['content-length'];
        const sizeKB = contentLength ? Math.round(parseInt(contentLength) / 1024) : 'unknown';
        const originalPath = res.headers['x-database-original-path'] || 'unknown';

        console.log(`   Original path: ${originalPath}`);
        console.log(`   File size: ${sizeKB}KB`);
        console.log(`   Saving to: ${outputPath}`);

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // Stream to file
        const fileStream = fs.createWriteStream(outputPath);
        let downloadedBytes = 0;

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (contentLength) {
            const percent = ((downloadedBytes / parseInt(contentLength)) * 100).toFixed(1);
            process.stdout.write(`\r   Progress: ${percent}%`);
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          console.log('\n');
          resolve();
        });

        fileStream.on('error', reject);
      });

      req.on('error', reject);
      req.end();
    });

    // Step 3: Verify downloaded file
    const stats = fs.statSync(outputPath);
    console.log(`\n✅ Download completed successfully!`);
    console.log(`   File: ${outputPath}`);
    console.log(`   Size: ${Math.round(stats.size / 1024)}KB`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Verify the database: sqlite3 "${outputPath}" "SELECT COUNT(*) FROM users;"`);
    console.log(`   2. Test migration locally before applying to production`);
    console.log(`   3. Keep this file safe as a backup\n`);

  } catch (error) {
    console.error('\n❌ Download failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  // Configuration
  const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://recomp-100-fitness-app.onrender.com';
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Jaron';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_PASSWORD) {
    console.error('❌ Error: ADMIN_PASSWORD environment variable is required');
    console.log('\nUsage:');
    console.log('  ADMIN_PASSWORD=your-password npm run download-prod-db');
    console.log('  ADMIN_PASSWORD=your-password PRODUCTION_URL=https://your-app.com npm run download-prod-db');
    process.exit(1);
  }

  // Generate output path with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = path.join(process.cwd(), 'data', `fitness_challenge_production_${timestamp}.db`);

  await downloadDatabase({
    url: PRODUCTION_URL,
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
    outputPath
  });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
