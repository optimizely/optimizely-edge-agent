import { IEnvironmentAdapter } from "../../interfaces/IEnvironmentAdapter";
import { ILoggerAdapter, LogLevel, LogContext, LogEntry, LoggerConfiguration } from "../../interfaces/ILoggerAdapter";

/**
 * Vercel-specific implementation of ILoggerAdapter.
 * Adapts logging to Vercel's edge environment.
 */
export class VercelLoggerAdapter implements ILoggerAdapter {
  private environmentAdapter: IEnvironmentAdapter;
  private logLevel: LogLevel = LogLevel.INFO;
  private configuration: LoggerConfiguration;
  private globalContext: LogContext = {};

  /**
   * Creates an instance of the adapter.
   * @param environmentAdapter - The environment adapter to get configuration from.
   */
  constructor(environmentAdapter: IEnvironmentAdapter) {
    if (!environmentAdapter) {
      throw new Error("Environment adapter cannot be null or undefined.");
    }
    this.environmentAdapter = environmentAdapter;
    this.initializeLogLevel();
    this.configuration = {
      level: this.logLevel,
      format: 'json',
      enableStructuredLogs: true,
      maskSensitiveData: true,
      includeStackTraces: true
    };
  }

  /**
   * Initializes the log level from environment variables.
   */
  private initializeLogLevel(): void {
    const configuredLevel = this.environmentAdapter.getVariable('LOG_LEVEL') || 
                          this.environmentAdapter.getVariable('OPTIMIZELY_LOG_LEVEL');
    if (configuredLevel) {
      switch (configuredLevel.toLowerCase()) {
        case 'trace':
          this.logLevel = LogLevel.TRACE;
          break;
        case 'debug':
          this.logLevel = LogLevel.DEBUG;
          break;
        case 'info':
          this.logLevel = LogLevel.INFO;
          break;
        case 'warn':
          this.logLevel = LogLevel.WARN;
          break;
        case 'error':
          this.logLevel = LogLevel.ERROR;
          break;
        case 'fatal':
          this.logLevel = LogLevel.FATAL;
          break;
        case 'none':
          this.logLevel = LogLevel.NONE;
          break;
        default:
          console.warn(`Unknown log level: ${configuredLevel}, using default (INFO).`);
      }
    }
  }

  /**
   * Checks if the specified log level should be logged based on the current log level.
   * @param level - The level to check.
   * @returns True if the level should be logged, false otherwise.
   */
  isLevelEnabled(level: LogLevel): boolean {
    if (this.logLevel === LogLevel.NONE) return false;
    const levels = [LogLevel.TRACE, LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const targetLevelIndex = levels.indexOf(level);
    return targetLevelIndex >= currentLevelIndex;
  }

  /**
   * Formats a log message with metadata.
   * @param message - The log message.
   * @param metadata - Optional metadata to include.
   * @returns The formatted message.
   */
  private formatMessage(message: string, metadata?: unknown): string {
    if (!metadata) return message;
    
    try {
      const metadataStr = typeof metadata === 'string' 
        ? metadata 
        : JSON.stringify(metadata);
      return `${message} ${metadataStr}`;
    } catch (error) {
      return `${message} [Metadata serialization error: ${error}]`;
    }
  }

  debug(message: string, metadata?: unknown): void {
    if (this.isLevelEnabled(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(message, metadata));
    }
  }

  info(message: string, metadata?: unknown): void {
    if (this.isLevelEnabled(LogLevel.INFO)) {
      console.info(this.formatMessage(message, metadata));
    }
  }

  warn(message: string, metadata?: unknown): void {
    if (this.isLevelEnabled(LogLevel.WARN)) {
      console.warn(this.formatMessage(message, metadata));
    }
  }

  error(message: string, error?: Error | unknown, metadata?: unknown): void {
    if (this.isLevelEnabled(LogLevel.ERROR)) {
      const formattedMessage = this.formatMessage(message, metadata);
      if (error instanceof Error) {
        console.error(`${formattedMessage}\n${error.stack || error.message}`);
      } else if (error) {
        console.error(formattedMessage, error);
      } else {
        console.error(formattedMessage);
      }
    }
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.configuration.level = level;
  }

  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  // Missing interface methods
  trace(message: string, context?: LogContext | unknown): void {
    if (this.isLevelEnabled(LogLevel.TRACE)) {
      console.debug(this.formatMessage(`[TRACE] ${message}`, context));
    }
  }

  fatal(message: string, errorOrContext?: Error | LogContext | unknown, context?: LogContext | unknown): void {
    if (this.isLevelEnabled(LogLevel.FATAL)) {
      const formattedMessage = this.formatMessage(`[FATAL] ${message}`, context);
      if (errorOrContext instanceof Error) {
        console.error(`${formattedMessage}\n${errorOrContext.stack || errorOrContext.message}`);
      } else if (errorOrContext) {
        console.error(this.formatMessage(`[FATAL] ${message}`, errorOrContext));
      } else {
        console.error(formattedMessage);
      }
    }
  }

  logEntry(entry: LogEntry): void {
    if (!this.isLevelEnabled(entry.level)) {
      return;
    }

    const formatted = this.configuration.format === 'json' 
      ? JSON.stringify(entry)
      : `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`;
    
    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
    }
  }

  child(context: LogContext): ILoggerAdapter {
    const childLogger = new VercelLoggerAdapter(this.environmentAdapter);
    childLogger.logLevel = this.logLevel;
    childLogger.configuration = { ...this.configuration };
    childLogger.globalContext = { ...this.globalContext, ...context };
    return childLogger;
  }

  forComponent(component: string): ILoggerAdapter {
    return this.child({ component });
  }

  forRequest(requestId: string, additionalContext?: LogContext): ILoggerAdapter {
    return this.child({ requestId, ...additionalContext });
  }

  getConfiguration(): LoggerConfiguration {
    return { ...this.configuration };
  }

  updateConfiguration(config: Partial<LoggerConfiguration>): LoggerConfiguration {
    this.configuration = { ...this.configuration, ...config };
    if (config.level) {
      this.logLevel = config.level;
    }
    return this.getConfiguration();
  }

  startTimer(operation: string, context?: LogContext): { 
    stop: (result?: string, additionalContext?: LogContext) => number,
    log: (level: LogLevel, message: string, additionalContext?: LogContext) => number 
  } {
    const startTime = Date.now();
    const timerContext = { operation, ...context };

    const stop = (result?: string, additionalContext?: LogContext) => {
      const duration = Date.now() - startTime;
      const finalContext = { ...timerContext, durationMs: duration, result, ...additionalContext };
      this.debug(`Operation '${operation}' completed in ${duration}ms`, finalContext);
      return duration;
    };

    const log = (level: LogLevel, message: string, additionalContext?: LogContext) => {
      const duration = Date.now() - startTime;
      const finalContext = { ...timerContext, durationMs: duration, ...additionalContext };
      
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
          this.error(message, undefined, finalContext);
          break;
        case LogLevel.FATAL:
          this.fatal(message, undefined, finalContext);
          break;
      }
      
      return duration;
    };

    return { stop, log };
  }
} 