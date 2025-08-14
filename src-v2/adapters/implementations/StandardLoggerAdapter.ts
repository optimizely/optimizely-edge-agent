import { 
  ILoggerAdapter, 
  LogLevel, 
  LogContext, 
  LogEntry, 
  LoggerConfiguration 
} from '../interfaces/ILoggerAdapter';
import { IEnvironmentAdapter } from '../interfaces/IEnvironmentAdapter';

/**
 * Standard implementation of ILoggerAdapter with structured logging support.
 * Uses console logging by default, but can be configured for different outputs.
 */
export class StandardLoggerAdapter implements ILoggerAdapter {
  private configuration: LoggerConfiguration;
  private readonly levelValues: Record<LogLevel, number> = {
    [LogLevel.TRACE]: 0,
    [LogLevel.DEBUG]: 1,
    [LogLevel.INFO]: 2,
    [LogLevel.WARN]: 3,
    [LogLevel.ERROR]: 4,
    [LogLevel.FATAL]: 5,
    [LogLevel.NONE]: 6
  };

  /**
   * Creates a new StandardLoggerAdapter instance.
   * @param environmentAdapter - Optional environment adapter to read configuration from.
   * @param config - Optional configuration options.
   */
  constructor(
    environmentAdapter?: IEnvironmentAdapter,
    config?: Partial<LoggerConfiguration>
  ) {
    // Default configuration
    this.configuration = {
      level: LogLevel.INFO,
      enableStructuredLogs: true,
      includeSensitiveData: false,
      maskSensitiveData: true,
      format: 'json',
      redactFields: ['password', 'token', 'secret', 'key', 'authorization'],
      globalContext: {},
      includeStackTraces: true,
      useColors: true,
      maxMessageSize: 10000,
      destinations: ['console'],
      reportErrors: false
    };

    // Apply environment configuration if available
    if (environmentAdapter) {
      this.applyEnvironmentConfig(environmentAdapter);
    }

    // Apply provided configuration override
    if (config) {
      this.updateConfiguration(config);
    }

    this.debug(`StandardLoggerAdapter initialized with level: ${this.configuration.level}`);
  }

  /**
   * Applies configuration from environment variables.
   * @param env - Environment adapter to read variables from.
   */
  private applyEnvironmentConfig(env: IEnvironmentAdapter): void {
    // Read log level from environment
    const envLogLevel = env.getVariable('LOG_LEVEL');
    if (envLogLevel && this.isValidLogLevel(envLogLevel)) {
      this.configuration.level = envLogLevel as LogLevel;
    }

    // Read structured logging setting
    const structuredLogs = env.getVariable('STRUCTURED_LOGS');
    if (structuredLogs) {
      this.configuration.enableStructuredLogs = structuredLogs.toLowerCase() === 'true';
    }

    // Read log format
    const logFormat = env.getVariable('LOG_FORMAT');
    if (logFormat && (logFormat.toLowerCase() === 'json' || logFormat.toLowerCase() === 'text')) {
      this.configuration.format = logFormat.toLowerCase() as 'json' | 'text';
    }

    // Read sensitive data inclusion setting
    const includeSensitiveData = env.getVariable('LOG_INCLUDE_SENSITIVE_DATA');
    if (includeSensitiveData) {
      this.configuration.includeSensitiveData = includeSensitiveData.toLowerCase() === 'true';
    }
  }

  /**
   * Checks if a string is a valid log level.
   * @param level - The level to check.
   * @returns True if valid.
   */
  private isValidLogLevel(level: string): level is LogLevel {
    return Object.values(LogLevel).includes(level as LogLevel);
  }

  /**
   * Determines if a log level should be logged based on the current configuration.
   * @param level - The level to check.
   * @returns True if the level should be logged.
   */
  isLevelEnabled(level: LogLevel): boolean {
    return this.levelValues[level] >= this.levelValues[this.configuration.level];
  }

  /**
   * Creates a structured log entry.
   * @param level - Log level.
   * @param message - Log message.
   * @param optionalParams - Optional parameters (error, context, etc.).
   * @returns A structured log entry.
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    ...optionalParams: unknown[]
  ): LogEntry {
    // Create base entry
    const entry: LogEntry = {
      level,
      message: String(message).substring(0, this.configuration.maxMessageSize || 10000),
      timestamp: new Date().toISOString(),
      context: { ...this.configuration.globalContext }
    };

    // Handle optional parameters
    for (const param of optionalParams) {
      if (!param) continue;

      // Handle errors
      if (param instanceof Error) {
        entry.error = {
          name: param.name,
          message: param.message
        };

        if (this.configuration.includeStackTraces) {
          entry.error.stack = param.stack;
        }

        // Extract additional properties from the error
        const errorObj = param as Record<string, any>;
        for (const key of Object.getOwnPropertyNames(errorObj)) {
          if (key !== 'name' && key !== 'message' && key !== 'stack') {
            entry.error[key] = errorObj[key];
          }
        }
      }
      // Handle context objects
      else if (typeof param === 'object' && !Array.isArray(param)) {
        entry.context = { 
          ...entry.context, 
          ...this.sanitizeContext(param as Record<string, any>) 
        };
      }
      // Handle everything else as additional data
      else {
        if (!entry.additionalData) {
          entry.additionalData = [];
        }
        entry.additionalData.push(param);
      }
    }

    return entry;
  }

  /**
   * Sanitizes context data by masking sensitive fields.
   * @param context - The context to sanitize.
   * @returns Sanitized context.
   */
  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    if (!context) return {};
    
