import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AbstractRequest } from './abstractRequest';
import defaultSettings from '../../_config_/defaultSettings';
import { logger } from '../../_helpers_/optimizelyHelper';

// Mock Request constructor
global.Request = vi.fn().mockImplementation((url, init) => ({
	url,
	...init,
	headers: new Headers(init?.headers || {}),
	json: () => Promise.resolve(JSON.parse(init?.body || '{}')),
	text: () => Promise.resolve(init?.body || ''),
}));

// Mock Headers constructor if not available
if (!global.Headers) {
	global.Headers = vi.fn().mockImplementation((init) => {
		const headers = {};
		if (init) {
			Object.entries(init).forEach(([key, value]) => {
				headers[key.toLowerCase()] = value;
			});
		}
		return {
			get: (name) => headers[name.toLowerCase()],
			set: (name, value) => {
				headers[name.toLowerCase()] = value;
			},
			append: (name, value) => {
				headers[name.toLowerCase()] = value;
			},
			has: (name) => name.toLowerCase() in headers,
			delete: (name) => delete headers[name.toLowerCase()],
			entries: () => Object.entries(headers),
		};
	});
}

vi.mock('../../_helpers_/optimizelyHelper', () => ({
	logger: vi.fn(() => ({
		debug: vi.fn(),
		debugExt: vi.fn(),
		error: vi.fn(),
	})),
}));

