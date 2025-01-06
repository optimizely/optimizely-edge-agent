/**
 * @module Logger
 *
 * The Logger class is a singleton that provides a unified interface for logging messages.
 * It is used to abstract the specifics of how the logging is implemented.
 */

export enum LogLevel {
	ERROR = 1,
	WARNING = 2,
	INFO = 3,
	DEBUG = 4,
}

export interface LogLevels {
	debug: number;
	info: number;
	warning: number;
	error: number;
}

export interface LoggerEnvironment {
	LOG_LEVEL?: LogLevel;
}

/**
 * Class representing a singleton logger.
 * Ensures a single logger instance across the application.
 */
export class Logger {
	private static instance: Logger;
	private readonly env: LoggerEnvironment;
	private level: LogLevel = LogLevel.INFO;
	// Cache for shouldLog results to avoid repeated comparisons
	private readonly logLevelCache = new Map<LogLevel, boolean>();

	private constructor(env: LoggerEnvironment, defaultLevel: LogLevel = LogLevel.INFO) {
		this.env = env;
		this.level = env?.LOG_LEVEL ?? defaultLevel;
		this.updateLogLevelCache();
	}

	/**
	 * Sets the logging level of the logger.
	 * @param level - The logging level to set
	 */
	public setLevel(level: LogLevel): void {
		this.level = level;
		this.updateLogLevelCache();
	}

	/**
	 * Gets the current logging level of the logger.
	 * @returns The current logging level.
	 */
	public getLevel(): LogLevel {
		return this.level;
	}

	/**
	 * Updates the cache of log level results
	 */
	private updateLogLevelCache(): void {
		this.logLevelCache.clear();
		for (let level = LogLevel.ERROR; level <= LogLevel.DEBUG; level++) {
			this.logLevelCache.set(level, level <= this.level);
		}
	}

	/**
	 * Checks if the specified logging level should currently output.
	 * @param level - The logging level to check.
	 * @returns Returns true if the logging should occur, false otherwise.
	 */
	private shouldLog(level: LogLevel): boolean {
		return this.logLevelCache.get(level) ?? false;
	}

	/**
	 * Formats a single message for logging with better type safety
	 * @param msg - The message to format
	 * @returns The formatted message
	 */
	private formatMessage(msg: unknown): string {
		if (msg === null) return 'null';
		if (msg === undefined) return 'undefined';
		
		if (typeof msg === 'object') {
			try {
				return JSON.stringify(msg);
			} catch {
				return String(msg);
			}
		}
		return String(msg);
	}

	/**
	 * Formats the log messages.
	 * @param messages - The messages to format.
	 * @returns The formatted log message.
	 */
	private formatMessages(messages: readonly unknown[]): string {
		// Preallocate array for better performance
		const formatted = new Array<string>(messages.length);
		for (let i = 0; i < messages.length; i++) {
			formatted[i] = this.formatMessage(messages[i]);
		}
		return formatted.join(' ');
	}

	/**
	 * Logs a debug message if the current level allows for debug messages.
	 * @param messages - The messages to log.
	 */
	public debug(...messages: unknown[]): void {
		if (this.shouldLog(LogLevel.DEBUG)) {
			console.debug(this.formatMessages(messages));
		}
	}

	/**
	 * Logs an informational message if the current level allows for info messages.
	 * @param messages - The messages to log.
	 */
	public info(...messages: unknown[]): void {
		if (this.shouldLog(LogLevel.INFO)) {
			console.info(this.formatMessages(messages));
		}
	}

	/**
	 * Logs a warning message if the current level allows for warning messages.
	 * @param messages - The messages to log.
	 */
	public warning(...messages: unknown[]): void {
		if (this.shouldLog(LogLevel.WARNING)) {
			console.warn(this.formatMessages(messages));
		}
	}

	/**
	 * Logs an error message using console.error if the current level allows for error messages.
	 * @param messages - The messages to log.
	 */
	public error(...messages: unknown[]): void {
		if (this.shouldLog(LogLevel.ERROR)) {
			console.error(this.formatMessages(messages));
		}
	}

	/**
	 * Returns the singleton instance of the Logger.
	 * @param env - The environment object containing the LOG_LEVEL variable.
	 * @param defaultLevel - The default logging level.
	 * @returns The singleton instance of the Logger.
	 */
	public static getInstance(
		env: LoggerEnvironment,
		defaultLevel: LogLevel = LogLevel.INFO,
	): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger(env, defaultLevel);
		} else if (env?.LOG_LEVEL) {
			Logger.instance.setLevel(env.LOG_LEVEL);
		}
		return Logger.instance;
	}
}