    // If including sensitive data, just return the context as is
    if (this.configuration.includeSensitiveData) {
      return { ...context };
    }

    const result: Record<string, any> = {};
    const redactFields = this.configuration.redactFields || [];

    for (const [key, value] of Object.entries(context)) {
      // Skip undefined values
      if (value === undefined) continue;

      // Check if this is a sensitive field that should be masked
      const shouldMask = redactFields.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      );

      if (shouldMask && this.configuration.maskSensitiveData) {
        if (typeof value === 'string') {
          // Mask string values (e.g., "abc123" -> "a***3")
          if (value.length <= 2) {
            result[key] = '***';
          } else {
            result[key] = `${value.substring(0, 1)}***${value.substring(value.length - 1)}`;
          }
        } else if (typeof value === 'object' && value !== null) {
          // For objects, indicate it's redacted
          result[key] = '[REDACTED]';
        } else {
          // For other types, just indicate it's redacted
          result[key] = '[REDACTED]';
        }
      } 
      // Recursively sanitize nested objects
      else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.sanitizeContext(value);
      } 
      // Pass through other values
      else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Formats a log entry for output.
   * @param entry - The log entry to format.
   * @returns Formatted log string or object.
   */
  private formatLogEntry(entry: LogEntry): string | object {
    if (this.configuration.format === 'json') {
      return entry;
    }

    // Text format
    const timestamp = entry.timestamp.split('T')[1].replace('Z', '');
    const levelPadded = entry.level.toUpperCase().padEnd(5, ' ');
    
    let text = `${timestamp} ${levelPadded} ${entry.message}`;
    
    // Add context if available
    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = Object.entries(entry.context)
        .map(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            return `${key}=${JSON.stringify(value)}`;
          }
          return `${key}=${value}`;
        })
        .join(' ');
      
      text += ` [${contextStr}]`;
    }
    
    // Add error if available
    if (entry.error) {
      text += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      
      if (entry.error.stack && this.configuration.includeStackTraces) {
        text += `\n  Stack: ${entry.error.stack}`;
      }
    }
    
    return text;
  }

  /**
   * Writes a log entry to all configured destinations.
   * @param entry - The log entry to write.
   */
  private writeLogEntry(entry: LogEntry): void {
    if (!this.isLevelEnabled(entry.level)) {
      return;
    }

    // Format the entry
    const formattedEntry = this.formatLogEntry(entry);
    
    // Write to console if enabled
    if (this.configuration.destinations?.includes('console')) {
      this.writeToConsole(entry.level, formattedEntry);
    }
    
    // Additional destinations could be implemented here
  }

  /**
   * Writes a log entry to the console.
   * @param level - The log level.
   * @param entry - The formatted entry.
   */
  private writeToConsole(level: LogLevel, entry: string | object): void {
    switch (level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(entry);
        break;
      case LogLevel.INFO:
        console.info(entry);
        break;
      case LogLevel.WARN:
        console.warn(entry);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(entry);
        break;
    }
  }

  // ILoggerAdapter implementation

  trace(message: string, context?: LogContext | unknown): void {
    const entry = this.createLogEntry(LogLevel.TRACE, message, context);
    this.writeLogEntry(entry);
  }

  debug(message: string, context?: LogContext | unknown): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, context);
    this.writeLogEntry(entry);
  }

  info(message: string, context?: LogContext | unknown): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, context);
    this.writeLogEntry(entry);
  }

  warn(message: string, context?: LogContext | unknown): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, context);
    this.writeLogEntry(entry);
  }

  error(
    message: string, 
    errorOrContext?: Error | LogContext | unknown, 
    context?: LogContext | unknown
  ): void {
    let errorObj: Error | undefined;
    let contextObj: LogContext | unknown = context;

    // Handle the case where the second parameter is an error
    if (errorOrContext instanceof Error) {
      errorObj = errorOrContext;
    } 
    // Handle the case where the second parameter is context and no third parameter
    else if (errorOrContext && !context) {
      contextObj = errorOrContext;
    }
    // Handle the case where both errorOrContext and context are provided
    else if (errorOrContext && context) {
      if (errorOrContext instanceof Error) {
        errorObj = errorOrContext;
        contextObj = context;
      } else {
        // Merge the contexts
        contextObj = {
          ...(errorOrContext as object),
          ...(context as object)
        };
      }
    }

    const entry = this.createLogEntry(LogLevel.ERROR, message, errorObj, contextObj);
    this.writeLogEntry(entry);
  }

  fatal(
    message: string, 
    errorOrContext?: Error | LogContext | unknown, 
    context?: LogContext | unknown
  ): void {
    let errorObj: Error | undefined;
    let contextObj: LogContext | unknown = context;

    // Handle the case where the second parameter is an error
    if (errorOrContext instanceof Error) {
      errorObj = errorOrContext;
    } 
    // Handle the case where the second parameter is context and no third parameter
    else if (errorOrContext && !context) {
      contextObj = errorOrContext;
    }
    // Handle the case where both errorOrContext and context are provided
    else if (errorOrContext && context) {
      if (errorOrContext instanceof Error) {
        errorObj = errorOrContext;
        contextObj = context;
      } else {
        // Merge the contexts
        contextObj = {
          ...(errorOrContext as object),
          ...(context as object)
        };
      }
    }

    const entry = this.createLogEntry(LogLevel.FATAL, message, errorObj, contextObj);
    this.writeLogEntry(entry);
  }

  logEntry(entry: LogEntry): void {
    this.writeLogEntry(entry);
  }

  child(context: LogContext): ILoggerAdapter {
    const childLogger = new StandardLoggerAdapter(undefined, this.getConfiguration());
    
    // Merge the contexts
    const mergedContext = {
      ...this.configuration.globalContext,
      ...context
    };
    
    childLogger.updateConfiguration({
      globalContext: mergedContext
    });
    
    return childLogger;
  }

  forComponent(component: string): ILoggerAdapter {
    return this.child({ component });
  }

  forRequest(requestId: string, additionalContext?: LogContext): ILoggerAdapter {
    return this.child({
      requestId,
      ...additionalContext
    });
  }

  getLogLevel(): LogLevel {
    return this.configuration.level;
  }

  setLogLevel(level: LogLevel): void {
    if (level in LogLevel) {
      const oldLevel = this.configuration.level;
      this.configuration.level = level;
      
      if (this.isLevelEnabled(LogLevel.DEBUG)) {
        this.debug(`Log level changed from ${oldLevel} to ${level}`);
      }
    } else {
      this.warn(`Attempted to set invalid log level: ${level}`);
    }
  }

  getConfiguration(): LoggerConfiguration {
    return { ...this.configuration };
  }

  updateConfiguration(config: Partial<LoggerConfiguration>): LoggerConfiguration {
    this.configuration = { ...this.configuration, ...config };
    return this.getConfiguration();
  }

  startTimer(
    operation: string, 
    context?: LogContext
  ): { 
    stop: (result?: string, additionalContext?: LogContext) => number,
    log: (level: LogLevel, message: string, additionalContext?: LogContext) => number 
  } {
    const startTime = Date.now();
    const baseContext: LogContext = {
      operation,
      ...context
    };
    
    return {
      stop: (result?: string, additionalContext?: LogContext): number => {
        const duration = Date.now() - startTime;
        
        // Only log if debug level is enabled
        if (this.isLevelEnabled(LogLevel.DEBUG)) {
          this.debug(`Operation "${operation}" completed in ${duration}ms${result ? `: ${result}` : ''}`, {
            ...baseContext,
            ...additionalContext,
            durationMs: duration,
            result
          });
        }
        
        return duration;
      },
      
      log: (level: LogLevel, message: string, additionalContext?: LogContext): number => {
        const duration = Date.now() - startTime;
        
        // Use switch statement instead of indexing the class
        switch (level) {
          case LogLevel.TRACE:
            this.trace(message, {
              ...baseContext,
              ...additionalContext,
              durationMs: duration
            });
            break;
          case LogLevel.DEBUG:
            this.debug(message, {
              ...baseContext,
              ...additionalContext,
              durationMs: duration
            });
            break;
          case LogLevel.INFO:
            this.info(message, {
              ...baseContext,
              ...additionalContext,
              durationMs: duration
            });
            break;
          case LogLevel.WARN:
            this.warn(message, {
              ...baseContext,
              ...additionalContext,
              durationMs: duration
            });
            break;
          case LogLevel.ERROR:
            this.error(message, {
              ...baseContext,
              ...additionalContext,
              durationMs: duration
            });
            break;
          case LogLevel.FATAL:
            this.fatal(message, {
              ...baseContext,
              ...additionalContext,
              durationMs: duration
            });
            break;
        }
        
        return duration;
      }
    };
  }
} 