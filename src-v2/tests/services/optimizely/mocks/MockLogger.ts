import { ILoggerAdapter, LogLevel } from '../../../../adapters/interfaces/ILoggerAdapter';
import { vi } from 'vitest';

/**
 * Mock implementation of ILoggerAdapter for testing
 */
export class MockLogger implements ILoggerAdapter {
  public debugMock = vi.fn();
  public infoMock = vi.fn();
  public warnMock = vi.fn();
  public errorMock = vi.fn();
  public setLogLevelMock = vi.fn();
  private currentLogLevel: LogLevel = LogLevel.DEBUG;
  
  public logs: {
    level: LogLevel;
    message: string;
    metadata?: unknown;
    error?: unknown;
  }[] = [];

  constructor() {
    this.debug = this.debug.bind(this);
    this.info = this.info.bind(this);
    this.warn = this.warn.bind(this);
    this.error = this.error.bind(this);
    this.setLogLevel = this.setLogLevel.bind(this);
  }

  debug(message: string, metadata?: unknown): void {
    this.debugMock(message, metadata);
    this.logs.push({ level: LogLevel.DEBUG, message, metadata });
  }

  info(message: string, metadata?: unknown): void {
    this.infoMock(message, metadata);
    this.logs.push({ level: LogLevel.INFO, message, metadata });
  }

  warn(message: string, metadata?: unknown): void {
    this.warnMock(message, metadata);
    this.logs.push({ level: LogLevel.WARN, message, metadata });
  }

  error(message: string, error?: unknown, metadata?: unknown): void {
    this.errorMock(message, error, metadata);
    this.logs.push({ level: LogLevel.ERROR, message, error, metadata });
  }

  setLogLevel(level: LogLevel): void {
    this.setLogLevelMock(level);
    this.currentLogLevel = level;
  }

  // Helper methods for tests
  
  /**
   * Clears all logs and resets mock counters
   */
  reset(): void {
    this.logs = [];
    this.debugMock.mockClear();
    this.infoMock.mockClear();
    this.warnMock.mockClear();
    this.errorMock.mockClear();
    this.setLogLevelMock.mockClear();
  }

  /**
   * Gets all logs of a specific level
   */
  getLogsByLevel(level: LogLevel): typeof this.logs {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Checks if a specific message was logged
   */
  hasLoggedMessage(level: LogLevel, messageSubstring: string): boolean {
    return this.logs.some(log => 
      log.level === level && log.message.includes(messageSubstring)
    );
  }
} 