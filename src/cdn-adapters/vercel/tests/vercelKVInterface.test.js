import { describe, it, expect, vi, beforeEach } from 'vitest';
import VercelKVInterface from '../vercelKVInterface';

// Mock the @vercel/kv module; this must remain hoisted above the import
vi.mock('@vercel/kv', () => ({
    kv: {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn()
    }
}));

// Import the mocked module
import { kv } from '@vercel/kv';

describe('VercelKVInterface', () => {
    const testNamespace = 'TEST_KV';
    let kvInterface;
    let env;

    beforeEach(() => {
        vi.clearAllMocks();
        env = {
            [testNamespace]: 'test-namespace'
        };
        kvInterface = new VercelKVInterface(env, testNamespace);
    });

    describe('constructor', () => {
        it('should throw error if env is not provided', () => {
            expect(() => new VercelKVInterface(null, testNamespace))
                .toThrow('Environment object must be provided');
        });

        it('should throw error if kvNamespace is not provided', () => {
            expect(() => new VercelKVInterface(env, null))
                .toThrow('KV namespace name must be provided');
        });

        it('should throw error if namespace is not found in env', () => {
            expect(() => new VercelKVInterface(env, 'NONEXISTENT_KV'))
                .toThrow('KV namespace NONEXISTENT_KV is not available in env.');
        });

        it('should create instance successfully with valid inputs', () => {
            expect(() => new VercelKVInterface(env, testNamespace)).not.toThrow();
            expect(kvInterface.kvNamespace).toBe('test-namespace');
        });
    });

    describe('get', () => {
        it('should return null when key not found', async () => {
            kv.get.mockResolvedValue(null);
            const result = await kvInterface.get('nonexistent-key');
            expect(result).toBeNull();
            expect(kv.get).toHaveBeenCalledWith('test-namespace:nonexistent-key');
        });

        it('should return string value when key exists', async () => {
            kv.get.mockResolvedValue('test-value');
            const result = await kvInterface.get('existing-key');
            expect(result).toBe('test-value');
            expect(kv.get).toHaveBeenCalledWith('test-namespace:existing-key');
        });

        it('should handle errors gracefully', async () => {
            kv.get.mockRejectedValue(new Error('KV error'));
            const result = await kvInterface.get('error-key');
            expect(result).toBeNull();
            expect(kv.get).toHaveBeenCalledWith('test-namespace:error-key');
        });
    });

    describe('put', () => {
        it('should set value successfully', async () => {
            kv.set.mockResolvedValue(undefined);
            await kvInterface.put('test-key', 'test-value');
            expect(kv.set).toHaveBeenCalledWith('test-namespace:test-key', 'test-value');
        });

        it('should handle errors gracefully', async () => {
            kv.set.mockRejectedValue(new Error('KV error'));
            await kvInterface.put('error-key', 'error-value');
            expect(kv.set).toHaveBeenCalledWith('test-namespace:error-key', 'error-value');
        });
    });

    describe('delete', () => {
        it('should delete key successfully', async () => {
            kv.del.mockResolvedValue(undefined);
            await kvInterface.delete('test-key');
            expect(kv.del).toHaveBeenCalledWith('test-namespace:test-key');
        });

        it('should handle errors gracefully', async () => {
            kv.del.mockRejectedValue(new Error('KV error'));
            await kvInterface.delete('error-key');
            expect(kv.del).toHaveBeenCalledWith('test-namespace:error-key');
        });
    });
});
