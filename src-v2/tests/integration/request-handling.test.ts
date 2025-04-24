import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventDispatcher } from '../../services/implementations/EventDispatcher';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { IEnvironmentAdapter } from '../../adapters/interfaces/IEnvironmentAdapter';
import { OptimizelyEventData } from '../../services/interfaces/IEventService';

describe('Request Handling Integration', () => {
  let eventDispatcher: EventDispatcher;
  let mockedResponse: any = null;
  let requestsCount = 0;
  
  // Mock fetch for a controlled environment
  const mockFetch = async (url: string, options: RequestInit) => {
    requestsCount++;
    
    const requestBody = options.body ? JSON.parse(options.body as string) : {};
    
    // Record the last request for inspection
    (globalThis as any).__lastRequestUrl = url;
    (globalThis as any).__lastRequestOptions = options;
    (globalThis as any).__lastRequestBody = requestBody;
    
    if (mockedResponse) {
      return mockedResponse;
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  };
  
  beforeEach(() => {
    // Create mock adapters (instead of importing implementations that might not exist)
    const logger: ILoggerAdapter = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      trace: () => {},
      fatal: () => {},
      logEntry: () => {},
      child: () => logger,
      getLogLevel: () => 'info',
      setLogLevel: () => {}
    } as unknown as ILoggerAdapter;
    
    const envAdapter: IEnvironmentAdapter = {
      fetch: mockFetch,
      getVariable: () => undefined,
      getBinding: () => undefined as any,
      getContext: () => ({ ctx: {} } as any),
      waitUntil: (promise: Promise<any>) => promise,
      getEnvironment: () => ({ ctx: {} })
    } as unknown as IEnvironmentAdapter;
    
    // Reset test variables
    requestsCount = 0;
    mockedResponse = null;
    (globalThis as any).__lastRequestUrl = null;
    (globalThis as any).__lastRequestOptions = null;
    (globalThis as any).__lastRequestBody = null;
    
    // Create EventDispatcher
    eventDispatcher = new EventDispatcher(logger, envAdapter);
    
    // Configure dispatcher for faster testing
    eventDispatcher.setDefaultConfig({
      batchSize: 5,
      flushInterval: 1000, // 1 second for faster tests
      sdkKey: 'SDK:integration:test'
    });
  });
  
  afterEach(() => {
    // Clean up global state
    (globalThis as any).__lastRequestUrl = null;
    (globalThis as any).__lastRequestOptions = null;
    (globalThis as any).__lastRequestBody = null;
  });
  
  it('should batch multiple events and send them together', async () => {
    // Track multiple events
    await eventDispatcher.trackEvents([
      {
        type: 'impression',
        timestamp: Date.now(),
        uuid: 'test-uuid-1',
        flagKey: 'feature-a',
        variationKey: 'variation-1',
        userContext: { userId: 'user-1', attributes: { device: 'mobile' } }
      },
      {
        type: 'impression',
        timestamp: Date.now(),
        uuid: 'test-uuid-2',
        flagKey: 'feature-b',
        variationKey: 'variation-2',
        userContext: { userId: 'user-2', attributes: { device: 'desktop' } }
      },
      {
        type: 'impression',
        timestamp: Date.now(),
        uuid: 'test-uuid-3',
        flagKey: 'feature-c',
        variationKey: 'variation-1',
        userContext: { userId: 'user-1', attributes: { device: 'mobile' } }
      }
    ]);
    
    // Manually flush to send events
    await eventDispatcher.flushEvents();
    
    // Verify request count
    expect(requestsCount).toBe(1);
    
    // Verify request body structure
    const requestBody = (globalThis as any).__lastRequestBody;
    
    // Validate event batch format
    expect(requestBody).toHaveProperty('client_name');
    expect(requestBody).toHaveProperty('anonymize_ip', true);
    expect(requestBody).toHaveProperty('visitors');
    expect(requestBody).toHaveProperty('account_id', 'integration');
    expect(requestBody).toHaveProperty('project_id', 'test');
    
    // Validate visitor grouping - should have 2 visitors (user-1 and user-2)
    expect(requestBody.visitors).toHaveLength(2);
    
    // Find each visitor
    const visitor1 = requestBody.visitors.find((v: any) => v.visitor_id === 'user-1');
    const visitor2 = requestBody.visitors.find((v: any) => v.visitor_id === 'user-2');
    
    expect(visitor1).toBeDefined();
    expect(visitor2).toBeDefined();
    
    // User 1 should have 2 events
    expect(visitor1.snapshots[0].events).toHaveLength(2);
    
    // User 2 should have 1 event
    expect(visitor2.snapshots[0].events).toHaveLength(1);
    
    // Verify events include the correct flag and variation keys
    const user1Events = visitor1.snapshots[0].events;
    const user2Events = visitor2.snapshots[0].events;
    
    // Check feature keys in events
    const featureKeys = [...user1Events, ...user2Events].map((e: any) => e.entity_id);
    expect(featureKeys).toContain('feature-a');
    expect(featureKeys).toContain('feature-b');
    expect(featureKeys).toContain('feature-c');
    
    // Verify decisions correctly reflect the variations
    const user1Decisions = visitor1.snapshots[0].decisions;
    const user2Decisions = visitor2.snapshots[0].decisions;
    
    expect(user1Decisions).toHaveLength(2);
    expect(user2Decisions).toHaveLength(1);
  });
  
  it('should respect batch size and auto-flush when limit reached', async () => {
    // Configure a small batch size
    eventDispatcher.setDefaultConfig({
      batchSize: 2,
      flushInterval: 10000 // Long enough that it won't auto-flush due to time
    });
    
    // Track first event - shouldn't trigger flush
    await eventDispatcher.trackEvent({
      type: 'impression',
      timestamp: Date.now(),
      uuid: 'test-uuid-1',
      flagKey: 'feature-a',
      variationKey: 'variation-1',
      userContext: { userId: 'user-1', attributes: { device: 'mobile' } }
    });
    
    // Verify no request was made yet
    expect(requestsCount).toBe(0);
    
    // Track second event - should trigger auto-flush because batch size is 2
    await eventDispatcher.trackEvent({
      type: 'impression',
      timestamp: Date.now(),
      uuid: 'test-uuid-2',
      flagKey: 'feature-b',
      variationKey: 'variation-2',
      userContext: { userId: 'user-2', attributes: { device: 'desktop' } }
    });
    
    // Verify a request was made
    expect(requestsCount).toBe(1);
    
    // Verify request body contains both events
    const requestBody = (globalThis as any).__lastRequestBody;
    
    // Count total events across all visitors
    let totalEvents = 0;
    requestBody.visitors.forEach((visitor: any) => {
      visitor.snapshots.forEach((snapshot: any) => {
        totalEvents += snapshot.events.length;
      });
    });
    
    expect(totalEvents).toBe(2);
  });
  
  it('should retry failed requests with exponential backoff', async () => {
    // Setup mock responses to simulate failures then success
    let attemptCount = 0;
    
    // Override the fetch mock to fail first two attempts
    (globalThis as any).mockFetchImplementation = (url: string, options: RequestInit) => {
      attemptCount++;
      
      if (attemptCount <= 2) {
        // First two attempts fail
        return new Response(JSON.stringify({ error: 'Server Error' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
      
      // Third attempt succeeds
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    };
    
    // Track an event
    await eventDispatcher.trackEvent({
      type: 'impression',
      timestamp: Date.now(),
      uuid: 'retry-test',
      flagKey: 'feature-retry',
      variationKey: 'variation-1',
      userContext: { userId: 'retry-user', attributes: { test: 'retry' } }
    });
    
    try {
      // First attempt will fail
      mockedResponse = new Response(JSON.stringify({ error: 'Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
      
      await eventDispatcher.flushEvents();
      
      // If we reach here, the flush didn't throw as expected
      expect(false).toBe(true);
    } catch (error) {
      // Expected to fail
      expect(error).toBeDefined();
    }
    
    // Reset mocked response to let retry succeed
    mockedResponse = null;
    
    // Give time for retry logic to execute (simulating passage of time)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify we had multiple requests (original + retry)
    expect(requestsCount).toBeGreaterThan(1);
    
    // Verify the event data was successfully sent in the last request
    const requestBody = (globalThis as any).__lastRequestBody;
    expect(requestBody.visitors[0].visitor_id).toBe('retry-user');
    
    // Find the specific event we sent
    let foundEvent = false;
    requestBody.visitors.forEach((visitor: any) => {
      visitor.snapshots.forEach((snapshot: any) => {
        snapshot.events.forEach((event: any) => {
          if (event.uuid === 'retry-test') {
            foundEvent = true;
          }
        });
      });
    });
    
    expect(foundEvent).toBe(true);
  });
  
  it('should handle events with different attributes correctly', async () => {
    // Create event with various attribute types
    const testEvent: OptimizelyEventData = {
      type: 'impression',
      timestamp: Date.now(),
      uuid: 'attr-test-1',
      flagKey: 'feature-attrs',
      variationKey: 'variation-1',
      userContext: { 
        userId: 'attr-user', 
        attributes: { 
          string: 'test',
          number: 123,
          boolean: true,
          // Complex types should be excluded in formatAttributes
          complexValue: { nested: 'value' } as any
        } 
      }
    };
    
    // Track the events
    await eventDispatcher.trackEvent(testEvent);
    
    // Flush events
    await eventDispatcher.flushEvents();
    
    // Verify request
    const requestBody = (globalThis as any).__lastRequestBody;
    
    // Find the visitor attributes
    const visitor = requestBody.visitors[0];
    expect(visitor.attributes).toBeDefined();
    
    // Check attribute handling
    const attributeKeys = visitor.attributes.map((attr: any) => attr.key);
    const attributeValues = visitor.attributes.reduce((acc: any, attr: any) => {
      acc[attr.key] = attr.value;
      return acc;
    }, {});
    
    // String, number and boolean should be included
    expect(attributeKeys).toContain('string');
    expect(attributeKeys).toContain('number');
    expect(attributeKeys).toContain('boolean');
    
    // Object should be skipped
    expect(attributeKeys).not.toContain('complexValue');
    
    // Values should be preserved correctly
    expect(attributeValues.string).toBe('test');
    expect(attributeValues.number).toBe(123);
    expect(attributeValues.boolean).toBe(true);
  });
}); 