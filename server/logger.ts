// Simple logging system with configurable levels and formats
import { getConfig, isTest } from './config';
import fs from 'fs';
import path from 'path';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: any;
}

class Logger {
  private config = getConfig();
  private logFile?: string;

  constructor() {
    // Setup log file in production
    if (this.config.NODE_ENV === 'production') {
      const logsDir = './logs';
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      this.logFile = path.join(logsDir, `app-${new Date().toISOString().split('T')[0]}.log`);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const configLevel = this.getConfigLogLevel();
    return level <= configLevel;
  }

  private getConfigLogLevel(): LogLevel {
    switch (this.config.LOG_LEVEL) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...(meta && { meta })
    };

    if (this.config.LOG_FORMAT === 'json') {
      return JSON.stringify(entry);
    } else {
      // Simple format: [timestamp] LEVEL: message
      const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
      return `[${entry.timestamp}] ${entry.level}: ${message}${metaStr}`;
    }
  }

  private writeLog(level: string, message: string, meta?: any): void {
    if (isTest()) return; // Skip logging in tests

    const formatted = this.formatMessage(level, message, meta);

    // Console output
    const consoleMethod = level === 'ERROR' ? console.error : 
                         level === 'WARN' ? console.warn : 
                         level === 'DEBUG' ? console.debug : 
                         console.log;
    
    consoleMethod(formatted);

    // File output in production
    if (this.logFile && this.config.NODE_ENV === 'production') {
      try {
        fs.appendFileSync(this.logFile, formatted + '\n');
      } catch (error) {
        console.error('Failed to write to log file:', error);
      }
    }
  }

  error(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.writeLog('ERROR', message, meta);
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.writeLog('WARN', message, meta);
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.writeLog('INFO', message, meta);
    }
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.writeLog('DEBUG', message, meta);
    }
  }

  // Request logging middleware
  logRequest(req: any, res: any, duration: number): void {
    if (!this.config.ENABLE_REQUEST_LOGGING) return;

    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };

    const message = `${req.method} ${req.url} ${res.statusCode} ${duration}ms`;

    // Log as INFO for successful requests, WARN for client errors, ERROR for server errors
    if (res.statusCode >= 500) {
      this.error(message, logData);
    } else if (res.statusCode >= 400) {
      this.warn(message, logData);
    } else {
      this.info(message, logData);
    }
  }
}

// Create singleton logger instance
export const logger = new Logger();

// Convenience functions
export const log = {
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  request: (req: any, res: any, duration: number) => logger.logRequest(req, res, duration)
};