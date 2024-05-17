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
		this.level = env.LOG_LEVEL || defaultLevel;
		this.levels = {
			debug: 3,
			info: 2,
			error: 1,
		};
		if (Logger.instance) {
			return Logger.instance;
		}
		Logger.instance = this;
	}

	/**
	 * Sets the logging level of the logger.
	 * @param {string} level - The logging level to set ('debug', 'info', 'error').
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
	 * @returns {string} The current logging level ('debug', 'info', or 'error').
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
   * Logs a debug message if the current level allows for debug messages.
   * @param {string} message - The message to log.
   */
 debug(message) {
    if (this.shouldLog('debug')) {
      console.debug(`DEBUG: ${message}`);
    }
  }

  /**
   * Logs an informational message if the current level allows for info messages.
   * @param {string} message - The message to log.
   */
  info(message) {
    if (this.shouldLog('info')) {
      console.info(`INFO: ${message}`);
    }
  }

  /**
   * Logs an error message using console.error if the current level allows for error messages.
   * @param {string} message - The message to log.
   */
  error(message) {
    if (this.shouldLog('error')) {
      console.error(`ERROR: ${message}`);
    }
  }
}

export default Logger;

// Usage example
// const logger = new Logger('debug'); // Creates or retrieves the singleton logger instance
// logger.debug('This is a debug message'); // Outputs a debug message
// logger.info('This is an info message'); // Outputs an informational message
// logger.error('This is an error message'); // Outputs an error message
