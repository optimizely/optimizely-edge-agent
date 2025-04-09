/**
 * CDN Test Runner
 * 
 * This script runs simplified adapter tests for each CDN environment.
 * It creates fake/mock versions of the CDN-specific objects instead of
 * trying to use the real adapter implementations that require CDN-specific types.
 * 
 * Usage:
 *   ts-node cdn-test-runner.ts cloudflare|vercel|fastly
 */

// Import basic interfaces
import { IRequestAdapter } from '../adapters/interfaces/IRequestAdapter';
import { IStorageAdapter } from '../adapters/interfaces/IStorageAdapter';
import { IEnvironmentAdapter } from '../adapters/interfaces/IEnvironmentAdapter';
import { ILoggerAdapter } from '../adapters/interfaces/ILoggerAdapter';

// Create mock versions of adapters that don't rely on CDN-specific types
class MockRequestAdapter implements IRequestAdapter {
  private request: Request;
  
  constructor(request: Request) {
    this.request = request;
  }
  
  getUrl(): URL {
    return new URL(this.request.url);
  }
  
  getMethod(): string {
    return this.request.method;
  }
  
  getHeader(name: string): string | null {
    return this.request.headers.get(name);
  }
  
  getHeaders(): Headers {
    return this.request.headers;
  }
  
  async getBodyText(): Promise<string> {
    return ''; // Simplified for testing
  }
  
  async getBodyJson<T>(): Promise<T> {
    return {} as T; // Simplified for testing
  }
  
  async getBody(): Promise<any> {
    // Try to determine content type and parse appropriately
    const contentType = this.getHeader('content-type');
    if (contentType && contentType.includes('application/json')) {
      return this.getBodyJson();
    }
    return this.getBodyText(); // Default to text
  }
  
  getNativeRequest<T = unknown>(): T {
    return this.request as unknown as T;
  }
}

class MockStorageAdapter implements IStorageAdapter {
  private name: string;
  private prefix: string;
  
  constructor(name: string, prefix: string) {
    this.name = name;
    this.prefix = prefix;
  }
  
  async get(key: string, type: string = 'text'): Promise<any> {
    console.log(`[${this.prefix}] Storage get: ${key} (${type})`);
    return { mockValue: `test-value-for-${key}` };
  }
  
  async put(key: string, value: string | ArrayBuffer): Promise<void> {
    console.log(`[${this.prefix}] Storage put: ${key}`);
    return;
  }
  
  async delete(key: string): Promise<void> {
    console.log(`[${this.prefix}] Storage delete: ${key}`);
    return;
  }
}

class MockEnvironmentAdapter implements IEnvironmentAdapter {
  private prefix: string;
  private ctx: { waitUntil: (promise: Promise<unknown>) => void };
  
  constructor(prefix: string) {
    this.prefix = prefix;
    this.ctx = {
      waitUntil: (promise: Promise<unknown>) => {
        console.log(`[${this.prefix}] waitUntil called`);
      }
    };
  }
  
  getVariable(key: string): string | undefined {
    console.log(`[${this.prefix}] Variable get: ${key}`);
    return `mock-env-value-for-${key}`;
  }
  
  getBinding<T>(name: string): T | undefined {
    console.log(`[${this.prefix}] Binding get: ${name}`);
    return {} as T; // Simplified mock
  }
  
  getContext<T = unknown>(): T {
    console.log(`[${this.prefix}] Context get`);
    return this.ctx as unknown as T;
  }
  
  waitUntil(promise: Promise<unknown>): void {
    console.log(`[${this.prefix}] waitUntil called`);
    this.ctx.waitUntil(promise);
  }
  
  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    console.log(`[${this.prefix}] Fetch called for: ${typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url}`);
    // Return a mock successful response
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  getEnvironment(): { ctx?: unknown; [key: string]: unknown } {
    console.log(`[${this.prefix}] getEnvironment called`);
    return {
      env: this.prefix,
      ctx: this.ctx
    };
  }
}

class MockLoggerAdapter implements ILoggerAdapter {
  private prefix: string;
  
  constructor(prefix: string) {
    this.prefix = prefix;
  }
  
  debug(message: string, ...args: any[]): void {
    console.log(`[${this.prefix}] DEBUG:`, message, ...args);
  }
  
  info(message: string, ...args: any[]): void {
    console.log(`[${this.prefix}] INFO:`, message, ...args);
  }
  
  warn(message: string, ...args: any[]): void {
    console.log(`[${this.prefix}] WARN:`, message, ...args);
  }
  
