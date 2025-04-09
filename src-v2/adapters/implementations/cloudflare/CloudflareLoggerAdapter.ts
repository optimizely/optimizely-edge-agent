import { ILoggerAdapter, LogLevel } from "../../interfaces/ILoggerAdapter";
import { IEnvironmentAdapter } from "../../interfaces/IEnvironmentAdapter";

/**
 * Cloudflare-specific implementation of ILoggerAdapter.
 * Uses the standard console object and respects LOG_LEVEL environment variable.
 */
export class CloudflareLoggerAdapter implements ILoggerAdapter {
  private currentLevel: LogLevel = LogLevel.INFO; // Default level
  private levelValues: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 1,
    [LogLevel.INFO]: 2,
    [LogLevel.WARN]: 3,
    [LogLevel.ERROR]: 4,
  };

  /**
   * Creates an instance of the logger adapter.
   * Reads LOG_LEVEL from the environment adapter if available.
   * @param environmentAdapter - Optional environment adapter to read log level.
   */
  constructor(environmentAdapter?: IEnvironmentAdapter) {
    const envLogLevel = environmentAdapter?.getVariable('LOG_LEVEL')?.toLowerCase();
    if (envLogLevel && this.isValidLogLevel(envLogLevel)) {
      this.currentLevel = envLogLevel;
    }
    console.log(`[CloudflareLoggerAdapter] Initialized with level: ${this.currentLevel}`);
  }

  private isValidLogLevel(level: string): level is LogLevel {
    return Object.values(LogLevel).includes(level as LogLevel);
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelValues[level] >= this.levelValues[this.currentLevel];
  }

  private formatMessage(level: LogLevel, message: string, metadata?: unknown): any[] {
    const prefix = `[${level.toUpperCase()}]`;
    if (metadata) {
      return [prefix, message, metadata];
    }
    return [prefix, message];
  }

  debug(message: string, metadata?: unknown): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(...this.formatMessage(LogLevel.DEBUG, message, metadata));
    }
  }

  info(message: string, metadata?: unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(...this.formatMessage(LogLevel.INFO, message, metadata));
    }
  }

  warn(message: string, metadata?: unknown): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(...this.formatMessage(LogLevel.WARN, message, metadata));
    }
  }

  error(message: string, error?: Error | unknown, metadata?: unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const logData = metadata ? { error, ...metadata } : { error };
      console.error(...this.formatMessage(LogLevel.ERROR, message, logData));
    }
  }

  setLogLevel(level: LogLevel): void {
    if (this.isValidLogLevel(level)) {
      console.log(`[CloudflareLoggerAdapter] Log level changed from ${this.currentLevel} to ${level}`);
      this.currentLevel = level;
    } else {
      console.warn(`[CloudflareLoggerAdapter] Attempted to set invalid log level: ${level}`);
    }
  }
} 