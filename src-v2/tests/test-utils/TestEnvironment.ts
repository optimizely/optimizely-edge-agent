/**
 * TestEnvironment.ts
 * 
 * This file provides a compatibility layer for testing the adapter implementations
 * in a Node.js environment without requiring actual CDN runtime environments.
 */

import { vi } from 'vitest';
import type * as CF from '@cloudflare/workers-types';

/**
 * Creates a mock Cloudflare environment for testing
 */
export function createMockCloudflareEnvironment() {
  return {
    request: new Request('https://example.com/test'),
    env: {
      OPTLY_HYBRID_AGENT_KV: {
        get: vi.fn().mockResolvedValue('{"testKey":"testValue"}'),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] })
      } as unknown as CF.KVNamespace
    },
    ctx: {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    }
  };
}

/**
 * Creates a mock Vercel environment for testing
 */
export function createMockVercelEnvironment() {
  return {
    request: new Request('https://example.com/test'),
    env: {
      OPTLY_HYBRID_AGENT_KV: {
        get: vi.fn().mockResolvedValue('{"testKey":"testValue"}'),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [] })
      }
    },
    ctx: {
      waitUntil: vi.fn()
    }
  };
}

/**
 * Creates a mock Fastly environment for testing
 */
export function createMockFastlyEnvironment() {
  return {
    request: new Request('https://example.com/test'),
    env: {
      OPTLY_HYBRID_AGENT_KV: {
        get: vi.fn().mockResolvedValue('{"testKey":"testValue"}'),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined)
      }
    },
    ctx: {
      waitUntil: vi.fn()
    }
  };
}

/**
 * Helper function to create a test request with specific headers and body
 */
export function createTestRequest(url = 'https://example.com/test', options: RequestInit = {}) {
  return new Request(url, options);
}

/**
 * Helper function to mock console methods for testing loggers
 */
export function mockConsole() {
  const originalConsole = { ...console };
  const mockMethods = {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  };
  
  // Replace console methods
  console.log = mockMethods.log;
  console.info = mockMethods.info;
  console.warn = mockMethods.warn;
  console.error = mockMethods.error;
  console.debug = mockMethods.debug;
  
  // Return both for restoration
  return { mockMethods, originalConsole };
}

/**
 * Helper function to restore original console methods after testing
 */
export function restoreConsole(originalConsole: typeof console) {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;
} 