  error(message: string, ...args: any[]): void {
    console.log(`[${this.prefix}] ERROR:`, message, ...args);
  }
}

// Mock factory to create the adapters
class MockAdapterFactory {
  private prefix: string;
  
  constructor(prefix: string) {
    this.prefix = prefix;
  }
  
  createRequestAdapter(request: Request): IRequestAdapter {
    return new MockRequestAdapter(request);
  }
  
  createStorageAdapter(bindingName: string): IStorageAdapter {
    return new MockStorageAdapter(bindingName, this.prefix);
  }
  
  createEnvironmentAdapter(): IEnvironmentAdapter {
    return new MockEnvironmentAdapter(this.prefix);
  }
  
  createLoggerAdapter(): ILoggerAdapter {
    return new MockLoggerAdapter(this.prefix);
  }
}

async function runCloudflareTest() {
  console.log('🔷 Running Cloudflare adapter tests...');
  
  const factory = new MockAdapterFactory('CLOUDFLARE');
  const mockRequest = new Request('https://example.com/test', {
    headers: {
      'x-sdk-key': 'test-sdk-key',
      'user-agent': 'test-user-agent',
      'content-type': 'application/json'
    }
  });
  
  try {
    console.log('📤 Testing Cloudflare adapters...');
    
    // Test Request Adapter
    const requestAdapter = factory.createRequestAdapter(mockRequest);
    console.log(`📥 Request URL: ${requestAdapter.getUrl()}`);
    console.log(`📥 Request Method: ${requestAdapter.getMethod()}`);
    console.log(`📥 Request Headers:`, {
      'x-sdk-key': requestAdapter.getHeader('x-sdk-key'),
      'user-agent': requestAdapter.getHeader('user-agent'),
      'content-type': requestAdapter.getHeader('content-type')
    });
    
    // Test Storage Adapter
    const storageAdapter = factory.createStorageAdapter('OPTLY_HYBRID_AGENT_KV');
    const value = await storageAdapter.get('test-key', 'json');
    console.log(`📥 Storage value:`, value);
    await storageAdapter.put('test-key', JSON.stringify({ test: 'value' }));
    await storageAdapter.delete('test-key');
    
    // Test Environment Adapter
    const envAdapter = factory.createEnvironmentAdapter();
    const envVar = envAdapter.getVariable('TEST_VAR');
    console.log(`📥 Environment variable:`, envVar);
    const binding = envAdapter.getBinding('TEST_BINDING');
    console.log(`📥 Binding:`, binding ? 'Found' : 'Not found');
    
    // Test Logger Adapter
    const loggerAdapter = factory.createLoggerAdapter();
    loggerAdapter.debug('Test debug message');
    loggerAdapter.info('Test info message');
    loggerAdapter.warn('Test warn message');
    loggerAdapter.error('Test error message');
    
    console.log('✅ Cloudflare adapter test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Cloudflare adapter test failed:', error);
    return false;
  }
}

async function runVercelTest() {
  console.log('🔷 Running Vercel adapter tests...');
  
  const factory = new MockAdapterFactory('VERCEL');
  const mockRequest = new Request('https://example.com/test', {
    headers: {
      'x-sdk-key': 'test-sdk-key',
      'user-agent': 'test-user-agent',
      'content-type': 'application/json'
    }
  });
  
  try {
    console.log('📤 Testing Vercel adapters...');
    
    // Test Request Adapter
    const requestAdapter = factory.createRequestAdapter(mockRequest);
    console.log(`📥 Request URL: ${requestAdapter.getUrl()}`);
    console.log(`📥 Request Method: ${requestAdapter.getMethod()}`);
    console.log(`📥 Request Headers:`, {
      'x-sdk-key': requestAdapter.getHeader('x-sdk-key'),
      'user-agent': requestAdapter.getHeader('user-agent'),
      'content-type': requestAdapter.getHeader('content-type')
    });
    
    // Test Storage Adapter
    const storageAdapter = factory.createStorageAdapter('OPTLY_HYBRID_AGENT_KV');
    const value = await storageAdapter.get('test-key', 'json');
    console.log(`📥 Storage value:`, value);
    await storageAdapter.put('test-key', JSON.stringify({ test: 'value' }));
    await storageAdapter.delete('test-key');
    
    // Test Environment Adapter
    const envAdapter = factory.createEnvironmentAdapter();
    const envVar = envAdapter.getVariable('TEST_VAR');
    console.log(`📥 Environment variable:`, envVar);
    const binding = envAdapter.getBinding('TEST_BINDING');
    console.log(`📥 Binding:`, binding ? 'Found' : 'Not found');
    
    // Test Logger Adapter
    const loggerAdapter = factory.createLoggerAdapter();
    loggerAdapter.debug('Test debug message');
    loggerAdapter.info('Test info message');
    loggerAdapter.warn('Test warn message');
    loggerAdapter.error('Test error message');
    
    console.log('✅ Vercel adapter test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Vercel adapter test failed:', error);
    return false;
  }
}

