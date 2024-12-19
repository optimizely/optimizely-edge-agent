import VercelKVInterface from '../vercelKVInterface.js';
import { kv } from '@vercel/kv';
import { logger } from '../../_helpers_/optimizelyHelper.js';

vi.mock('@vercel/kv');
vi.mock('../../_helpers_/optimizelyHelper.js');

describe('VercelKVInterface', () => {
    let kvInterface;
    const mockNamespace = 'testingNamespace';
    const mockEnv = { kvNamespace: mockNamespace };

    beforeEach(() => {
        kvInterface = new VercelKVInterface(mockEnv, mockNamespace);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test('should return the correct value for a valid key', async () => {
        const key = 'testKey';
        const value = 'testValue';
        kv.get.mockResolvedValue(value);

        const result = await kvInterface.get(key);

        expect(result).toBe(value);
        expect(kv.get).toHaveBeenCalledWith(`${mockNamespace}:${key}`);
    });

    test('should return null for a non-existent key', async () => {
        const key = 'nonExistentKey';
        kv.get.mockResolvedValue(null);

        const result = await kvInterface.get(key);

        expect(result).toBeNull();
        expect(kv.get).toHaveBeenCalledWith(`${mockNamespace}:${key}`);
    });

    test('should log an error when an exception occurs', async () => {
        const key = 'errorKey';
        const errorMessage = 'Error getting value';
        kv.get.mockRejectedValue(new Error(errorMessage));

        await kvInterface.get(key);

        expect(logger().error).toHaveBeenCalledWith(`Error getting value for key ${key}:`, expect.any(Error));
    });
});