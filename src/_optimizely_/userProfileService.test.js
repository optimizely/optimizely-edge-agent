import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import UserProfileService from './userProfileService';
import * as optlyHelper from '../_helpers_/optimizelyHelper';

// Mock the logger
vi.mock('../_helpers_/optimizelyHelper', () => ({
    logger: vi.fn(() => ({
        debug: vi.fn(),
        error: vi.fn()
    })),
    safelyParseJSON: vi.fn(),
    safelyStringifyJSON: vi.fn(),
    isValidObject: vi.fn()
}));

describe('UserProfileService', () => {
    let userProfileService;
    let mockKVStore;
    const testSdkKey = 'test-sdk-key';
    const testVisitorId = 'test-visitor';
    const testUserKey = 'optly-ups-test-sdk-key-test-visitor';

    beforeEach(() => {
        mockKVStore = {
            get: vi.fn(),
            put: vi.fn()
        };
        userProfileService = new UserProfileService(mockKVStore, testSdkKey);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with correct properties', () => {
            expect(userProfileService.kvStore).toBe(mockKVStore);
            expect(userProfileService.sdkKey).toBe(testSdkKey);
            expect(userProfileService.UPS_LS_PREFIX).toBe('optly-ups');
            expect(userProfileService.cache).toBeInstanceOf(Map);
        });
    });

    describe('getUserKey', () => {
        it('should generate correct user key', () => {
            const key = userProfileService.getUserKey(testVisitorId);
            expect(key).toBe(testUserKey);
        });
    });

    describe('read', () => {
        it('should return cached data if available', async () => {
            const testData = { test: 'data' };
            userProfileService.cache.set(testUserKey, testData);
            
            const result = await userProfileService.read(testUserKey);
            expect(result).toEqual(testData);
        });

        it('should fetch and cache data from KV store if not in cache', async () => {
            const testData = { test: 'data' };
            mockKVStore.get.mockResolvedValue(JSON.stringify(testData));
            optlyHelper.safelyParseJSON.mockReturnValue(testData);

            const result = await userProfileService.read(testUserKey);
            
            expect(mockKVStore.get).toHaveBeenCalledWith(testUserKey);
            expect(result).toEqual(testData);
            expect(userProfileService.cache.get(testUserKey)).toEqual(testData);
        });

        it('should return empty object if no data found', async () => {
            mockKVStore.get.mockResolvedValue(null);
            
            const result = await userProfileService.read(testUserKey);
            expect(result).toEqual({});
        });
    });

    describe('write', () => {
        it('should write new data to KV store and cache', async () => {
            const testData = {
                experiment_bucket_map: {
                    exp1: { variation_id: 'var1' }
                }
            };
            optlyHelper.safelyStringifyJSON.mockReturnValue(JSON.stringify(testData));

            await userProfileService.write(testUserKey, testData);

            expect(mockKVStore.put).toHaveBeenCalledWith(testUserKey, JSON.stringify(testData));
            expect(userProfileService.cache.get(testUserKey)).toEqual(testData);
        });

        it('should merge experiment bucket map with existing data', async () => {
            const existingData = {
                experiment_bucket_map: {
                    exp1: { variation_id: 'var1' }
                }
            };
            const newData = {
                experiment_bucket_map: {
                    exp2: { variation_id: 'var2' }
                }
            };
            const expectedData = {
                experiment_bucket_map: {
                    exp1: { variation_id: 'var1' },
                    exp2: { variation_id: 'var2' }
                }
            };

            userProfileService.cache.set(testUserKey, existingData);
            optlyHelper.isValidObject.mockReturnValue(true);
            optlyHelper.safelyStringifyJSON.mockReturnValue(JSON.stringify(expectedData));

            await userProfileService.write(testUserKey, newData);

            expect(mockKVStore.put).toHaveBeenCalledWith(testUserKey, JSON.stringify(expectedData));
            expect(userProfileService.cache.get(testUserKey)).toEqual(expectedData);
        });
    });

    describe('lookup', () => {
        it('should lookup user profile data', async () => {
            const testData = { test: 'data' };
            mockKVStore.get.mockResolvedValue(JSON.stringify(testData));
            optlyHelper.safelyParseJSON.mockReturnValue(testData);

            const result = await userProfileService.lookup(testVisitorId);

            expect(result).toEqual(testData);
            expect(mockKVStore.get).toHaveBeenCalledWith(testUserKey);
        });

        it('should return empty object on error', async () => {
            mockKVStore.get.mockRejectedValue(new Error('Test error'));

            const result = await userProfileService.lookup(testVisitorId);

            expect(result).toEqual({});
        });
    });

    describe('saveSync', () => {
        it('should update cache synchronously', () => {
            const testData = { user_id: testVisitorId, test: 'data' };
            
            userProfileService.saveSync(testData);
            
            expect(userProfileService.cache.get(testUserKey)).toEqual(testData);
        });
    });

    describe('getUserProfileFromCache', () => {
        it('should return cached profile data', () => {
            const testData = { test: 'data' };
            userProfileService.cache.set(testUserKey, testData);

            const result = userProfileService.getUserProfileFromCache(testVisitorId);

            expect(result).toEqual({
                key: testUserKey,
                userProfileMap: testData
            });
        });

        it('should return empty object if no cached data', () => {
            const result = userProfileService.getUserProfileFromCache(testVisitorId);

            expect(result).toEqual({
                key: testUserKey,
                userProfileMap: {}
            });
        });
    });

    describe('prefetchUserProfiles', () => {
        it('should prefetch multiple user profiles', async () => {
            const visitorIds = ['visitor1', 'visitor2'];
            const testData = { test: 'data' };
            mockKVStore.get.mockResolvedValue(JSON.stringify(testData));
            optlyHelper.safelyParseJSON.mockReturnValue(testData);

            await userProfileService.prefetchUserProfiles(visitorIds);

            expect(mockKVStore.get).toHaveBeenCalledTimes(2);
            visitorIds.forEach(id => {
                const key = userProfileService.getUserKey(id);
                expect(mockKVStore.get).toHaveBeenCalledWith(key);
            });
        });
    });

    describe('getUserProfileSync', () => {
        it('should return cached profile synchronously', () => {
            const testData = { test: 'data' };
            userProfileService.cache.set(testUserKey, testData);

            const result = userProfileService.getUserProfileSync(testVisitorId);

            expect(result).toEqual(testData);
        });

        it('should return empty object if no cached data', () => {
            const result = userProfileService.getUserProfileSync(testVisitorId);

            expect(result).toEqual({});
        });
    });
});
