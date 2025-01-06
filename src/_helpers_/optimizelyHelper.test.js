import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as optimizelyHelper from './optimizelyHelper.js';
import defaultSettings from '../_config_/defaultSettings.js';

describe('optimizelyHelper', () => {
	beforeEach(() => {
		vi.spyOn(console, 'debug').mockImplementation(() => {});
		vi.spyOn(console, 'info').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Route Handling', () => {
		it('should match valid API routes', () => {
			expect(optimizelyHelper.routeMatches('/v1/api/datafiles/key123')).toBe(true);
			expect(optimizelyHelper.routeMatches('/v1/api/flag_keys')).toBe(true);
			expect(optimizelyHelper.routeMatches('/v1/api/sdk/some-sdk')).toBe(true);
			expect(optimizelyHelper.routeMatches('/v1/api/variation_changes/exp123/token456')).toBe(true);
		});

		it('should not match invalid routes', () => {
			expect(optimizelyHelper.routeMatches('/invalid/path')).toBe(false);
			expect(optimizelyHelper.routeMatches('/v1/api/unknown')).toBe(false);
		});
	});

	describe('Array and Object Validation', () => {
		it('should validate arrays correctly', () => {
			expect(optimizelyHelper.arrayIsValid(['item'])).toBe(true);
			expect(optimizelyHelper.arrayIsValid([])).toBe(false);
			expect(optimizelyHelper.arrayIsValid(null)).toBe(false);
			expect(optimizelyHelper.arrayIsValid(undefined)).toBe(false);
		});

		it('should validate JSON objects correctly', () => {
			expect(optimizelyHelper.isValidJsonObject('{"key": "value"}')).toBe(true);
			expect(optimizelyHelper.isValidJsonObject('{}')).toBe(false);
			expect(optimizelyHelper.isValidJsonObject('invalid')).toBe(false);
		});

		it('should validate objects correctly', () => {
			expect(optimizelyHelper.isValidObject({ key: 'value' })).toBe(true);
			expect(optimizelyHelper.isValidObject({})).toBe(false);
			expect(optimizelyHelper.isValidObject(null)).toBe(false);
			expect(optimizelyHelper.isValidObject(undefined)).toBe(false);
		});
	});

	describe('Cookie Handling', () => {
		it('should parse cookie header string correctly', () => {
			const cookieHeader = 'name=value; key=123; flag=true';
			const parsed = optimizelyHelper.parseCookies(cookieHeader);
			expect(parsed).toEqual({
				name: 'value',
				key: '123',
				flag: 'true',
			});
		});

		it('should get cookie value by name', () => {
			const cookies = 'name=value; key=123';
			expect(optimizelyHelper.getCookieValueByName(cookies, 'name')).toBe('value');
			expect(optimizelyHelper.getCookieValueByName(cookies, 'missing')).toBeUndefined();
		});

		it('should create cookie with correct options', () => {
			const cookie = optimizelyHelper.createCookie('name', 'value', {
				maxAge: 3600,
				path: '/',
				secure: true,
			});
			expect(cookie).toContain('name=value');
			expect(cookie).toContain('Max-Age=3600');
			expect(cookie).toContain('Path=/');
			expect(cookie).toContain('Secure');
		});
	});

	describe('JSON Handling', () => {
		it('should safely stringify JSON', () => {
			const obj = { key: 'value', num: 123 };
			expect(optimizelyHelper.safelyStringifyJSON(obj)).toBe('{"key":"value","num":123}');
			expect(optimizelyHelper.safelyStringifyJSON(null)).toBe('null');
		});

		it('should safely parse JSON', () => {
			expect(optimizelyHelper.safelyParseJSON('{"key":"value"}')).toEqual({ key: 'value' });
			expect(optimizelyHelper.safelyParseJSON('invalid')).toBeNull();
		});
	});

	describe('Decision Handling', () => {
		const mockDecisions = [
			{
				flagKey: 'flag1',
				variationKey: 'variation1',
				ruleKey: 'rule1',
			},
			{
				flagKey: 'flag2',
				variationKey: 'variation2',
				ruleKey: 'rule2',
			},
		];

		it('should serialize decisions correctly', () => {
			const serialized = optimizelyHelper.serializeDecisions(mockDecisions);
			expect(typeof serialized).toBe('string');
			expect(serialized).toContain('flag1');
			expect(serialized).toContain('variation1');
			expect(serialized).toContain('rule1');
		});

		it('should deserialize decisions correctly', () => {
			const serialized = optimizelyHelper.serializeDecisions(mockDecisions);
			const deserialized = optimizelyHelper.deserializeDecisions(serialized);
			expect(deserialized).toEqual(mockDecisions);
		});

		it('should get valid cookie decisions', () => {
			const activeFlags = ['flag1'];
			const valid = optimizelyHelper.getValidCookieDecisions(mockDecisions, activeFlags);
			expect(valid).toHaveLength(1);
			expect(valid[0].flagKey).toBe('flag1');
		});

		it('should get invalid cookie decisions', () => {
			const activeFlags = ['flag1'];
			const invalid = optimizelyHelper.getInvalidCookieDecisions(mockDecisions, activeFlags);
			expect(invalid).toHaveLength(1);
			expect(invalid[0].flagKey).toBe('flag2');
		});
	});

	describe('Fetch Operations', () => {
		const mockResponseData = { data: 'test' };
		const mockResponse = {
			ok: true,
			status: 200,
			statusText: 'OK',
			headers: new Map([['Content-Type', 'application/json']]),
			json: async () => mockResponseData,
			clone: function() { return this; },
		};

		beforeEach(() => {
			global.fetch = vi.fn().mockResolvedValue(mockResponse);
			vi.mock('./abstractionHelper.js', () => ({
				AbstractionHelper: {
					getNewHeaders: vi.fn((headers) => headers),
				},
			}));
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('should fetch by request object for supported providers', async () => {
			const request = {
				url: 'https://test.com/api',
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			};

			const response = await optimizelyHelper.fetchByRequestObject(request);
			expect(response).toBeDefined();
			expect(response.status).toBe(200);
		});

		it('should throw error for unsupported CDN provider', async () => {
			const originalProvider = defaultSettings.cdnProvider;
			defaultSettings.cdnProvider = 'unsupported';

			await expect(
				optimizelyHelper.fetchByRequestObject({
					url: 'https://test.com/api',
					method: 'GET',
				}),
			).rejects.toThrow('Unsupported CDN provider');

			defaultSettings.cdnProvider = originalProvider;
		});
	});

	describe('Utility Functions', () => {
		it('should convert days to seconds', () => {
			expect(optimizelyHelper.getDaysInSeconds(1)).toBe(86400);
			expect(optimizelyHelper.getDaysInSeconds(2)).toBe(172800);
		});

		it('should generate valid UUID', async () => {
			const uuid = await optimizelyHelper.generateUUID();
			expect(typeof uuid).toBe('string');
			expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
		});

		it('should split and trim array correctly', () => {
			expect(optimizelyHelper.splitAndTrimArray('a, b, c')).toEqual(['a', 'b', 'c']);
			expect(optimizelyHelper.splitAndTrimArray('')).toEqual([]);
		});

		it('should trim string array elements', () => {
			expect(optimizelyHelper.trimStringArray([' a ', 'b ', ' c'])).toEqual(['a', 'b', 'c']);
		});
	});
});
