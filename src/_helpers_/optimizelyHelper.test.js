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

		describe('parseCookies', () => {
			it('should parse cookie header string correctly', () => {
				const cookieHeader = 'name=value; key=123; flag=true';
				const parsed = optimizelyHelper.parseCookies(cookieHeader);
				expect(parsed).toEqual({
					name: 'value',
					key: '123',
					flag: 'true',
				});
			});

			it('should handle empty cookie string', () => {
				expect(optimizelyHelper.parseCookies('')).toEqual({});
			});

			it('should handle invalid cookie format', () => {
				const invalidCookie = 'invalid;cookie;string';
				expect(optimizelyHelper.parseCookies(invalidCookie)).toEqual({});
			});

			it('should throw for non-string input', () => {
				expect(() => optimizelyHelper.parseCookies(null)).toThrow();
				expect(() => optimizelyHelper.parseCookies(undefined)).toThrow();
				expect(() => optimizelyHelper.parseCookies(123)).toThrow();
			});
		});

		describe('createCookie', () => {
			it('should create cookie with default options', () => {
				const cookie = optimizelyHelper.createCookie('name', 'value');
				expect(cookie).toContain('name=value');
				expect(cookie).toContain('Path=/');
			});

			it('should create cookie with custom options', () => {
				const cookie = optimizelyHelper.createCookie('name', 'value', {
					maxAge: 3600,
					path: '/custom',
					domain: 'example.com',
					secure: true,
					httpOnly: true,
					sameSite: 'Strict',
				});
				expect(cookie).toContain('name=value');
				expect(cookie).toContain('Max-Age=3600');
				expect(cookie).toContain('Path=/custom');
				expect(cookie).toContain('Domain=example.com');
				expect(cookie).toContain('Secure');
				expect(cookie).toContain('HttpOnly');
				expect(cookie).toContain('SameSite=Strict');
			});

			it('should handle special characters in values', () => {
				const cookie = optimizelyHelper.createCookie('name', 'value with spaces;and;semicolons');
				expect(cookie).toContain('name=value%20with%20spaces%3Band%3Bsemicolons');
			});
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

		describe('serializeDecisions', () => {
			it('should serialize full decision objects', () => {
				const serialized = optimizelyHelper.serializeDecisions(mockDecisions);
				expect(typeof serialized).toBe('string');
				expect(serialized).toContain('flag1');
				expect(serialized).toContain('variation1');
				expect(serialized).toContain('rule1');
			});

			it('should handle empty array', () => {
				expect(optimizelyHelper.serializeDecisions([])).toBeUndefined();
			});

			it('should handle invalid input', () => {
				expect(optimizelyHelper.serializeDecisions(null)).toBeUndefined();
				expect(optimizelyHelper.serializeDecisions(undefined)).toBeUndefined();
				expect(optimizelyHelper.serializeDecisions('not an array')).toBeUndefined();
			});
		});

		describe('deserializeDecisions', () => {
			it('should deserialize valid decision string', () => {
				const serialized = optimizelyHelper.serializeDecisions(mockDecisions);
				const deserialized = optimizelyHelper.deserializeDecisions(serialized);
				expect(deserialized).toHaveLength(2);
				expect(deserialized[0]).toHaveProperty('flagKey', 'flag1');
				expect(deserialized[1]).toHaveProperty('flagKey', 'flag2');
			});

			it('should handle invalid input', () => {
				expect(optimizelyHelper.deserializeDecisions('')).toEqual([]);
				expect(optimizelyHelper.deserializeDecisions('invalid json')).toEqual([]);
				expect(optimizelyHelper.deserializeDecisions(null)).toEqual([]);
				expect(optimizelyHelper.deserializeDecisions(undefined)).toEqual([]);
			});
		});

		describe('getFlagsToDecide', () => {
			it('should filter out stored decisions', () => {
				const storedDecisions = [
					{ flagKey: 'flag1' },
					{ flagKey: 'flag2' },
					{ flagKey: 'flag3' }
				];
				const activeFlags = ['flag1'];
				const result = optimizelyHelper.getFlagsToDecide(storedDecisions, activeFlags);
				expect(result.sort()).toEqual(['flag2', 'flag3'].sort());
			});

			it('should handle empty inputs', () => {
				expect(optimizelyHelper.getFlagsToDecide([], [])).toEqual([]);
				expect(optimizelyHelper.getFlagsToDecide(null, [])).toEqual([]);
				expect(optimizelyHelper.getFlagsToDecide([], null)).toEqual([]);
			});
		});
	});

	describe('Fetch Operations', () => {
		const mockResponseData = { data: 'test' };
		const mockResponse = {
			ok: true,
			status: 200,
			statusText: 'OK',
			headers: new Headers({
				'Content-Type': 'application/json',
				'X-Test': 'test',
			}),
			json: async () => mockResponseData,
			text: async () => 'test',
			arrayBuffer: async () => new ArrayBuffer(8),
			clone: function () {
				const cloned = { ...this };
				cloned.headers = new Headers({
					'Content-Type': 'application/json',
					'X-Test': 'test',
				});
				return cloned;
			},
		};

		beforeEach(() => {
			global.fetch = vi.fn().mockResolvedValue(mockResponse);
			vi.mock('./abstractionHelper.js', () => ({
				AbstractionHelper: {
					getNewHeaders: vi.fn((headers) => new Headers({
						'Content-Type': 'application/json',
						'X-Test': 'test',
					})),
				},
			}));
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		describe('fetchByRequestObject', () => {
			it('should fetch by request object for supported providers', async () => {
				const request = {
					url: 'https://test.com/api',
					method: 'GET',
					headers: new Headers({ 'Content-Type': 'application/json' }),
				};

				const response = await optimizelyHelper.fetchByRequestObject(request);
				expect(response).toBeDefined();
				expect(response.status).toBe(200);
			});

			it('should handle fetch errors', async () => {
				global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

				const request = {
					url: 'https://test.com/api',
					method: 'GET',
					headers: new Headers({ 'Content-Type': 'application/json' }),
				};

				await expect(optimizelyHelper.fetchByRequestObject(request)).rejects.toThrow('Network error');
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

		describe('fetchByUrl', () => {
			it('should handle JSON response', async () => {
				const response = await optimizelyHelper.fetchByUrl('https://test.com/api', {
					method: 'GET',
				});
				expect(response).toEqual(mockResponseData);
			});

			it('should handle text response', async () => {
				mockResponse.headers = new Headers({ 'Content-Type': 'text/html' });
				const response = await optimizelyHelper.fetchByUrl('https://test.com/api', {
					method: 'GET',
				});
				expect(response).toBe('test');
			});

			it('should handle binary response', async () => {
				mockResponse.headers = new Headers({ 'Content-Type': 'application/octet-stream' });
				const response = await optimizelyHelper.fetchByUrl('https://test.com/api', {
					method: 'GET',
				});
				expect(response).toBeInstanceOf(ArrayBuffer);
			});

			it('should handle fetch errors', async () => {
				global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
				await expect(
					optimizelyHelper.fetchByUrl('https://test.com/api', { method: 'GET' }),
				).rejects.toThrow('Network error');
			});
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

	describe('isValidExperimentationEndpoint', () => {
		it('should validate experimentation endpoints correctly', () => {
			const validEndpoints = ['/v1/decide', '/v1/activate'];
			expect(optimizelyHelper.isValidExperimentationEndpoint('/v1/decide', validEndpoints)).toBe(true);
			expect(optimizelyHelper.isValidExperimentationEndpoint('/v1/decide/', validEndpoints)).toBe(true);
			expect(optimizelyHelper.isValidExperimentationEndpoint('/v1/decide?param=1', validEndpoints)).toBe(true);
			expect(optimizelyHelper.isValidExperimentationEndpoint('/v1/other', validEndpoints)).toBe(false);
		});

		it('should handle empty or invalid inputs', () => {
			expect(optimizelyHelper.isValidExperimentationEndpoint('', [])).toBe(false);
			expect(optimizelyHelper.isValidExperimentationEndpoint('/v1/decide', [])).toBe(false);
			expect(optimizelyHelper.isValidExperimentationEndpoint('', undefined)).toBe(false);
		});
	});

	describe('getResponseJsonKeyName', () => {
		it('should get correct key name for datafile path', async () => {
			const result = await optimizelyHelper.getResponseJsonKeyName('/v1/datafile');
			expect(result).toBe('datafile');
		});

		it('should get correct key name for decide path', async () => {
			const result = await optimizelyHelper.getResponseJsonKeyName('/v1/decide');
			expect(result).toBe('decisions');
		});

		it('should get correct key name for track path', async () => {
			const result = await optimizelyHelper.getResponseJsonKeyName('/v1/track');
			expect(result).toBe('track');
		});

		it('should return unknown for unknown path', async () => {
			const result = await optimizelyHelper.getResponseJsonKeyName('/v1/unknown');
			expect(result).toBe('unknown');
		});
	});

	describe('cloneResponseObject', () => {
		it('should clone response object with all properties', async () => {
			const originalResponse = {
				status: 200,
				statusText: 'OK',
				headers: new Headers({ 'Content-Type': 'application/json' }),
				body: 'test body',
				json: () => Promise.resolve({ data: 'test' })
			};

			const clonedResponse = await optimizelyHelper.cloneResponseObject(originalResponse);
			expect(clonedResponse.status).toBe(200);
			expect(clonedResponse.statusText).toBe('OK');
			expect(clonedResponse.headers.get('Content-Type')).toBe('application/json');
		});
	});

	describe('isValidObject', () => {
		it('should validate objects correctly', () => {
			expect(optimizelyHelper.isValidObject({ key: 'value' })).toBe(true);
			expect(optimizelyHelper.isValidObject({})).toBe(false);
			expect(optimizelyHelper.isValidObject(null)).toBe(false);
			expect(optimizelyHelper.isValidObject(undefined)).toBe(false);
			expect(optimizelyHelper.isValidObject('string')).toBe(false);
			expect(optimizelyHelper.isValidObject(123)).toBe(false);
		});

		it('should handle returnEmptyObject parameter', () => {
			expect(optimizelyHelper.isValidObject({}, true)).toEqual({});
			expect(optimizelyHelper.isValidObject({}, false)).toBe(false);
		});

		it.skip('should handle error cases', () => {
			const obj = {};
			Object.defineProperty(obj, 'prop', {
				enumerable: true,
				get() { throw new Error('Error accessing property'); }
			});
			let error;
			try {
				optimizelyHelper.isValidObject(obj);
			} catch (e) {
				error = e;
			}
			expect(error).toBeDefined();
			expect(error.message).toBe('An error occurred while validating the object.');
		});
	});

	describe('safelyStringifyJSON and safelyParseJSON', () => {
		it('should safely stringify and parse JSON', () => {
			const obj = { key: 'value', num: 123 };
			const jsonString = optimizelyHelper.safelyStringifyJSON(obj);
			expect(jsonString).toBe('{"key":"value","num":123}');

			const parsed = optimizelyHelper.safelyParseJSON(jsonString);
			expect(parsed).toEqual(obj);
		});

		it('should handle invalid JSON', () => {
			expect(optimizelyHelper.safelyParseJSON('invalid json')).toBeNull();
			expect(optimizelyHelper.safelyParseJSON('')).toBeNull();
			expect(optimizelyHelper.safelyParseJSON(null)).toBeNull();
		});

		it('should handle stringification of invalid objects', () => {
			expect(optimizelyHelper.safelyStringifyJSON(undefined)).toBe('{}');
			expect(optimizelyHelper.safelyStringifyJSON(() => {})).toBe('{}');
			expect(optimizelyHelper.safelyStringifyJSON(Symbol('test'))).toBe('{}');
		});

		it('should handle circular references', () => {
			const circular = { a: 1 };
			circular.self = circular;
			expect(optimizelyHelper.safelyStringifyJSON(circular)).toBe('{}');
		});
	});
});
