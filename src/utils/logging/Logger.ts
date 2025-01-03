/**
 * @module Logger
 *
 * The Logger class is a singleton that provides a unified interface for logging messages.
 * It is used to abstract the specifics of how the logging is implemented.
 */

export type LogLevel = 'debugExt' | 'debug' | 'info' | 'warning' | 'error';

export interface LogLevels {
    debugExt: number;
    debug: number;
    info: number;
    warning: number;
    error: number;
}

export interface LoggerEnvironment {
    LOG_LEVEL?: LogLevel;
}

const defaultSettings = {
    logLevel: 'info' as LogLevel
};

/**
 * Class representing a singleton logger.
 * Ensures a single logger instance across the application.
 */
export class Logger {
    private static instance: Logger;
    private env: LoggerEnvironment;
    private level: LogLevel;
    private levels: LogLevels;

    private constructor(env: LoggerEnvironment, defaultLevel: LogLevel = 'info') {
        this.env = env;
        if (Logger.instance) {
            return Logger.instance;
        }
        
        if (env && env.LOG_LEVEL) {
            this.level = env.LOG_LEVEL;
        } else {
            this.level = defaultSettings.logLevel || defaultLevel;
        }

        this.levels = {
            debugExt: 4,
            debug: 3,
            info: 2,
            warning: 1.5,
            error: 1,
        };

        Logger.instance = this;
    }

    /**
     * Sets the logging level of the logger.
     * @param level - The logging level to set ('debugExt', 'debug', 'info', 'warning', 'error').
     * @throws {Error} Throws an error if an invalid logging level is provided.
     */
    public setLevel(level: LogLevel): void {
        if (!(level in this.levels)) {
            throw new Error(`Invalid logging level: ${level}`);
        }
        this.level = level;
    }

    /**
     * Gets the current logging level of the logger.
     * @returns The current logging level.
     */
    public getLevel(): LogLevel {
        return this.level;
    }

    /**
     * Checks if the specified logging level should currently output.
     * @param level - The logging level to check.
     * @returns Returns true if the logging should occur, false otherwise.
     */
    private shouldLog(level: LogLevel): boolean {
        return this.levels[level] <= this.levels[this.level];
    }

    /**
     * Formats the log messages.
     * @param messages - The messages to format.
     * @returns The formatted log message.
     */
    private formatMessages(...messages: any[]): string {
        return messages
            .map(msg => {
                if (typeof msg === 'object') {
                    return JSON.stringify(msg);
                }
                return String(msg);
            })
            .join(' ');
    }

    /**
     * Logs a detailed debug message if the current level allows for debugExt messages.
     * @param messages - The messages to log.
     */
    public debugExt(...messages: any[]): void {
        if (this.shouldLog('debugExt')) {
            console.debug(this.formatMessages(...messages));
        }
    }

    /**
     * Logs a debug message if the current level allows for debug messages.
     * @param messages - The messages to log.
     */
    public debug(...messages: any[]): void {
        if (this.shouldLog('debug')) {
            console.debug(this.formatMessages(...messages));
        }
    }

    /**
     * Logs an informational message if the current level allows for info messages.
     * @param messages - The messages to log.
     */
    public info(...messages: any[]): void {
        if (this.shouldLog('info')) {
            console.info(this.formatMessages(...messages));
        }
    }

    /**
     * Logs a warning message if the current level allows for warning messages.
     * @param messages - The messages to log.
     */
    public warning(...messages: any[]): void {
        if (this.shouldLog('warning')) {
            console.warn(this.formatMessages(...messages));
        }
    }

    /**
     * Logs an error message using console.error if the current level allows for error messages.
     * @param messages - The messages to log.
     */
    public error(...messages: any[]): void {
        if (this.shouldLog('error')) {
            console.error(this.formatMessages(...messages));
        }
    }

    /**
     * Returns the singleton instance of the Logger.
     * @param env - The environment object containing the LOG_LEVEL variable.
     * @param defaultLevel - The default logging level.
     * @returns The singleton instance of the Logger.
     */
    public static getInstance(env: LoggerEnvironment, defaultLevel: LogLevel = 'info'): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(env, defaultLevel);
        }
        return Logger.instance;
    }
}
