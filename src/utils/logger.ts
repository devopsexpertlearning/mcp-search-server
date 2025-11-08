/**
 * Centralized logging utility
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  timestamp?: boolean;
}

export class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: this.parseLogLevel(process.env.MCP_LOG_LEVEL) || LogLevel.INFO,
      prefix: config.prefix || 'MCP',
      timestamp: config.timestamp ?? true,
      ...config,
    };
  }

  private parseLogLevel(level?: string): LogLevel | undefined {
    if (!level) return undefined;
    
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': case 'warning': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return undefined;
    }
  }

  private formatMessage(level: string, message: string): string {
    const parts = [];
    
    if (this.config.timestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }
    
    if (this.config.prefix) {
      parts.push(`[${this.config.prefix}]`);
    }
    
    parts.push(`[${level}]`, message);
    
    return parts.join(' ');
  }

  private log(level: LogLevel, levelName: string, message: string, ...args: any[]): void {
    if (level < this.config.level) return;
    
    const formatted = this.formatMessage(levelName, message);
    
    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(formatted, ...args);
        break;
      case LogLevel.WARN:
        console.warn(formatted, ...args);
        break;
      case LogLevel.ERROR:
        console.error(formatted, ...args);
        break;
    }
  }

  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, 'INFO', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, 'WARN', message, ...args);
  }

  error(message: string, error?: Error | any, ...args: any[]): void {
    if (error instanceof Error) {
      this.log(LogLevel.ERROR, 'ERROR', `${message}: ${error.message}`, error.stack, ...args);
    } else if (error) {
      this.log(LogLevel.ERROR, 'ERROR', `${message}:`, error, ...args);
    } else {
      this.log(LogLevel.ERROR, 'ERROR', message, ...args);
    }
  }

  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix,
    });
  }
}

// Global logger instance
export const logger = new Logger();