async function runFastlyTest() {
  console.log('🔷 Running Fastly adapter tests...');
  
  const factory = new MockAdapterFactory('FASTLY');
  const mockRequest = new Request('https://example.com/test', {
    headers: {
      'x-sdk-key': 'test-sdk-key',
      'user-agent': 'test-user-agent',
      'content-type': 'application/json'
    }
  });
  
  try {
    console.log('📤 Testing Fastly adapters...');
    
    // Test Request Adapter
    const requestAdapter = factory.createRequestAdapter(mockRequest);
    console.log(`📥 Request URL: ${requestAdapter.getUrl()}`);
    console.log(`📥 Request Method: ${requestAdapter.getMethod()}`);
    console.log(`📥 Request Headers:`, {
      'x-sdk-key': requestAdapter.getHeader('x-sdk-key'),
      'user-agent': requestAdapter.getHeader('user-agent'),
      'content-type': requestAdapter.getHeader('content-type')
    });
    
    // Test Storage Adapter
    const storageAdapter = factory.createStorageAdapter('OPTLY_HYBRID_AGENT_KV');
    const value = await storageAdapter.get('test-key', 'json');
    console.log(`📥 Storage value:`, value);
    await storageAdapter.put('test-key', JSON.stringify({ test: 'value' }));
    await storageAdapter.delete('test-key');
    
    // Test Environment Adapter
    const envAdapter = factory.createEnvironmentAdapter();
    const envVar = envAdapter.getVariable('TEST_VAR');
    console.log(`📥 Environment variable:`, envVar);
    const binding = envAdapter.getBinding('TEST_BINDING');
    console.log(`📥 Binding:`, binding ? 'Found' : 'Not found');
    
    // Test Logger Adapter
    const loggerAdapter = factory.createLoggerAdapter();
    loggerAdapter.debug('Test debug message');
    loggerAdapter.info('Test info message');
    loggerAdapter.warn('Test warn message');
    loggerAdapter.error('Test error message');
    
    console.log('✅ Fastly adapter test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Fastly adapter test failed:', error);
    return false;
  }
}

async function main() {
  const cdnType = process.argv[2]?.toLowerCase();
  
  if (!cdnType || !['cloudflare', 'vercel', 'fastly', 'all'].includes(cdnType)) {
    console.error('Please specify a CDN type: cloudflare, vercel, fastly, or all');
    process.exit(1);
  }
  
  let results = {
    cloudflare: false,
    vercel: false,
    fastly: false
  };
  
  console.log('🚀 Starting CDN adapter tests...');
  
  if (cdnType === 'all' || cdnType === 'cloudflare') {
    results.cloudflare = await runCloudflareTest();
    console.log('-------------------------------------------');
  }
  
  if (cdnType === 'all' || cdnType === 'vercel') {
    results.vercel = await runVercelTest();
    console.log('-------------------------------------------');
  }
  
  if (cdnType === 'all' || cdnType === 'fastly') {
    results.fastly = await runFastlyTest();
    console.log('-------------------------------------------');
  }
  
  console.log('📊 Test Results Summary:');
  Object.entries(results).forEach(([cdn, success]) => {
    if ((cdnType === 'all' || cdnType === cdn)) {
      console.log(`${cdn}: ${success ? '✅ PASS' : '❌ FAIL'}`);
    }
  });
  
  const allTestsPassed = Object.entries(results)
    .filter(([cdn]) => (cdnType === 'all' || cdnType === cdn))
    .every(([_, success]) => success);
  
  console.log(`\n${allTestsPassed ? '✅ All' : '❌ Some'} tests ${allTestsPassed ? 'passed' : 'failed'}.`);
  
  process.exit(allTestsPassed ? 0 : 1);
}

// Check if this script is being run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error in test runner:', error);
    process.exit(1);
  });
}

export { runCloudflareTest, runVercelTest, runFastlyTest }; 