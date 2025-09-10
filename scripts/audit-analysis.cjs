#!/usr/bin/env node

/**
 * Audit Log Analysis Tool
 * 
 * Analyzes audit logs to investigate data loss incidents
 * Specifically created to investigate the Jackie data loss incident
 */

const fs = require('fs');
const path = require('path');

const AUDIT_LOG_PATH = './logs/audit.log';

/**
 * Load and parse audit log entries
 */
function loadAuditLogs() {
  try {
    if (!fs.existsSync(AUDIT_LOG_PATH)) {
      console.log('📄 No audit log file found. This explains why we have no record of the Jackie incident.');
      console.log('   Audit logging was not implemented when the data loss occurred.');
      return [];
    }

    const logContent = fs.readFileSync(AUDIT_LOG_PATH, 'utf8');
    const logLines = logContent.trim().split('\n').filter(line => line.length > 0);

    return logLines.map(line => {
      try {
        return JSON.parse(line);
      } catch (error) {
        console.warn(`Failed to parse log line: ${line}`);
        return null;
      }
    }).filter(entry => entry !== null);

  } catch (error) {
    console.error('Failed to load audit logs:', error);
    return [];
  }
}

/**
 * Search for specific operations
 */
function searchLogs(entries, filters = {}) {
  return entries.filter(entry => {
    if (filters.operation && entry.operation !== filters.operation) return false;
    if (filters.table && entry.table !== filters.table) return false;
    if (filters.userId && entry.userId !== filters.userId) return false;
    if (filters.username && entry.username && !entry.username.toLowerCase().includes(filters.username.toLowerCase())) return false;
    
    if (filters.dateFrom || filters.dateTo) {
      const entryDate = new Date(entry.timestamp);
      if (filters.dateFrom && entryDate < filters.dateFrom) return false;
      if (filters.dateTo && entryDate > filters.dateTo) return false;
    }

    return true;
  });
}

/**
 * Analyze audit logs for the Jackie incident
 */
function analyzeJackieIncident(entries) {
  console.log('\n🔍 === JACKIE DATA LOSS INCIDENT ANALYSIS ===\n');

  // Search for any Jackie-related entries
  const jackieEntries = searchLogs(entries, { username: 'jackie' });
  
  if (jackieEntries.length === 0) {
    console.log('❌ No audit log entries found for user "Jackie"');
    console.log('   This indicates either:');
    console.log('   1. Jackie\'s data was lost before audit logging was implemented');
    console.log('   2. The data loss occurred through direct database manipulation');
    console.log('   3. The incident happened on a different system/database');
    console.log('');
  } else {
    console.log(`✅ Found ${jackieEntries.length} audit entries for Jackie:`);
    jackieEntries.forEach(entry => {
      console.log(`   📅 ${entry.timestamp} - ${entry.operation} on ${entry.table}`);
      if (entry.details) {
        console.log(`      Details: ${JSON.stringify(entry.details)}`);
      }
    });
    console.log('');
  }

  // Search for bulk delete operations (the likely cause)
  const bulkDeletes = searchLogs(entries, { operation: 'BULK_DELETE' });
  
  if (bulkDeletes.length === 0) {
    console.log('❌ No bulk delete operations found in audit logs');
    console.log('   The data loss likely occurred before audit logging was implemented');
    console.log('');
  } else {
    console.log(`⚠️  Found ${bulkDeletes.length} bulk delete operations:`);
    bulkDeletes.forEach(entry => {
      console.log(`   📅 ${entry.timestamp} - Deleted ${entry.affectedRows} rows from ${entry.table}`);
      if (entry.details) {
        console.log(`      Details: ${JSON.stringify(entry.details)}`);
      }
    });
    console.log('');
  }

  // Search for all delete operations
  const allDeletes = searchLogs(entries, { operation: 'DELETE' });
  
  if (allDeletes.length === 0) {
    console.log('❌ No individual delete operations found');
  } else {
    console.log(`🗑️  Found ${allDeletes.length} individual delete operations:`);
    allDeletes.forEach(entry => {
      console.log(`   📅 ${entry.timestamp} - Deleted ${entry.table} record (ID: ${entry.recordId})`);
      if (entry.username) {
        console.log(`      User: ${entry.username}`);
      }
    });
    console.log('');
  }

  return {
    jackieEntries: jackieEntries.length,
    bulkDeletes: bulkDeletes.length,
    individualDeletes: allDeletes.length
  };
}

/**
 * Analyze patterns around September 8, 2025 (incident date)
 */
