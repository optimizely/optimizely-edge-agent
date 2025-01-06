import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AbstractionHelper, getAbstractionHelper } from './abstractionHelper';
import defaultSettings from '../_config_/defaultSettings';
import { AbstractRequest } from './abstraction-classes/abstractRequest';
import { AbstractResponse } from './abstraction-classes/abstractResponse';
import { AbstractContext } from './abstraction-classes/abstractContext';
import { KVStoreAbstractInterface } from './abstraction-classes/kvStoreAbstractInterface';

// Mock dependencies
vi.mock('../_helpers_/optimizelyHelper', () => ({
	logger: () => ({
		debug: vi.fn(),
		debugExt: vi.fn(),
		error: vi.fn(),
	}),
}));

vi.mock('./abstraction-classes/abstractRequest', () => ({
	AbstractRequest: vi.fn().mockImplementation((request) => ({
		request,
	})),
}));

vi.mock('./abstraction-classes/abstractResponse', () => ({
	AbstractResponse: vi.fn().mockImplementation(() => ({
		createResponse: vi.fn().mockImplementation((body, status, headers) => ({
			body,
			status,
			headers,
		})),
	})),
}));

vi.mock('./abstraction-classes/abstractContext', () => ({
	AbstractContext: vi.fn().mockImplementation((ctx) => ctx),
}));

vi.mock('./abstraction-classes/kvStoreAbstractInterface', () => ({
	KVStoreAbstractInterface: vi.fn().mockImplementation((provider) => ({
		provider,
	})),
}));

