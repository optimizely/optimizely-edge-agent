import { ILoggerAdapter, LogLevel, LogContext, LogEntry, LoggerConfiguration } from '../../adapters/interfaces/ILoggerAdapter';

/**
 * Mock implementation of the ILoggerAdapter for testing
 */
export class MockLoggerAdapter implements ILoggerAdapter {
  private logLevel: LogLevel = LogLevel.INFO;
  private configuration: LoggerConfiguration = {
    level: LogLevel.INFO,
    enableStructuredLogs: true,
    maskSensitiveData: true,
    format: 'json',
    includeStackTraces: true
  };
  public logs: Array<{ level: string; message: string; data?: any }> = [];

  trace(message: string, context?: LogContext | unknown): void {
    this.logs.push({ level: 'trace', message, data: context });
  }

  debug(message: string, context?: LogContext | unknown): void {
    this.logs.push({ level: 'debug', message, data: context });
  }

  info(message: string, context?: LogContext | unknown): void {
    this.logs.push({ level: 'info', message, data: context });
  }

  warn(message: string, context?: LogContext | unknown): void {
    this.logs.push({ level: 'warn', message, data: context });
  }

  error(message: string, errorOrContext?: Error | LogContext | unknown, context?: LogContext | unknown): void {
    this.logs.push({ 
      level: 'error', 
      message, 
      data: errorOrContext instanceof Error 
        ? { error: errorOrContext, context } 
        : errorOrContext 
    });
  }

  fatal(message: string, errorOrContext?: Error | LogContext | unknown, context?: LogContext | unknown): void {
    this.logs.push({ 
      level: 'fatal', 
      message, 
      data: errorOrContext instanceof Error 
        ? { error: errorOrContext, context } 
        : errorOrContext 
    });
  }

  logEntry(entry: LogEntry): void {
    this.logs.push({ 
      level: entry.level, 
      message: entry.message, 
      data: entry 
    });
  }

  child(context: LogContext): ILoggerAdapter {
    // Create a new logger that inherits from this one but with additional context
    const childLogger = new MockLoggerAdapter();
    childLogger.setLogLevel(this.logLevel);
    childLogger.updateConfiguration(this.configuration);
    return childLogger;
  }

  /**
   * Helper method to create a child logger with specific component context
   */
  forComponent(component: string): ILoggerAdapter {
    return this.child({ component });
  }

  /**
   * Helper method to create a child logger with request context
   */
  forRequest(requestId: string, context?: LogContext): ILoggerAdapter {
    return this.child({ requestId, ...context });
  }

  /**
   * Helper method to extract info from an error for logging
   */
  extractErrorInfo(error: Error): { message: string; stack?: string; [key: string]: any } {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name
    };
  }

  /**
   * Start a timer that can be used to log execution time
   */
  startTimer(operation: string, context?: LogContext): { 
    stop: (result?: string, additionalContext?: LogContext) => number,
    log: (level: LogLevel, message: string, additionalContext?: LogContext) => number 
  } {
    const start = Date.now();
    
    return {
      stop: (result?: string, additionalContext?: LogContext) => {
        const duration = Date.now() - start;
        this.info(`${operation} completed${result ? `: ${result}` : ''}`, { 
          durationMs: duration, 
          operation, 
          ...context,
          ...additionalContext 
        });
        return duration;
      },
      log: (level: LogLevel, message: string, additionalContext?: LogContext) => {
        const duration = Date.now() - start;
        switch(level) {
          case LogLevel.TRACE:
            this.trace(message, { durationMs: duration, operation, ...context, ...additionalContext });
            break;
          case LogLevel.DEBUG:
            this.debug(message, { durationMs: duration, operation, ...context, ...additionalContext });
            break;
          case LogLevel.INFO:
            this.info(message, { durationMs: duration, operation, ...context, ...additionalContext });
            break;
          case LogLevel.WARN:
            this.warn(message, { durationMs: duration, operation, ...context, ...additionalContext });
            break;
          case LogLevel.ERROR:
            this.error(message, { durationMs: duration, operation, ...context, ...additionalContext });
            break;
          case LogLevel.FATAL:
            this.fatal(message, { durationMs: duration, operation, ...context, ...additionalContext });
            break;
        }
        return duration;
      }
    };
  }

  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  isLevelEnabled(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    
    // Lower index means higher priority
    return requestedLevelIndex >= currentLevelIndex;
  }

  getConfiguration(): LoggerConfiguration {
    return { ...this.configuration };
  }

  updateConfiguration(config: Partial<LoggerConfiguration>): LoggerConfiguration {
    this.configuration = { ...this.configuration, ...config };
    if (config.level !== undefined) {
      this.setLogLevel(config.level);
    }
    return this.getConfiguration();
  }

  /**
   * Get all logs of a specific level
   */
  getLogsByLevel(level: string): Array<{ level: string; message: string; data?: any }> {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }
} 