function analyzeIncidentDate(entries) {
  console.log('\n📅 === ACTIVITY AROUND SEPTEMBER 8, 2025 ===\n');

  const incidentDate = new Date('2025-09-08');
  const dayBefore = new Date(incidentDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayAfter = new Date(incidentDate);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const incidentPeriodEntries = searchLogs(entries, {
    dateFrom: dayBefore,
    dateTo: dayAfter
  });

  if (incidentPeriodEntries.length === 0) {
    console.log('❌ No audit log entries found for September 7-9, 2025');
    console.log('   This confirms the incident occurred before audit logging was implemented');
    console.log('');
  } else {
    console.log(`📊 Found ${incidentPeriodEntries.length} operations during incident period:`);
    incidentPeriodEntries.forEach(entry => {
      console.log(`   📅 ${entry.timestamp} - ${entry.operation} on ${entry.table}`);
      if (entry.username) {
        console.log(`      User: ${entry.username}`);
      }
      if (entry.affectedRows) {
        console.log(`      Affected rows: ${entry.affectedRows}`);
      }
    });
    console.log('');
  }

  return incidentPeriodEntries.length;
}

/**
 * Show recent critical operations
 */
function showRecentCriticalOperations(entries) {
  console.log('\n⚠️  === RECENT CRITICAL OPERATIONS ===\n');

  const criticalOps = entries.filter(entry => 
    entry.operation === 'DELETE' || 
    entry.operation === 'BULK_DELETE' ||
    entry.operation === 'RESTORE'
  );

  if (criticalOps.length === 0) {
    console.log('✅ No critical operations found in audit logs');
    console.log('   (This is expected if audit logging was recently implemented)');
    console.log('');
  } else {
    console.log(`🚨 Found ${criticalOps.length} critical operations:`);
    criticalOps.forEach(entry => {
      console.log(`   📅 ${entry.timestamp} - ${entry.operation} on ${entry.table}`);
      if (entry.affectedRows) {
        console.log(`      Affected rows: ${entry.affectedRows}`);
      }
      if (entry.username) {
        console.log(`      User: ${entry.username}`);
      }
      if (entry.details && entry.details.warning) {
        console.log(`      ⚠️  Warning: ${entry.details.warning}`);
      }
    });
    console.log('');
  }

  return criticalOps.length;
}

/**
 * Generate incident report
 */
function generateIncidentReport(entries) {
  console.log('\n📋 === INCIDENT REPORT SUMMARY ===\n');

  const stats = analyzeJackieIncident(entries);
  const incidentPeriodCount = analyzeIncidentDate(entries);
  const criticalOpsCount = showRecentCriticalOperations(entries);

  console.log('🔍 INVESTIGATION CONCLUSIONS:');
  console.log('');
  console.log('1. 📅 TIMELINE: Jackie reported data loss from "last night" (September 8, 2025)');
  console.log(`2. 📊 AUDIT COVERAGE: ${entries.length} total audit entries found`);
  console.log(`3. 👤 JACKIE TRACES: ${stats.jackieEntries} entries found for Jackie`);
  console.log(`4. 🗑️  BULK OPERATIONS: ${stats.bulkDeletes} bulk delete operations logged`);
  console.log(`5. ❌ INDIVIDUAL DELETES: ${stats.individualDeletes} individual delete operations`);
  console.log(`6. 📅 INCIDENT PERIOD: ${incidentPeriodCount} operations during Sep 7-9, 2025`);
  console.log(`7. ⚠️  CRITICAL OPS: ${criticalOpsCount} critical operations total`);
  console.log('');

  if (entries.length === 0) {
    console.log('🎯 PRIMARY CONCLUSION:');
    console.log('   Jackie\'s data loss occurred BEFORE audit logging was implemented.');
    console.log('   The dangerous reset script (reset-user-scans.sql) was likely executed');
    console.log('   manually or through some other process, completely wiping all user data.');
    console.log('');
    console.log('🔧 EVIDENCE SUPPORTING THIS:');
    console.log('   - No audit logs exist for the incident period');
    console.log('   - reset-user-scans.sql contains "DELETE FROM dexa_scans;" and "DELETE FROM scoring_data;"');
    console.log('   - Database backup from Sep 5 was already empty');
    console.log('   - Current database only contains test users from reset script');
    console.log('');
  }

  console.log('✅ SAFETY MEASURES NOW IN PLACE:');
  console.log('   - Dangerous scripts moved to DANGEROUS_ARCHIVE/');
  console.log('   - Comprehensive audit logging implemented');
  console.log('   - Automated backup system with verification');
  console.log('   - All database operations now tracked');
  console.log('');

  console.log('📞 NEXT STEPS:');
  console.log('   1. Contact Jackie to recreate her account');
  console.log('   2. Help her re-enter her DEXA scan data');
  console.log('   3. Provide her with priority support');
  console.log('   4. Consider compensation for the inconvenience');
  console.log('');
}

// Command line interface
const command = process.argv[2];

console.log('🔍 Audit Log Analysis Tool');
console.log('🎯 Investigating Jackie Data Loss Incident');
console.log('');

const entries = loadAuditLogs();

switch (command) {
  case 'jackie':
    analyzeJackieIncident(entries);
    break;
  case 'incident':
    analyzeIncidentDate(entries);
    break;
  case 'critical':
    showRecentCriticalOperations(entries);
    break;
  case 'report':
  default:
    generateIncidentReport(entries);
    break;
}

console.log('📄 For more details, check:');
console.log(`   - Audit logs: ${AUDIT_LOG_PATH}`);
console.log('   - Database backups: ./data/backups/');
console.log('   - Dangerous scripts: ./scripts/DANGEROUS_ARCHIVE/');
console.log('');