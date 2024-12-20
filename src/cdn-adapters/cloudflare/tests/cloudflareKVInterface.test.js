import { describe, it, expect, vi, beforeEach } from 'vitest'
import CloudflareKVInterface from '../cloudflareKVInterface'

describe('CloudflareKVInterface', () => {
  let kvInterface
  let mockNamespace

  beforeEach(() => {
    mockNamespace = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    }
    const mockEnv = {
      testNamespace: mockNamespace
    }
    kvInterface = new CloudflareKVInterface(mockEnv, 'testNamespace')
  })

  describe('constructor', () => {
    it('should throw error if env is not provided', () => {
      expect(() => new CloudflareKVInterface(null, 'testNamespace')).toThrow()
    })
  })

  describe('get', () => {
    it('should call namespace.get with the correct key', async () => {
      const testKey = 'test-key'
      const expectedValue = 'test-value'
      mockNamespace.get.mockResolvedValue(expectedValue)

      const result = await kvInterface.get(testKey)

      expect(mockNamespace.get).toHaveBeenCalledWith(testKey)
      expect(result).toBe(expectedValue)
    })

    it('should return null for non-existent key', async () => {
      const testKey = 'non-existent-key'
      mockNamespace.get.mockResolvedValue(null)

      const result = await kvInterface.get(testKey)

      expect(mockNamespace.get).toHaveBeenCalledWith(testKey)
      expect(result).toBeNull()
    })

    it('should handle empty key', async () => {
      const testKey = ''
      mockNamespace.get.mockResolvedValue(null)

      const result = await kvInterface.get(testKey)

      expect(mockNamespace.get).toHaveBeenCalledWith(testKey)
      expect(result).toBeNull()
    })

    it('should handle KV store errors', async () => {
      const testKey = 'error-key'
      const error = new Error('KV store error')
      mockNamespace.get.mockRejectedValue(error)

      await expect(kvInterface.get(testKey)).rejects.toThrow('KV store error')
    })
  })

  describe('put', () => {
    it('should call namespace.put with the correct key and value', async () => {
      const testKey = 'test-key'
      const testValue = 'test-value'
      mockNamespace.put.mockResolvedValue(undefined)

      await kvInterface.put(testKey, testValue)

      expect(mockNamespace.put).toHaveBeenCalledWith(testKey, testValue)
    })

    it('should handle empty key and value', async () => {
      const testKey = ''
      const testValue = ''
      mockNamespace.put.mockResolvedValue(undefined)

      await kvInterface.put(testKey, testValue)

      expect(mockNamespace.put).toHaveBeenCalledWith(testKey, testValue)
    })

    it('should handle KV store errors during put', async () => {
      const testKey = 'error-key'
      const testValue = 'error-value'
      const error = new Error('KV store put error')
      mockNamespace.put.mockRejectedValue(error)

      await expect(kvInterface.put(testKey, testValue)).rejects.toThrow('KV store put error')
    })
  })

  describe('delete', () => {
    it('should call namespace.delete with the correct key', async () => {
      const testKey = 'test-key'
      mockNamespace.delete.mockResolvedValue(undefined)

      await kvInterface.delete(testKey)

      expect(mockNamespace.delete).toHaveBeenCalledWith(testKey)
    })

    it('should handle empty key', async () => {
      const testKey = ''
      mockNamespace.delete.mockResolvedValue(undefined)

      await kvInterface.delete(testKey)

      expect(mockNamespace.delete).toHaveBeenCalledWith(testKey)
    })

    it('should handle KV store errors during delete', async () => {
      const testKey = 'error-key'
      const error = new Error('KV store delete error')
      mockNamespace.delete.mockRejectedValue(error)

      await expect(kvInterface.delete(testKey)).rejects.toThrow('KV store delete error')
    })
  })
})
