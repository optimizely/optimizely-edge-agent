import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Logger from './logger.js';
import defaultSettings from '../_config_/defaultSettings.js';

describe('Logger', () => {
	let logger;
	const mockEnv = { LOG_LEVEL: 'debug' };

	beforeEach(() => {
		// Reset the singleton instance before each test
		Logger.instance = null;
		// Mock console methods
		vi.spyOn(console, 'debug').mockImplementation(() => {});
		vi.spyOn(console, 'info').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		Logger.instance = null;
	});

	describe('Constructor and Singleton', () => {
		it('should create a singleton instance', () => {
			const logger1 = new Logger(mockEnv);
			const logger2 = new Logger(mockEnv);
			expect(logger1).toBe(logger2);
		});

		it('should use environment LOG_LEVEL if provided', () => {
			const logger = new Logger(mockEnv);
			expect(logger.getLevel()).toBe('debug');
		});

		it('should use default level if no environment LOG_LEVEL', () => {
			const loggerWithoutEnv = new Logger({});
			expect(loggerWithoutEnv.getLevel()).toBe(defaultSettings.logLevel);
		});
	});

	describe('Level Management', () => {
		beforeEach(() => {
			logger = new Logger(mockEnv);
		});

		it('should set and get level correctly', () => {
			logger.setLevel('error');
			expect(logger.getLevel()).toBe('error');
		});

		it('should throw error for invalid level', () => {
			expect(() => logger.setLevel('invalid')).toThrow('Invalid logging level');
		});

		it('should correctly determine if should log', () => {
			logger.setLevel('info');
			expect(logger.shouldLog('error')).toBe(true);
			expect(logger.shouldLog('info')).toBe(true);
			expect(logger.shouldLog('debug')).toBe(false);
			expect(logger.shouldLog('debugExt')).toBe(false);
		});
	});

	describe('Message Formatting', () => {
		beforeEach(() => {
			logger = new Logger(mockEnv);
		});

		it('should format string messages', () => {
			const result = logger.formatMessages('test', 'message');
			expect(result).toBe('test message');
		});

		it('should format object messages', () => {
			const obj = { key: 'value' };
			const result = logger.formatMessages(obj);
			expect(result).toBe(JSON.stringify(obj));
		});

		it('should handle empty objects', () => {
			const result = logger.formatMessages(Object.create(null));
			expect(result).toBe('[Empty Object]');
		});

		it('should handle mixed types', () => {
			const result = logger.formatMessages('test', 123, { key: 'value' });
			expect(result).toBe(`test 123 ${JSON.stringify({ key: 'value' })}`);
		});
	});

	describe('Logging Methods', () => {
		beforeEach(() => {
			logger = new Logger(mockEnv);
		});

		it('should log debug messages when level allows', () => {
			logger.setLevel('debug');
			logger.debug('test message');
			expect(console.debug).toHaveBeenCalledWith('DEBUG: test message');
		});

		it('should not log debug messages when level is too low', () => {
			logger.setLevel('info');
			logger.debug('test message');
			expect(console.debug).not.toHaveBeenCalled();
		});

		it('should log debugExt messages when level allows', () => {
			logger.setLevel('debugExt');
			logger.debugExt('test message');
			expect(console.debug).toHaveBeenCalledWith('DEBUG EXT: test message');
		});

		it('should log info messages when level allows', () => {
			logger.setLevel('info');
			logger.info('test message');
			expect(console.info).toHaveBeenCalledWith('INFO: test message');
		});

		it('should log warning messages when level allows', () => {
			logger.setLevel('warning');
			logger.warning('test message');
			expect(console.warn).toHaveBeenCalledWith('WARNING: test message');
		});

		it('should log error messages when level allows', () => {
			logger.setLevel('error');
			logger.error('test message');
			expect(console.error).toHaveBeenCalledWith('ERROR: test message');
		});
	});
});
