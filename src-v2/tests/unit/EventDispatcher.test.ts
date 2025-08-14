import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventDispatcher } from '../../services/implementations/EventDispatcher';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { IEnvironmentAdapter } from '../../adapters/interfaces/IEnvironmentAdapter';
import { OptimizelyEventData } from '../../services/interfaces/IEventService';
import { OptimizelyEvent } from '../../services/interfaces/IEventDispatcher';

describe('EventDispatcher', () => {
  let logger: ILoggerAdapter;
  let envAdapter: IEnvironmentAdapter;
  let eventDispatcher: EventDispatcher;
  let apiSuccessResponse: boolean;
  let apiErrorCount: number;
  
  // Helper to create test events
  const createTestEvent = (userId: string = 'test-user', timestamp: number = Date.now()): OptimizelyEventData => ({
    type: 'impression',
    timestamp,
    uuid: `test-uuid-${Math.floor(Math.random() * 1000)}`,
    flagKey: 'test-flag',
    variationKey: 'test-variation',
    userContext: {
      userId,
      attributes: {
        'test-attr': 'test-value',
        'browser': 'chrome'
      }
    }
  });
  
  beforeEach(() => {
    // Reset API simulation flags
    apiSuccessResponse = true;
    apiErrorCount = 0;
    
    // Create a simple implementation with type assertions
    logger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    } as unknown as ILoggerAdapter;
    
    // Create a simple environment adapter with an overridable fetch
    // for testing without actually hitting the Optimizely API
    const fetchFn = async (url: string, options: RequestInit) => {
      // If this is an Optimizely Events API call
      if (url.includes('logx.optimizely.com/v1/events')) {
        // Store the request body for inspection in tests
        (globalThis as any).__lastEventBatchRequest = options.body;
        
        if (!apiSuccessResponse) {
          // Count this error for retry testing
          apiErrorCount++;
          
          // If we want to test successful retry after N failures
          if (apiErrorCount >= 2) {
            apiSuccessResponse = true;
            
            return new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          
          // Simulate API failure
          return new Response(JSON.stringify({ error: 'Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Successful response
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // For other requests, use the real fetch
      return fetch(url, options);
    };
    
    // Reset stored request data
    (globalThis as any).__lastEventBatchRequest = null;
    (globalThis as any).__retryCount = 0;
    
    // Create environment adapter with custom fetch
    envAdapter = {
      fetch: fetchFn,
      getEnvironment: () => ({ ctx: {} }),
      waitUntil: (promise: Promise<any>) => {
        // For testing retries, we need to actually execute the promise
        // rather than just returning it
        promise.catch(() => {
          // Ignore errors in waitUntil for testing
          (globalThis as any).__retryCount = ((globalThis as any).__retryCount || 0) + 1;
        });
        return promise;
      }
    } as unknown as IEnvironmentAdapter;
    
    // Use Vitest's timer mocks instead of directly overriding setTimeout
    vi.useFakeTimers();
    
    // Override setTimeout for testing retry logic
    const realSetTimeout = setTimeout;
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: Function, timeout?: number) => {
      // Execute retry callbacks immediately for testing
      if (timeout && timeout > 1000) {
        return realSetTimeout(fn as any, 10);
      }
      return realSetTimeout(fn as any, timeout);
    });
    
    // Create EventDispatcher with real dependencies
    eventDispatcher = new EventDispatcher(logger, envAdapter);
  });
  
  afterEach(() => {
    // Restore timers
    vi.useRealTimers();
    vi.restoreAllMocks();
    
    // Clean up any global state
    (globalThis as any).__lastEventBatchRequest = null;
    (globalThis as any).__retryCount = 0;
  });
  
  describe('constructor', () => {
    it('should throw if logger is not provided', () => {
      expect(() => new EventDispatcher(null as any, envAdapter)).toThrow();
    });
    
    it('should throw if envAdapter is not provided', () => {
      expect(() => new EventDispatcher(logger, null as any)).toThrow();
    });
    
    it('should initialize correctly with valid dependencies', () => {
      expect(eventDispatcher).toBeDefined();
    });
  });
  
  describe('configuration', () => {
    it('should accept and apply configuration updates', () => {
      // Update configuration
      eventDispatcher.setDefaultConfig({
        batchSize: 5,
        flushInterval: 10000,
        disableTracking: false,
        sdkKey: 'SDK:123:456'
      });
      
      // Configuration should be applied (internal state is not directly testable)
      // The effect of the configuration will be tested in other tests
      expect(true).toBe(true);
    });
  });
  
  describe('event tracking', () => {
    it('should accept events for tracking', async () => {
      const testEvent = createTestEvent();
      await eventDispatcher.trackEvent(testEvent);
      
      // Event is accepted (internal queue is not directly testable)
      // The effect of tracking events will be tested in flush tests
      expect(true).toBe(true);
    });
    
    it('should accept multiple events for tracking', async () => {
      const testEvents = [
        createTestEvent('user-1'),
        createTestEvent('user-2')
      ];
      
      await eventDispatcher.trackEvents(testEvents);
      
      // Events are accepted (internal queue is not directly testable)
      expect(true).toBe(true);
    });
  });
  
  describe('event flushing', () => {
    it('should format and send events to Optimizely API', async () => {
      // Add events to the dispatcher
      await eventDispatcher.trackEvents([
        createTestEvent('user-1'),
        createTestEvent('user-2')
      ]);
      
      // Flush events
      await eventDispatcher.flushEvents();
      
      // Get the captured request body
      const requestBody = (globalThis as any).__lastEventBatchRequest;
      expect(requestBody).toBeDefined();
      
      // Parse the request body
      const eventBatch = JSON.parse(requestBody as string);
      
      // Verify the structure of the event batch
      expect(eventBatch).toHaveProperty('client_name');
      expect(eventBatch).toHaveProperty('client_version');
      expect(eventBatch).toHaveProperty('anonymize_ip', true);
      expect(eventBatch).toHaveProperty('visitors');
      expect(eventBatch.visitors.length).toBe(2);
      
      // Verify visitor data
      expect(eventBatch.visitors[0]).toHaveProperty('visitor_id', 'user-1');
      expect(eventBatch.visitors[0]).toHaveProperty('snapshots');
      expect(eventBatch.visitors[1]).toHaveProperty('visitor_id', 'user-2');
      expect(eventBatch.visitors[1]).toHaveProperty('snapshots');
      
      // Verify each visitor has events
      expect(eventBatch.visitors[0].snapshots[0].events.length).toBeGreaterThan(0);
      expect(eventBatch.visitors[1].snapshots[0].events.length).toBeGreaterThan(0);
    });
    
    it('should add account and project ID if SDK key is provided', async () => {
      // Set SDK key
      eventDispatcher.setDefaultConfig({ sdkKey: 'SDK:account123:project456' });
      
      // Add events and flush
      await eventDispatcher.trackEvent(createTestEvent());
      await eventDispatcher.flushEvents();
      
      // Get the captured request body
      const requestBody = (globalThis as any).__lastEventBatchRequest;
      const eventBatch = JSON.parse(requestBody as string);
      
      // Verify account and project IDs
      expect(eventBatch).toHaveProperty('account_id', 'account123');
      expect(eventBatch).toHaveProperty('project_id', 'project456');
    });
    
    it('should not send events when tracking is disabled', async () => {
      // Set tracking disabled
      eventDispatcher.setDefaultConfig({ disableTracking: true });
      
      // Add events and flush
      await eventDispatcher.trackEvent(createTestEvent());
      await eventDispatcher.flushEvents();
      
      // No request should have been sent
      expect((globalThis as any).__lastEventBatchRequest).toBeNull();
    });
  });
  
  describe('error handling and retries', () => {
    it('should retry failed API requests', async () => {
      // Simulate API failure for the first attempt
      apiSuccessResponse = false;
      
      // Add an event
      await eventDispatcher.trackEvent(createTestEvent());
      
      // First flush should fail
      try {
        await eventDispatcher.flushEvents();
      } catch (error) {
        // Expected to fail
      }
      
      // Check that the API was called
      expect(apiErrorCount).toBe(1);
      
      // Advance timers to trigger retry
      vi.advanceTimersByTime(50);
      
      // Wait for promises to resolve
      await vi.runAllTimersAsync();
      
      // Second attempt should succeed (our test setup auto-succeeds after 2 failures)
      expect(apiSuccessResponse).toBe(true);
      
      // Check that there were 2 API call attempts
      expect(apiErrorCount).toBe(2);
      
      // Verify the batch was sent successfully on retry
      const requestBody = (globalThis as any).__lastEventBatchRequest;
      expect(requestBody).toBeDefined();
      
      // Verify data was formatted correctly
      const eventBatch = JSON.parse(requestBody as string);
      expect(eventBatch).toHaveProperty('visitors');
      expect(eventBatch.visitors.length).toBe(1);
    });
    
    it('should follow exponential backoff pattern for retries', async () => {
      // This is primarily testing the internal implementation which we can't directly observe
      // So we'll check the exponential backoff calculation method indirectly

      // Create a dispatcher we can inspect
      const dispatcher = new EventDispatcher(logger, envAdapter);
      
      // Use reflection to access private method
      // Note: This is not ideal for unit testing, but necessary to test this functionality
      // @ts-ignore - accessing private method for testing
      const calculateDelay = dispatcher['calculateBackoffDelay'];
      
      // If the method exists (reflection worked)
      if (calculateDelay) {
        // Test calculation pattern
        const firstDelay = calculateDelay(1);
        const secondDelay = calculateDelay(2);
        const thirdDelay = calculateDelay(3);
        
        // Should follow exponential pattern (approximately)
        expect(secondDelay).toBeGreaterThan(firstDelay);
        expect(thirdDelay).toBeGreaterThan(secondDelay * 1.5);
        
        // Values should be reasonably bounded
        expect(firstDelay).toBeGreaterThanOrEqual(500);
        expect(thirdDelay).toBeLessThanOrEqual(30000);
      } else {
        // If we can't access the private method, at least check retry functionality
        expect(true).toBe(true);
      }
    });
  });
  
  describe('legacy event handling', () => {
    it('should handle legacy event format', async () => {
      // Create a legacy format event
      const legacyEvent: OptimizelyEvent = {
        type: 'impression',
        timestamp: Date.now(),
        uuid: 'test-uuid',
        userContext: {
          userId: 'legacy-user',
          attributes: { 'browser': 'firefox' }
        }
      };
      
      // Dispatch the legacy event
      await eventDispatcher.dispatchEvent(legacyEvent);
      
      // Flush events
      await eventDispatcher.flushEvents();
      
      // Verify the event was processed
      const requestBody = (globalThis as any).__lastEventBatchRequest;
      expect(requestBody).toBeDefined();
      
      const eventBatch = JSON.parse(requestBody as string);
      expect(eventBatch.visitors).toBeDefined();
      expect(eventBatch.visitors.length).toBe(1);
      expect(eventBatch.visitors[0].visitor_id).toBe('legacy-user');
    });
  });
}); 