describe('AbstractionHelper', () => {
	let helper;
	let mockRequest;
	let mockCtx;
	let mockEnv;

	beforeEach(() => {
		mockRequest = {
			url: 'https://example.com',
			method: 'GET',
			headers: new Headers(),
		};
		mockCtx = { env: 'test' };
		mockEnv = { env: 'test' };
		helper = new AbstractionHelper(mockRequest, mockCtx, mockEnv);
	});

	describe('constructor', () => {
		it('should initialize with request, context and environment', () => {
			expect(helper.request).toBe(mockRequest);
			expect(helper.ctx).toBe(mockCtx);
			expect(helper.env).toBe(mockEnv);
			expect(AbstractRequest).toHaveBeenCalledWith(mockRequest);
			expect(AbstractResponse).toHaveBeenCalled();
			expect(AbstractContext).toHaveBeenCalledWith(mockCtx);
		});
	});

	describe('getNewHeaders', () => {
		const testCases = [
			{
				provider: 'cloudflare',
				input: { 'Content-Type': 'application/json' },
				expected: new Headers({ 'Content-Type': 'application/json' }),
			},
			{
				provider: 'akamai',
				input: { 'Content-Type': 'application/json' },
				expected: { 'Content-Type': 'application/json' },
			},
			{
				provider: 'cloudfront',
				input: { 'Content-Type': 'application/json' },
				expected: { 'content-type': [{ key: 'Content-Type', value: 'application/json' }] },
			},
		];

		testCases.forEach(({ provider, input, expected }) => {
			it(`should handle ${provider} headers correctly`, () => {
				defaultSettings.cdnProvider = provider;
				const result = AbstractionHelper.getNewHeaders(input);
				if (provider === 'cloudflare') {
					expect(result.get('Content-Type')).toBe(expected.get('Content-Type'));
				} else {
					expect(result).toStrictEqual(expected);
				}
			});
		});

		it('should throw error for unsupported CDN provider', () => {
			defaultSettings.cdnProvider = 'unsupported';
			expect(() => AbstractionHelper.getNewHeaders({})).toThrow('Unsupported CDN provider: unsupported');
		});
	});

	describe('createResponse', () => {
		it('should create response with default values', () => {
			const body = { data: 'test' };
			const response = helper.createResponse(body);
			expect(response).toStrictEqual({
				body,
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		});

		it('should create response with custom values', () => {
			const body = { data: 'test' };
			const status = 201;
			const headers = { 'Custom-Header': 'value' };
			const response = helper.createResponse(body, status, headers);
			expect(response).toStrictEqual({
				body,
				status,
				headers,
			});
		});
	});

	describe('getHeaderValue', () => {
		const testCases = [
			{
				provider: 'cloudflare',
				response: { headers: new Headers({ 'Content-Type': 'application/json' }) },
				headerName: 'Content-Type',
				expected: 'application/json',
			},
			{
				provider: 'cloudfront',
				response: {
					headers: {
						'content-type': [{ key: 'Content-Type', value: 'application/json' }],
					},
				},
				headerName: 'Content-Type',
				expected: 'application/json',
			},
		];

		testCases.forEach(({ provider, response, headerName, expected }) => {
			it(`should get header value for ${provider}`, () => {
				defaultSettings.cdnProvider = provider;
				const result = AbstractionHelper.getHeaderValue(response, headerName);
				expect(result).toBe(expected);
			});
		});

		it('should return null for non-existent header', () => {
			defaultSettings.cdnProvider = 'cloudflare';
			const response = { headers: new Headers() };
			const result = AbstractionHelper.getHeaderValue(response, 'Non-Existent');
			expect(result).toBeNull();
		});

		it('should throw error for invalid response', () => {
			expect(() => AbstractionHelper.getHeaderValue(null, 'Content-Type')).toThrow('Invalid response object provided.');
		});

		it('should throw error for unsupported CDN provider', () => {
			defaultSettings.cdnProvider = 'unsupported';
			const response = { headers: new Headers() };
			expect(() => AbstractionHelper.getHeaderValue(response, 'Content-Type')).toThrow('Unsupported CDN provider.');
		});
	});

	describe('getResponseContent', () => {
		it('should handle JSON response for cloudflare', async () => {
			defaultSettings.cdnProvider = 'cloudflare';
			const jsonData = { data: 'test' };
			const response = {
				headers: new Headers({ 'Content-Type': 'application/json' }),
				json: () => Promise.resolve(jsonData),
			};
			const result = await helper.getResponseContent(response);
			expect(result).toBe(JSON.stringify(jsonData));
		});

		it('should handle text response for cloudflare', async () => {
			defaultSettings.cdnProvider = 'cloudflare';
			const textData = 'test data';
			const response = {
				headers: new Headers({ 'Content-Type': 'text/plain' }),
				text: () => Promise.resolve(textData),
			};
			const result = await helper.getResponseContent(response);
			expect(result).toBe(textData);
		});

		it('should throw error for invalid response', async () => {
			await expect(helper.getResponseContent(null)).rejects.toThrow('Invalid response object provided.');
		});

		it('should throw error for unsupported CDN provider', async () => {
			defaultSettings.cdnProvider = 'unsupported';
			const response = {
				headers: new Headers(),
			};
			await expect(helper.getResponseContent(response)).rejects.toThrow('Unsupported CDN provider.');
		});
	});

	describe('getEnvVariableValue', () => {
		it('should get value from env object', () => {
			const value = helper.getEnvVariableValue('env', { env: 'test-value' });
			expect(value).toBe('test-value');
		});

		it('should get value from process.env', () => {
			process.env.TEST_VAR = 'test-value';
			const value = helper.getEnvVariableValue('TEST_VAR');
			expect(value).toBe('test-value');
			delete process.env.TEST_VAR;
		});

		it('should throw error when variable not found', () => {
			expect(() => helper.getEnvVariableValue('NON_EXISTENT')).toThrow('Environment variable NON_EXISTENT not found');
		});
	});

	describe('initializeKVStore', () => {
		it('should initialize cloudflare KV store', () => {
			const mockAdapter = { adapter: 'test' };
			const kvStore = helper.initializeKVStore('cloudflare', mockAdapter);
			expect(kvStore.provider).toStrictEqual(mockAdapter);
		});

		it('should throw error for unsupported CDN provider', () => {
			expect(() => helper.initializeKVStore('unsupported', {})).toThrow('Unsupported CDN provider');
		});

		it('should throw error for unimplemented KV providers', () => {
			expect(() => helper.initializeKVStore('fastly', {})).toThrow('Fastly KV provider not implemented');
			expect(() => helper.initializeKVStore('akamai', {})).toThrow('Akamai KV provider not implemented');
		});

		it('should return same instance for subsequent calls', () => {
			const mockAdapter = { adapter: 'test' };
			const kvStore1 = helper.initializeKVStore('cloudflare', mockAdapter);
			const kvStore2 = helper.initializeKVStore('cloudflare', mockAdapter);
			expect(kvStore1).toBe(kvStore2);
		});
	});

	describe('getAbstractionHelper', () => {
		it('should create new instance of AbstractionHelper', () => {
			const instance = getAbstractionHelper(mockRequest, mockEnv, mockCtx);
			expect(instance).toBeInstanceOf(AbstractionHelper);
			expect(instance.request).toBe(mockRequest);
			expect(instance.ctx).toStrictEqual(mockCtx);
			expect(instance.env).toStrictEqual(mockEnv);
		});
	});
});
