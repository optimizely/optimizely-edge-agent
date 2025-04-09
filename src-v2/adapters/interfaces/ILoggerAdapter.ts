/**
 * @enum LogLevel
 * @description Defines standard logging levels in order of increasing severity.
 */
export enum LogLevel {
  TRACE = 'trace',  // Most detailed level for high-volume or noisy events
  DEBUG = 'debug',  // Detailed information for debugging
  INFO = 'info',    // General informational messages
  WARN = 'warn',    // Potentially harmful situations
  ERROR = 'error',  // Error events that might still allow the application to continue
  FATAL = 'fatal',  // Very severe errors that will likely lead to application termination
  NONE = 'none'     // Special level that can be used to disable logging entirely
}

/**
 * @interface LogContext
 * @description Structured context information for log entries.
 */
export interface LogContext {
  /**
   * Unique ID for the request being processed
   */
  requestId?: string;

  /**
   * User or visitor ID associated with the request
   */
  visitorId?: string;

  /**
   * SDK key being used (usually masked for security)
   */
  sdkKey?: string;

  /**
   * Current operation being performed
   */
  operation?: string;

  /**
   * Flag key being evaluated, if applicable
   */
  flagKey?: string;

  /**
   * Experiment key, if applicable
   */
  experimentKey?: string;

  /**
   * Duration of the operation in milliseconds
   */
  durationMs?: number;

  /**
   * HTTP method of the request
   */
  method?: string;

  /**
   * URL path of the request
   */
  path?: string;

  /**
   * HTTP status code of the response
   */
  statusCode?: number;

  /**
   * Specific component or service generating the log
   */
  component?: string;

  /**
   * Stack trace for error logs
   */
  stack?: string;

  /**
   * Any additional contextual data
   */
  [key: string]: any;
}

/**
 * @interface LogEntry
 * @description Structured log entry with standardized fields.
 */
export interface LogEntry {
  /**
   * Log level
   */
  level: LogLevel;

  /**
   * Primary log message
   */
  message: string;

  /**
   * ISO 8601 timestamp
   */
  timestamp: string;

  /**
   * Structured context data
   */
  context?: LogContext;

  /**
   * Error object, if applicable
   */
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    [key: string]: any;
  };

  /**
   * Any additional metadata
   */
  [key: string]: any;
}

/**
 * @interface LoggerConfiguration
 * @description Configuration options for the logger adapter.
 */
export interface LoggerConfiguration {
  /**
   * Minimum log level to record
   */
  level: LogLevel;

  /**
   * Whether to use structured logging format
   */
  enableStructuredLogs?: boolean;

  /**
   * Whether to include potentially sensitive data in logs
   */
  includeSensitiveData?: boolean;

  /**
   * Whether to mask sensitive data (e.g., SDK keys, visitor IDs)
   */
  maskSensitiveData?: boolean;

  /**
   * Log format (json or text)
   */
  format?: 'json' | 'text';

  /**
   * Names of fields to redact
   */
  redactFields?: string[];

  /**
   * Global context to include with all logs
   */
  globalContext?: LogContext;

  /**
   * Whether to include stack traces for errors
   */
  includeStackTraces?: boolean;

  /**
   * Whether to highlight or colorize console output (for text format)
   */
  useColors?: boolean;

  /**
   * Maximum log message size (to prevent massive logs)
   */
  maxMessageSize?: number;

  /**
   * Additional log destinations beyond console
   */
  destinations?: ('console' | 'file' | 'remote')[];

  /**
   * Whether to report errors to an error tracking service
   */
  reportErrors?: boolean;
}

/**
 * @interface ILoggerAdapter
 * @description Defines the contract for a logging mechanism with structured logging support,
 * abstracting specific implementations (e.g., console, remote logging service).
 */
export interface ILoggerAdapter {
  /**
   * Logs a message at TRACE level (most detailed).
   * @param message - The primary message.
   * @param context - Optional context data.
   */
  trace(message: string, context?: LogContext | unknown): void;

  /**
   * Logs a DEBUG message.
   * @param message - The primary message.
   * @param context - Optional context data.
   */
  debug(message: string, context?: LogContext | unknown): void;

  /**
   * Logs an INFO message.
   * @param message - The primary message.
   * @param context - Optional context data.
   */
  info(message: string, context?: LogContext | unknown): void;

  /**
   * Logs a WARN message.
   * @param message - The primary message.
   * @param context - Optional context data.
   */
  warn(message: string, context?: LogContext | unknown): void;

  /**
   * Logs an ERROR message.
   * @param message - The primary message.
   * @param errorOrContext - Optional error object or context data.
   * @param context - Optional additional context when error is provided.
   */
  error(message: string, errorOrContext?: Error | LogContext | unknown, context?: LogContext | unknown): void;

  /**
   * Logs a FATAL message (severe errors that likely lead to application termination).
   * @param message - The primary message.
   * @param errorOrContext - Optional error object or context data.
   * @param context - Optional additional context when error is provided.
   */
  fatal(message: string, errorOrContext?: Error | LogContext | unknown, context?: LogContext | unknown): void;

  /**
   * Logs a structured entry directly.
   * @param entry - The structured log entry.
   */
  logEntry(entry: LogEntry): void;

  /**
   * Creates a new logger with additional context that will be included with all log messages.
   * @param context - Context to include with all logs from the child logger.
   * @returns A new logger with the combined context.
   */
  child(context: LogContext): ILoggerAdapter;

  /**
   * Creates a logger for a specific component.
   * @param component - Component name to include in logs.
   * @returns A logger with the component context set.
   */
  forComponent(component: string): ILoggerAdapter;

  /**
   * Creates a logger for a specific request.
   * @param requestId - Request ID to include in logs.
   * @param additionalContext - Additional context for the request.
   * @returns A logger with the request context set.
   */
  forRequest(requestId: string, additionalContext?: LogContext): ILoggerAdapter;

  /**
   * Gets the current log level.
   * @returns The current log level.
   */
  getLogLevel(): LogLevel;

  /**
   * Sets the minimum log level.
   * @param level - The minimum level to log.
   */
  setLogLevel(level: LogLevel): void;

  /**
   * Checks if a given log level would be logged.
   * @param level - The log level to check.
   * @returns True if the level would be logged.
   */
  isLevelEnabled(level: LogLevel): boolean;

  /**
   * Gets the current logger configuration.
   * @returns The current configuration.
   */
  getConfiguration(): LoggerConfiguration;

  /**
   * Updates the logger configuration.
   * @param config - New configuration options (partial).
   * @returns The updated configuration.
   */
  updateConfiguration(config: Partial<LoggerConfiguration>): LoggerConfiguration;

  /**
   * Creates a timer for measuring operation duration.
   * @param operation - Name of the operation being timed.
   * @param context - Additional context for the timer.
   * @returns A function that, when called, logs the duration and returns it.
   */
  startTimer(operation: string, context?: LogContext): { 
    stop: (result?: string, additionalContext?: LogContext) => number,
    log: (level: LogLevel, message: string, additionalContext?: LogContext) => number 
  };
} 