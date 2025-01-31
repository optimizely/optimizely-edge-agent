import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AbstractContext } from './abstractContext';
import defaultSettings from '../../_config_/defaultSettings';
import { logger } from '../../_helpers_/optimizelyHelper';

vi.mock('../../_helpers_/optimizelyHelper', () => ({
	logger: vi.fn(),
}));

describe('AbstractContext', () => {
	let mockCtx;
	let mockLogger;

	beforeEach(() => {
		mockCtx = {
			waitUntil: vi.fn(),
			wait: vi.fn(),
			callbackWaitsForEmptyEventLoop: true,
		};
		mockLogger = {
			debugExt: vi.fn(),
			error: vi.fn(),
		};
		vi.mocked(logger).mockReturnValue(mockLogger);
		defaultSettings.cdnProvider = 'cloudflare';
	});

	describe('constructor', () => {
		it('should initialize with provided context', () => {
			const context = new AbstractContext(mockCtx);
			expect(context.ctx).toBe(mockCtx);
			expect(context.cdnProvider).toBe('cloudflare');
		});

		it('should initialize with empty context if none provided', () => {
			const context = new AbstractContext();
			expect(context.ctx).toEqual({});
			expect(context.cdnProvider).toBe('cloudflare');
		});
	});

	describe('waitUntil', () => {
		const testPromise = Promise.resolve('test');

		it('should handle Cloudflare context', async () => {
			const context = new AbstractContext(mockCtx);
			await context.waitUntil(testPromise);
			expect(mockCtx.waitUntil).toHaveBeenCalledWith(testPromise);
		});

		it('should handle Fastly context', async () => {
			defaultSettings.cdnProvider = 'fastly';
			const context = new AbstractContext(mockCtx);
			await context.waitUntil(testPromise);
			expect(mockCtx.waitUntil).toHaveBeenCalledWith(testPromise);
		});

		it('should handle Vercel context', async () => {
			defaultSettings.cdnProvider = 'vercel';
			const context = new AbstractContext(mockCtx);
			await context.waitUntil(testPromise);
			expect(mockCtx.waitUntil).toHaveBeenCalledWith(testPromise);
		});

		it('should handle CloudFront context', async () => {
			defaultSettings.cdnProvider = 'cloudfront';
			const context = new AbstractContext(mockCtx);
			await context.waitUntil(testPromise);
			expect(mockCtx.callbackWaitsForEmptyEventLoop).toBe(false);
		});

		it('should handle Akamai context', async () => {
			defaultSettings.cdnProvider = 'akamai';
			const context = new AbstractContext(mockCtx);
			await context.waitUntil(testPromise);
			expect(mockCtx.wait).toHaveBeenCalledWith(testPromise);
		});

		it('should handle rejected promises for each CDN provider', async () => {
			const error = new Error('test error');
			const errorPromise = Promise.reject(error);

			// Test each provider
			const providers = ['cloudflare', 'fastly', 'vercel', 'cloudfront', 'akamai'];

			for (const provider of providers) {
				defaultSettings.cdnProvider = provider;
				const context = new AbstractContext({});
				await context.waitUntil(errorPromise);
				expect(mockLogger.error).toHaveBeenCalledWith(error);
				mockLogger.error.mockClear();
			}
		});

		it('should throw error for unsupported CDN provider', () => {
			defaultSettings.cdnProvider = 'unsupported';
			const context = new AbstractContext({});
			expect(() => context.waitUntil(Promise.resolve())).toThrowError(new Error('Unsupported CDN provider'));
		});

		it('should handle missing context methods for supported providers', async () => {
			const testPromise = Promise.resolve('test');
			const providers = ['cloudflare', 'fastly', 'vercel', 'cloudfront', 'akamai'];

			for (const provider of providers) {
				defaultSettings.cdnProvider = provider;
				const emptyContext = new AbstractContext({});
				const result = await emptyContext.waitUntil(testPromise);
				expect(result).toBe('test');
			}
		});
	});
});
