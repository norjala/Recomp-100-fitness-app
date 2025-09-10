/**
 * Database Audit Logging System
 * 
 * Logs all critical database operations to prevent data loss incidents
 * like the Jackie data loss on September 8, 2025
 */

import fs from 'fs';
import path from 'path';
import { getConfig } from './config.js';

export interface AuditLogEntry {
  timestamp: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_DELETE' | 'BACKUP' | 'RESTORE';
  table: string;
  recordId?: string;
  userId?: string;
  username?: string;
  details: Record<string, any>;
  affectedRows?: number;
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
}

class AuditLogger {
  private auditLogPath: string;
  private isInitialized = false;

  constructor() {
    const config = getConfig();
    this.auditLogPath = path.join(process.cwd(), 'logs', 'audit.log');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    const logDir = path.dirname(this.auditLogPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.isInitialized = true;
  }

  /**
   * Log a database operation for audit trail
   */
  log(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    try {
      if (!this.isInitialized) {
        this.ensureLogDirectory();
      }

      const auditEntry: AuditLogEntry = {
        ...entry,
        timestamp: new Date().toISOString(),
      };

      const logLine = JSON.stringify(auditEntry) + '\n';
      
      // Append to audit log file
      fs.appendFileSync(this.auditLogPath, logLine);

      // Also log to console for immediate visibility
      const logLevel = entry.operation === 'DELETE' || entry.operation === 'BULK_DELETE' ? 'WARN' : 'INFO';
      console.log(`[AUDIT] [${logLevel}] ${entry.operation} on ${entry.table}${entry.recordId ? ` (ID: ${entry.recordId})` : ''}${entry.affectedRows ? ` (${entry.affectedRows} rows)` : ''}`);

    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't throw - we don't want audit logging failures to break the application
    }
  }

  /**
   * Log user creation
   */
  logUserCreated(userId: string, username: string, details: any = {}, context: any = {}) {
    this.log({
      operation: 'CREATE',
      table: 'users',
      recordId: userId,
      userId,
      username,
      details: { ...details, action: 'user_registration' },
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      sessionId: context.sessionId,
    });
  }

  /**
   * Log user deletion (critical operation)
   */
  logUserDeleted(userId: string, username: string, context: any = {}) {
    this.log({
      operation: 'DELETE',
      table: 'users',
      recordId: userId,
      userId,
      username,
      details: { action: 'user_deletion', warning: 'CRITICAL_DATA_LOSS_RISK' },
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      sessionId: context.sessionId,
    });
  }

  /**
   * Log DEXA scan creation
   */
  logScanCreated(scanId: string, userId: string, username: string, scanDetails: any = {}, context: any = {}) {
    this.log({
      operation: 'CREATE',
      table: 'dexa_scans',
      recordId: scanId,
      userId,
      username,
      details: { ...scanDetails, action: 'scan_upload' },
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      sessionId: context.sessionId,
    });
  }

  /**
   * Log DEXA scan deletion (critical operation)
   */
  logScanDeleted(scanId: string, userId: string, username: string, context: any = {}) {
    this.log({
      operation: 'DELETE',
      table: 'dexa_scans',
      recordId: scanId,
      userId,
      username,
      details: { action: 'scan_deletion', warning: 'DATA_LOSS' },
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      sessionId: context.sessionId,
    });
  }

  /**
   * Log bulk deletion operations (EXTREMELY CRITICAL)
   */
  logBulkDelete(table: string, affectedRows: number, context: any = {}) {
    this.log({
      operation: 'BULK_DELETE',
      table,
      affectedRows,
      details: { 
        action: 'bulk_deletion', 
        warning: 'CRITICAL_MASS_DATA_LOSS',
        message: `Deleted ${affectedRows} records from ${table} table`
      },
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      sessionId: context.sessionId,
    });
  }

  /**
   * Log database backup operations
   */
  logBackupCreated(backupFile: string, dataStats: any = {}) {
    this.log({
      operation: 'BACKUP',
      table: 'database',
      details: { 
        action: 'backup_created',
        backupFile,
        ...dataStats
      },
    });
  }

  /**
   * Log database restore operations
   */
  logRestore(restoreFile: string, context: any = {}) {
    this.log({
      operation: 'RESTORE',
      table: 'database',
      details: { 
        action: 'database_restored',
        restoreFile,
        warning: 'DATA_OVERWRITE'
      },
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
      sessionId: context.sessionId,
    });
  }

  /**
   * Search audit logs for specific operations
   */
  searchLogs(filters: {
    operation?: string;
    table?: string;
    userId?: string;
    username?: string;
    dateFrom?: Date;
    dateTo?: Date;
  } = {}): AuditLogEntry[] {
    try {
      if (!fs.existsSync(this.auditLogPath)) {
        return [];
      }

      const logContent = fs.readFileSync(this.auditLogPath, 'utf8');
      const logLines = logContent.trim().split('\n').filter(line => line.length > 0);

      const entries: AuditLogEntry[] = logLines.map(line => {
        try {
          return JSON.parse(line) as AuditLogEntry;
        } catch {
          return null;
        }
      }).filter(entry => entry !== null) as AuditLogEntry[];

      // Apply filters
      return entries.filter(entry => {
        if (filters.operation && entry.operation !== filters.operation) return false;
        if (filters.table && entry.table !== filters.table) return false;
        if (filters.userId && entry.userId !== filters.userId) return false;
        if (filters.username && entry.username !== filters.username) return false;
        
        if (filters.dateFrom || filters.dateTo) {
          const entryDate = new Date(entry.timestamp);
          if (filters.dateFrom && entryDate < filters.dateFrom) return false;
          if (filters.dateTo && entryDate > filters.dateTo) return false;
        }

        return true;
      });

    } catch (error) {
      console.error('Failed to search audit logs:', error);
      return [];
    }
  }

  /**
   * Get recent critical operations (deletions, bulk operations)
   */
  getRecentCriticalOperations(hoursBack: number = 24): AuditLogEntry[] {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursBack);

    return this.searchLogs({
      dateFrom: cutoffDate,
    }).filter(entry => 
      entry.operation === 'DELETE' || 
      entry.operation === 'BULK_DELETE' ||
      entry.operation === 'RESTORE'
    );
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();

/**
 * Express middleware to capture request context for audit logging
 */
export function auditContextMiddleware(req: any, res: any, next: any) {
  req.auditContext = {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    sessionId: req.sessionID,
  };
  next();
}

export default auditLogger;