describe('AbstractRequest', () => {
	let mockRequest;
	let mockHeaders;

	beforeEach(() => {
		mockHeaders = new Headers({
			'content-type': 'application/json',
			cookie: 'test=value; another=cookie',
		});

		mockRequest = {
			url: 'https://example.com/path?param=value',
			method: 'GET',
			headers: mockHeaders,
			body: null,
			clone: () => mockRequest,
			json: () => Promise.resolve(null),
			text: () => Promise.resolve(''),
			getHeaders: () => mockHeaders,
		};

		defaultSettings.cdnProvider = 'cloudflare';
		vi.clearAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with provided request', () => {
			const request = new AbstractRequest(mockRequest);
			expect(request.request).toBe(mockRequest);
			expect(request.cdnProvider).toBe('cloudflare');
			expect(request.URL.href).toBe('https://example.com/path?param=value');
			expect(request.method).toBe('GET');
		});

		it('should handle different CDN providers', () => {
			const providers = ['cloudflare', 'fastly', 'vercel', 'cloudfront', 'akamai'];
			for (const provider of providers) {
				defaultSettings.cdnProvider = provider;
				const request = new AbstractRequest(mockRequest);
				expect(request.cdnProvider).toBe(provider);
			}
		});

		it('should throw error for unsupported CDN provider', () => {
			defaultSettings.cdnProvider = 'unsupported';
			expect(() => new AbstractRequest(mockRequest)).toThrow('Unsupported CDN provider');
		});

		it('should parse search parameters', () => {
			const request = new AbstractRequest(mockRequest);
			expect(request.searchParams).toEqual({ param: 'value' });
		});
	});

	describe('URL and HTTP methods', () => {
		let request;

		beforeEach(() => {
			request = new AbstractRequest(mockRequest);
		});

		it('should get new URL', () => {
			const url = 'https://test.com/path';
			const newUrl = request.getNewURL(url);
			expect(newUrl instanceof URL).toBe(true);
			expect(newUrl.href).toBe(url);
		});

		it('should get URL href', () => {
			expect(request.getUrlHref()).toBe('https://example.com/path?param=value');
		});

		it('should get pathname', () => {
			expect(request.getPathname()).toBe('/path');
		});

		it('should get HTTP method', () => {
			expect(request.getHttpMethod()).toBe('GET');
		});
	});

	describe('Headers and Cookies', () => {
		let request;

		beforeEach(() => {
			request = new AbstractRequest(mockRequest);
		});

		it('should get header', () => {
			expect(request.getHeader('content-type')).toBe('application/json');
		});

		it('should set header', () => {
			request.setHeader('x-custom', 'test');
			expect(request.getHeader('x-custom')).toBe('test');
		});

		it('should get cookie', () => {
			expect(request.getCookie('test')).toBe('value');
			expect(request.getCookie('another')).toBe('cookie');
		});

		it('should set cookie', () => {
			request.setCookie('newcookie', 'value', { path: '/' });
			const cookies = request.getHeader('set-cookie');
			expect(cookies).toContain('newcookie=value; path=/');
		});
	});

	describe('Request Cloning', () => {
		const mockRequestWithBody = {
			...mockRequest,
			method: 'POST',
			body: JSON.stringify({ test: 'data' }),
			headers: new Headers({
				'content-type': 'application/json',
			}),
		};

		it('should clone request for Cloudflare/Fastly/Vercel', async () => {
			const providers = ['cloudflare', 'fastly', 'vercel'];
			for (const provider of providers) {
				defaultSettings.cdnProvider = provider;
				const clonedRequest = await AbstractRequest.cloneRequest(mockRequestWithBody);
				expect(clonedRequest).toBeDefined();
				expect(clonedRequest.url).toBe(mockRequestWithBody.url);
				expect(clonedRequest.method).toBe(mockRequestWithBody.method);
			}
		});

		it('should clone request for CloudFront', async () => {
			defaultSettings.cdnProvider = 'cloudfront';
			const clonedRequest = await AbstractRequest.cloneRequest(mockRequestWithBody);
			expect(clonedRequest).toBeDefined();
			expect(clonedRequest.url).toBe(mockRequestWithBody.url);
			expect(clonedRequest.method).toBe(mockRequestWithBody.method);
		});

		it('should clone request for Akamai', async () => {
			defaultSettings.cdnProvider = 'akamai';
			const clonedRequest = await AbstractRequest.cloneRequest(mockRequestWithBody);
			expect(clonedRequest).toBeDefined();
			expect(clonedRequest.url).toBe(mockRequestWithBody.url);
			expect(clonedRequest.method).toBe(mockRequestWithBody.method);
		});

		it('should throw error when cloning with unsupported provider', async () => {
			defaultSettings.cdnProvider = 'unsupported';
			expect(() => AbstractRequest.cloneRequest(mockRequestWithBody)).toThrow('Unsupported CDN provider');
		});
	});

	describe('JSON Payload', () => {
		let jsonRequest;
		let mockLoggerInstance;

		beforeEach(() => {
			mockLoggerInstance = {
				debug: vi.fn(),
				debugExt: vi.fn(),
				error: vi.fn(),
			};
			vi.mocked(logger).mockReturnValue(mockLoggerInstance);

			const jsonData = { test: 'data' };
			jsonRequest = {
				url: 'https://example.com/api',
				method: 'POST',
				headers: new Headers({
					'content-type': 'application/json',
				}),
				body: JSON.stringify(jsonData),
				clone: () => ({
					...jsonRequest,
					json: () => Promise.resolve(jsonData),
					text: () => Promise.resolve(JSON.stringify(jsonData)),
				}),
			};
		});

		it('should get JSON payload from POST request', async () => {
			const request = new AbstractRequest(jsonRequest);
			const payload = await request.getJsonPayload(jsonRequest);
			expect(payload).toEqual({ test: 'data' });
		});

		it('should return null for non-POST request', async () => {
			const request = new AbstractRequest(mockRequest);
			const payload = await request.getJsonPayload(mockRequest);
			expect(payload).toBeNull();
		});

		it('should handle invalid JSON payload', async () => {
			const invalidRequest = {
				url: 'https://example.com/api',
				method: 'POST',
				headers: new Headers({
					'content-type': 'application/json',
				}),
				body: 'not-valid-json',
			};

			const request = new AbstractRequest(invalidRequest);
			const payload = await request.getJsonPayload(invalidRequest);

			expect(payload).toBeNull();
			expect(mockLoggerInstance.error).toHaveBeenCalled();
		});
	});
});
