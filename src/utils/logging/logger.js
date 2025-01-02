/**
 * @module Logger
 *
 * The Logger class is a singleton that provides a unified interface for logging messages.
 * It is used to abstract the specifics of how the logging is implemented.
 *
 * The following methods are implemented:
 * - setLevel(level) - Sets the logging level of the logger.
 * - getLevel() - Gets the current logging level of the logger.
 * - shouldLog(level) - Checks if the specified logging level should currently output.
 * - debug(...messages) - Logs a debug message if the current level allows for debug messages.
 * - debugExt(...messages) - Logs a detailed debug message if the current level allows for debugExt messages.
 * - info(...messages) - Logs an informational message if the current level allows for info messages.
 * - warning(...messages) - Logs a warning message if the current level allows for warning messages.
 * - error(...messages) - Logs an error message using console.error if the current level allows for error messages.
 * - getInstance(env, defaultLevel) - Returns the singleton instance of the Logger.
 */

import defaultSettings from '../../config/defaultSettings.js';
import * as optlyHelper from '../optimizelyHelper.js';

/**
 * Class representing a singleton logger.
 * Ensures a single logger instance across the application.
 */
class Logger {
	/**
	 * Creates an instance of the Logger.
	 * @param {Object} env - The environment object containing the LOG_LEVEL variable.
	 * @param {string} [defaultLevel='info'] - The default logging level.
	 */
	constructor(env, defaultLevel = 'info') {
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
	 * @param {string} level - The logging level to set ('debugExt', 'debug', 'info', 'warning', 'error').
	 * @throws {Error} Throws an error if an invalid logging level is provided.
	 */
	setLevel(level) {
		if (this.levels[level] !== undefined) {
			this.level = level;
		} else {
			throw new Error('Invalid logging level');
		}
	}

	/**
	 * Gets the current logging level of the logger.
	 *
	 * @returns {string} The current logging level ('debugExt', 'debug', 'info', 'warning', or 'error').
	 */
	getLevel() {
		return this.level;
	}

	/**
	 * Checks if the specified logging level should currently output.
	 * @param {string} level - The logging level to check.
	 * @returns {boolean} Returns true if the logging should occur, false otherwise.
	 */
	shouldLog(level) {
		return this.levels[level] <= this.levels[this.level];
	}

	/**
	 * Formats the log messages.
	 * @param {...any} messages - The messages to format.
	 * @returns {string} The formatted log message.
	 */
	formatMessages(...messages) {
		try {
			const result = messages
				.map((msg) => {
					const isValidObject = optlyHelper.isValidObject(msg);
					if (typeof msg === 'object' && isValidObject) {
						return optlyHelper.safelyStringifyJSON(msg);
					} else {
						if (typeof msg === 'object' && !isValidObject) {
							return '[Empty Object]';
						} else {
							return String(msg);
						}
					}
				})
				.join(' ');
			return result;
		} catch (error) {
			console.error('Error formatting messages in logger module [formatMessages]:', error);
			return 'Error while attempting to format messages [formatMessages]';
		}
	}

	/**
	 * Logs a detailed debug message if the current level allows for debugExt messages.
	 * @param {...any} messages - The messages to log.
	 */
	debugExt(...messages) {
		if (this.shouldLog('debugExt')) {
			console.debug(`DEBUG EXT: ${this.formatMessages(...messages)}`);
		}
	}

	/**
	 * Logs a debug message if the current level allows for debug messages.
	 * @param {...any} messages - The messages to log.
	 */
	debug(...messages) {
		if (this.shouldLog('debug')) {
			console.debug(`DEBUG: ${this.formatMessages(...messages)}`);
		}
	}

	/**
	 * Logs an informational message if the current level allows for info messages.
	 * @param {...any} messages - The messages to log.
	 */
	info(...messages) {
		if (this.shouldLog('info')) {
			console.info(`INFO: ${this.formatMessages(...messages)}`);
		}
	}

	/**
	 * Logs a warning message if the current level allows for warning messages.
	 * @param {...any} messages - The messages to log.
	 */
	warning(...messages) {
		if (this.shouldLog('warning')) {
			console.warn(`WARNING: ${this.formatMessages(...messages)}`);
		}
	}

	/**
	 * Logs an error message using console.error if the current level allows for error messages.
	 * @param {...any} messages - The messages to log.
	 */
	error(...messages) {
		if (this.shouldLog('error')) {
			console.error(`ERROR: ${this.formatMessages(...messages)}`);
		}
	}

	/**
	 * Returns the singleton instance of the Logger.
	 * @param {Object} env - The environment object containing the LOG_LEVEL variable.
	 * @param {string} [defaultLevel='info'] - The default logging level.
	 * @returns {Logger} The singleton instance of the Logger.
	 */
	static getInstance(env, defaultLevel = 'info') {
		if (!Logger.instance) {
			Logger.instance = new Logger(env, defaultLevel);
		}
		return Logger.instance;
	}
}

export default Logger;

// Usage example
// const logger = Logger.getInstance(env, 'debugExt'); // Creates or retrieves the singleton logger instance
// logger.debugExt('This is a detailed debug message'); // Outputs a detailed debug message
// logger.debug('This is a debug message'); // Outputs a debug message
// logger.info('This is an info message'); // Outputs an informational message
// logger.warning('This is a warning message'); // Outputs a warning message
// logger.error('Error retrieving flag keys [retrieveFlagKeys]:', error); // Outputs an error message with additional parameters
