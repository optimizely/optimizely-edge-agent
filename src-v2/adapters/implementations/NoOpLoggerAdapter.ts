import { 
  ILoggerAdapter, 
  LogLevel, 
  LogContext, 
  LogEntry, 
  LoggerConfiguration 
} from '../interfaces/ILoggerAdapter';

/**
 * Implementation of ILoggerAdapter that doesn't log anything.
 * Useful for tests, or when wanting to suppress logs.
 */
export class NoOpLoggerAdapter implements ILoggerAdapter {
  private configuration: LoggerConfiguration = {
    level: LogLevel.NONE,
    enableStructuredLogs: false,
    includeSensitiveData: false,
    maskSensitiveData: true,
    format: 'text',
    useColors: false,
    includeStackTraces: false,
    maxMessageSize: 10000,
    destinations: [],
    reportErrors: false
  };

  /**
   * Creates a new NoOpLoggerAdapter instance.
   * @param config - Optional configuration options.
   */
  constructor(config?: Partial<LoggerConfiguration>) {
    if (config) {
      this.updateConfiguration(config);
    }
  }

  trace(message: string, context?: LogContext | unknown): void {
    // No-op
  }

  debug(message: string, context?: LogContext | unknown): void {
    // No-op
  }

  info(message: string, context?: LogContext | unknown): void {
    // No-op
  }

  warn(message: string, context?: LogContext | unknown): void {
    // No-op
  }

  error(message: string, errorOrContext?: Error | LogContext | unknown, context?: LogContext | unknown): void {
    // No-op
  }

  fatal(message: string, errorOrContext?: Error | LogContext | unknown, context?: LogContext | unknown): void {
    // No-op
  }

  logEntry(entry: LogEntry): void {
    // No-op
  }

  child(context: LogContext): ILoggerAdapter {
    return this;
  }

  forComponent(component: string): ILoggerAdapter {
    return this;
  }

  forRequest(requestId: string, additionalContext?: LogContext): ILoggerAdapter {
    return this;
  }

  getLogLevel(): LogLevel {
    return this.configuration.level || LogLevel.NONE;
  }

  setLogLevel(level: LogLevel): void {
    this.configuration.level = level;
  }

  isLevelEnabled(level: LogLevel): boolean {
    return false; // Always disabled
  }

  getConfiguration(): LoggerConfiguration {
    return { ...this.configuration };
  }

  updateConfiguration(config: Partial<LoggerConfiguration>): LoggerConfiguration {
    this.configuration = { ...this.configuration, ...config };
    return this.getConfiguration();
  }

  startTimer(operation: string, context?: LogContext): { 
    stop: (result?: string, additionalContext?: LogContext) => number,
    log: (level: LogLevel, message: string, additionalContext?: LogContext) => number 
  } {
    const startTime = Date.now();
    
    return {
      stop: (result?: string, additionalContext?: LogContext): number => {
        return Date.now() - startTime;
      },
      log: (level: LogLevel, message: string, additionalContext?: LogContext): number => {
        return Date.now() - startTime;
      }
    };
  }
} 