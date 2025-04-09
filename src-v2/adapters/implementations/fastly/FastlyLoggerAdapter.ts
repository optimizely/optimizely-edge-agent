import { IEnvironmentAdapter } from "../../interfaces/IEnvironmentAdapter";
import { ILoggerAdapter, LogLevel } from "../../interfaces/ILoggerAdapter";

/**
 * Fastly-specific implementation of ILoggerAdapter.
 * Adapts logging to Fastly's Compute@Edge environment.
 */
export class FastlyLoggerAdapter implements ILoggerAdapter {
  private environmentAdapter: IEnvironmentAdapter;
  private logLevel: LogLevel = LogLevel.INFO; // Default log level

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
  }

  /**
   * Initializes the log level from environment variables.
   */
  private initializeLogLevel(): void {
    const configuredLevel = this.environmentAdapter.getVariable('LOG_LEVEL');
    if (configuredLevel) {
      switch (configuredLevel.toLowerCase()) {
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
        default:
          // Keep default (INFO) if invalid
          console.warn(`Unknown log level: ${configuredLevel}, using default (INFO).`);
      }
    }
  }

  /**
   * Checks if the specified log level should be logged based on the current log level.
   * @param level - The level to check.
   * @returns True if the level should be logged, false otherwise.
   */
  private isLevelEnabled(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
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
      // In Fastly, we might need to use a specific logging endpoint or format
      // For now, using console.debug as a fallback
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
  }
} 