import { ILoggerAdapter, LogLevel, LogContext, LogEntry, LoggerConfiguration } from "../../interfaces/ILoggerAdapter";
import { IEnvironmentAdapter } from "../../interfaces/IEnvironmentAdapter";

/**
 * Cloudflare-specific implementation of ILoggerAdapter.
 * Uses the standard console object and respects LOG_LEVEL environment variable.
 */
export class CloudflareLoggerAdapter implements ILoggerAdapter {
  private currentLevel: LogLevel = LogLevel.INFO; // Default level
  private levelValues: Record<LogLevel, number> = {
    [LogLevel.TRACE]: 0,
    [LogLevel.DEBUG]: 1,
    [LogLevel.INFO]: 2,
    [LogLevel.WARN]: 3,
    [LogLevel.ERROR]: 4,
    [LogLevel.FATAL]: 5,
    [LogLevel.NONE]: 6
  };
  private globalContext: LogContext = {};
  private configuration: LoggerConfiguration = {
    level: LogLevel.INFO,
    enableStructuredLogs: false,
    maskSensitiveData: true,
    format: 'text',
    useColors: false,
    includeStackTraces: true
  };

  /**
   * Creates an instance of the logger adapter.
   * Reads LOG_LEVEL from the environment adapter if available.
   * @param environmentAdapter - Optional environment adapter to read log level.
   */
  constructor(environmentAdapter?: IEnvironmentAdapter) {
    const envLogLevel = environmentAdapter?.getVariable('LOG_LEVEL')?.toLowerCase();
    if (envLogLevel && this.isValidLogLevel(envLogLevel)) {
      this.currentLevel = envLogLevel as LogLevel;
      this.configuration.level = envLogLevel as LogLevel;
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

  trace(message: string, context?: LogContext | unknown): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      console.debug(...this.formatMessage(LogLevel.TRACE, message, context));
    }
  }

  debug(message: string, context?: LogContext | unknown): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(...this.formatMessage(LogLevel.DEBUG, message, context));
    }
  }

  info(message: string, context?: LogContext | unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(...this.formatMessage(LogLevel.INFO, message, context));
    }
  }

  warn(message: string, context?: LogContext | unknown): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(...this.formatMessage(LogLevel.WARN, message, context));
    }
  }

  error(message: string, errorOrContext?: Error | LogContext | unknown, context?: LogContext | unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      let logData: unknown;
      if (errorOrContext instanceof Error) {
        logData = context || { error: errorOrContext };
      } else {
        logData = errorOrContext || {};
      }
      console.error(...this.formatMessage(LogLevel.ERROR, message, logData));
    }
  }

  fatal(message: string, errorOrContext?: Error | LogContext | unknown, context?: LogContext | unknown): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      let logData: unknown;
      if (errorOrContext instanceof Error) {
        logData = context || { error: errorOrContext };
      } else {
        logData = errorOrContext || {};
      }
      console.error(...this.formatMessage(LogLevel.FATAL, message, logData));
    }
  }

  logEntry(entry: LogEntry): void {
    const level = entry.level || LogLevel.INFO;
    if (this.shouldLog(level)) {
      if (this.configuration.format === 'json') {
        console.log(JSON.stringify(entry));
      } else {
        const prefix = `[${level.toUpperCase()}][${entry.timestamp || new Date().toISOString()}]`;
        if (entry.error) {
          console.error(prefix, entry.message, entry.error, entry.context || {});
        } else {
          console.log(prefix, entry.message, entry.context || {});
        }
      }
    }
  }

  child(context: LogContext): ILoggerAdapter {
    const childLogger = new CloudflareLoggerAdapter();
    childLogger.globalContext = { ...this.globalContext, ...context };
    childLogger.configuration = { ...this.configuration };
    childLogger.currentLevel = this.currentLevel;
    return childLogger;
  }

  forComponent(component: string): ILoggerAdapter {
    return this.child({ component });
  }

  forRequest(requestId: string, additionalContext?: LogContext): ILoggerAdapter {
    return this.child({ requestId, ...(additionalContext || {}) });
  }

  getLogLevel(): LogLevel {
    return this.currentLevel;
  }

  setLogLevel(level: LogLevel): void {
    if (this.isValidLogLevel(level)) {
      console.log(`[CloudflareLoggerAdapter] Log level changed from ${this.currentLevel} to ${level}`);
      this.currentLevel = level;
      this.configuration.level = level;
    } else {
      console.warn(`[CloudflareLoggerAdapter] Attempted to set invalid log level: ${level}`);
    }
  }

  isLevelEnabled(level: LogLevel): boolean {
    return this.shouldLog(level);
  }

  getConfiguration(): LoggerConfiguration {
    return { ...this.configuration };
  }

  updateConfiguration(config: Partial<LoggerConfiguration>): LoggerConfiguration {
    this.configuration = { ...this.configuration, ...config };
    if (config.level) {
      this.setLogLevel(config.level);
    }
    return { ...this.configuration };
  }

  startTimer(operation: string, context?: LogContext): { 
    stop: (result?: string, additionalContext?: LogContext) => number,
    log: (level: LogLevel, message: string, additionalContext?: LogContext) => number 
  } {
    const startTime = Date.now();
    const logContext = { ...this.globalContext, ...(context || {}), operation };
    
    return {
      stop: (result?: string, additionalContext?: LogContext) => {
        const duration = Date.now() - startTime;
        const finalContext = { 
          ...logContext, 
          ...(additionalContext || {}), 
          durationMs: duration, 
          result 
        };
        
        this.info(`Operation ${operation} completed in ${duration}ms${result ? `: ${result}` : ''}`, finalContext);
        return duration;
      },
      log: (level: LogLevel, message: string, additionalContext?: LogContext) => {
        const duration = Date.now() - startTime;
        const finalContext = { 
          ...logContext, 
          ...(additionalContext || {}), 
          durationMs: duration 
        };
        
        switch (level) {
          case LogLevel.TRACE:
            this.trace(message, finalContext);
            break;
          case LogLevel.DEBUG:
            this.debug(message, finalContext);
            break;
          case LogLevel.INFO:
            this.info(message, finalContext);
            break;
          case LogLevel.WARN:
            this.warn(message, finalContext);
            break;
          case LogLevel.ERROR:
            this.error(message, finalContext);
            break;
          case LogLevel.FATAL:
            this.fatal(message, finalContext);
            break;
          default:
            this.info(message, finalContext);
        }
        
        return duration;
      }
    };
  }
} 