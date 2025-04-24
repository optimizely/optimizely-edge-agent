/**
 * EventDispatcher Implementation
 * 
 * This enhanced EventDispatcher provides robust event batching and dispatching to the 
 * Optimizely Events API, designed specifically for edge worker environments.
 * 
 * Key improvements:
 * - Environment Detection: Automatically detects Cloudflare, Vercel, or Fastly environments
 * - Event Batching: Efficiently groups events by user to reduce API calls
 * - Non-blocking Operation: Uses waitUntil pattern to handle event dispatching asynchronously
 * - Exponential Backoff: Implements retry with increasing delays without blocking responses
 * - Error Resilience: Preserves events during API failures and retries automatically
 * 
 * In edge worker environments, this implementation:
 * 1. Processes the main request without delays from event dispatching
 * 2. Extends execution for event batching and delivery via waitUntil()
 * 3. Retries failed requests in a non-blocking way within the extended execution context
 * 4. Formats events according to Optimizely Events API requirements
 * 
 * TODO: document the event batching and retry logic for edge worker environments (Suggested doc link below)
 * @see https://docs.developers.optimizely.com/reference/workers-event-api for API reference
 */

import { IEventDispatcher, OptimizelyEvent } from "../interfaces/IEventDispatcher";
import { IEventService, OptimizelyEventData, EventConfig } from "../interfaces/IEventService";
import { ILoggerAdapter } from "../../adapters/interfaces/ILoggerAdapter";
import { IEnvironmentAdapter } from "../../adapters/interfaces/IEnvironmentAdapter";

/**
 * The Optimizely Events API endpoint.
 */
const OPTIMIZELY_EVENTS_API = 'https://logx.optimizely.com/v1/events';

/**
 * Maximum number of retry attempts for failed event dispatches
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Base delay for exponential backoff (in milliseconds)
 */
const BASE_RETRY_DELAY = 1000;

/**
 * Interface for an event batch that will be sent to the Optimizely Events API.
 * Based on the Optimizely Events API format.
 */
interface OptimizelyEventBatch {
  /**
   * Client name (identifies the SDK)
   */
  client_name: string;
  
  /**
   * Client version
   */
  client_version: string;
  
  /**
   * Account ID - can be extracted from the SDK key
   */
  account_id?: string;
  
  /**
   * Project ID - can be extracted from the datafile
   */
  project_id?: string;
  
  /**
   * Revision of the datafile used
   */
  revision?: string;
  
  /**
   * Array of event objects to send
   */
  visitors: VisitorData[];
  
  /**
   * Whether this is an anonymous event batch
   */
  anonymize_ip: boolean;
  
  /**
   * Enriched data
   */
  enriched?: boolean;
}

/**
 * Interface for a visitor in the event batch.
 */
interface VisitorData {
  /**
   * Visitor ID (or user ID)
   */
  visitor_id: string;
  
  /**
   * Session ID
   */
  session_id?: string;
  
  /**
   * Visitor attributes
   */
  attributes?: AttributeData[];
  
  /**
   * Array of snapshots (events)
   */
  snapshots: SnapshotData[];
}

/**
 * Interface for a visitor attribute.
 */
interface AttributeData {
  /**
   * Entity ID for the attribute definition
   */
  entity_id: string;
  
  /**
   * Attribute key
   */
  key: string;
  
  /**
   * Attribute type
   */
  type: 'custom' | 'standard';
  
  /**
   * Attribute value
   */
  value: string | number | boolean;
}

/**
 * Interface for a snapshot.
 */
interface SnapshotData {
  /**
   * Array of event objects
   */
  events: EventData[];
  
  /**
   * Array of decisions
   */
  decisions?: DecisionData[];
}

/**
 * Interface for an event in a snapshot.
 */
interface EventData {
  /**
   * Entity ID for the event definition
   */
  entity_id: string;
  
  /**
   * Timestamp of the event (in milliseconds)
   */
  timestamp: number;
  
  /**
   * UUID for the event
   */
  uuid: string;
  
  /**
   * Event key
   */
  key: string;
  
  /**
   * Revenue amount
   */
  revenue?: number;
  
  /**
   * Event value
   */
  value?: number;
  
  /**
   * Event tags
   */
  tags?: Record<string, string | number | boolean>;
}

/**
 * Interface for a decision in a snapshot.
 */
interface DecisionData {
  /**
   * Campaign ID (experiment ID)
   */
  campaign_id: string;
  
  /**
   * Experiment ID
   */
  experiment_id: string;
  
  /**
   * Variation ID
   */
  variation_id: string;
  
  /**
   * Whether the decision is from a holdback
   */
  is_campaign_holdback?: boolean;
  
  /**
   * Metadata about the decision
   */
  metadata?: Record<string, unknown>;
}

/**
 * Interface for retry state tracking
 */
interface RetryState {
  /**
   * Number of attempts made so far
   */
  attempts: number;
  
  /**
   * Events to retry
   */
  events: OptimizelyEventData[];
  
  /**
   * Timer handle for the retry
   */
  timer: any;
}

/**
 * Known environment types
 */
enum EnvironmentType {
  CLOUDFLARE = 'cloudflare',
  VERCEL = 'vercel',
  FASTLY = 'fastly',
  UNKNOWN = 'unknown'
}

/**
 * Service responsible for dispatching Optimizely tracking events.
 * Implements both IEventDispatcher (legacy) and IEventService (new) interfaces.
 * Enhanced to support actual event batching and dispatching to the Optimizely Events API.
 * Supports multiple edge environments: Cloudflare, Vercel, and Fastly.
 */
export class EventDispatcher implements IEventDispatcher, IEventService {
  private logger: ILoggerAdapter;
  private envAdapter: IEnvironmentAdapter;
  private defaultConfig: EventConfig = {
    disableTracking: false,
    batchSize: 10,
    flushInterval: 30000 // 30 seconds
  };
  
  // Event queue for batching
  private eventQueue: OptimizelyEventData[] = [];
  
  // Timer for automatic flushing
  private flushTimer: any = null;
  
  // Environment type detection
  private environmentType: EnvironmentType = EnvironmentType.UNKNOWN;
  
  // Client info for events API - will be set based on detected environment
  private clientInfo = {
    clientName: 'javascript-sdk/edge-agent',
    clientVersion: '1.0.0'
  };
  
  // Retry state for failed dispatches
  private retryState: RetryState | null = null;

  /**
   * Creates an instance of the EventDispatcher.
   * @param logger - Logger adapter.
   * @param envAdapter - Environment adapter (for waitUntil).
   */
  constructor(logger: ILoggerAdapter, envAdapter: IEnvironmentAdapter) {
    if (!logger || !envAdapter) {
      throw new Error("EventDispatcher requires logger and envAdapter.");
    }
    this.logger = logger;
    this.envAdapter = envAdapter;
    
    // Detect environment type
    this.detectEnvironmentType();
    
    // Set client info based on environment
    this.setClientInfo();
    
    this.logger.debug(`EventDispatcher initialized for ${this.environmentType} environment`, {
      clientName: this.clientInfo.clientName,
      clientVersion: this.clientInfo.clientVersion
    });
  }

  /**
   * Detects the type of environment we're running in based on the environment adapter.
   */
  private detectEnvironmentType(): void {
    const adapterConstructorName = this.envAdapter.constructor.name;
    
    if (adapterConstructorName.includes('Cloudflare')) {
      this.environmentType = EnvironmentType.CLOUDFLARE;
    } else if (adapterConstructorName.includes('Vercel')) {
      this.environmentType = EnvironmentType.VERCEL;
    } else if (adapterConstructorName.includes('Fastly')) {
      this.environmentType = EnvironmentType.FASTLY;
    } else {
      this.environmentType = EnvironmentType.UNKNOWN;
      this.logger.warn('Unknown environment type detected, using generic client info');
    }
  }
  
  /**
   * Sets client info based on detected environment type.
   */
  private setClientInfo(): void {
    switch (this.environmentType) {
      case EnvironmentType.CLOUDFLARE:
        this.clientInfo = {
          clientName: 'javascript-sdk/cloudflare-agent',
          clientVersion: '1.0.0'
        };
        break;
      case EnvironmentType.VERCEL:
        this.clientInfo = {
          clientName: 'javascript-sdk/vercel-agent',
          clientVersion: '1.0.0'
        };
        break;
      case EnvironmentType.FASTLY:
        this.clientInfo = {
          clientName: 'javascript-sdk/fastly-agent',
          clientVersion: '1.0.0'
        };
        break;
      default:
        // Keep the default client info for unknown environments
        break;
    }
  }

  /**
   * [Legacy] Accepts an event for dispatch.
   * @param event - The event object to dispatch.
   * @returns A promise resolving immediately.
   */
  async dispatchEvent(event: OptimizelyEvent): Promise<void> {
    this.logger.debug(`EventDispatcher.dispatchEvent called.`, event);

    // Adapt to the new trackEvent method
    await this.trackEvent({
      type: event.type,
      timestamp: event.timestamp,
      uuid: event.uuid,
      userContext: event.userContext,
    });

    // Resolve immediately as the event is accepted for processing
    return Promise.resolve();
  }

  /**
   * Sets the global default configuration for event tracking.
   * @param config - The configuration to set as default.
   */
  setDefaultConfig(config: EventConfig): void {
    this.defaultConfig = {
      ...this.defaultConfig,
      ...config
    };
    this.logger.debug("EventDispatcher: Default config updated", this.defaultConfig);
    
    // Reset flush timer if interval changed
    if (config.flushInterval !== undefined && this.flushTimer) {
      this.setupFlushTimer();
    }
  }

  /**
   * Tracks a single event.
   * @param event - The event data to track.
   * @param config - Optional configuration for this specific event.
   * @returns A promise that resolves when the event is tracked (not necessarily dispatched).
   */
  async trackEvent(event: OptimizelyEventData, config?: EventConfig): Promise<void> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    // If tracking is disabled, do nothing
    if (mergedConfig.disableTracking) {
      this.logger.debug("EventDispatcher: Event tracking disabled, event skipped", { eventType: event.type });
      return;
    }
    
    this.logger.debug(`EventDispatcher: Tracking event`, { 
      eventType: event.type, 
      userId: this.getEventUserId(event),
      environment: this.environmentType
    });

    // Add the event to the queue
    this.eventQueue.push(event);
    
    // Setup flush timer if not already setup
    if (!this.flushTimer) {
      this.setupFlushTimer();
    }
    
    // Auto-flush if batch size reached
    if (this.eventQueue.length >= mergedConfig.batchSize!) {
      this.logger.debug(`EventDispatcher: Batch size (${mergedConfig.batchSize}) reached, auto-flushing`);
      this.safeWaitUntil(this.flushEvents(mergedConfig));
    }
  }

  /**
   * Tracks multiple events in a batch.
   * @param events - Array of events to track.
   * @param config - Optional configuration for this batch of events.
   * @returns A promise that resolves when all events are tracked.
   */
  async trackEvents(events: OptimizelyEventData[], config?: EventConfig): Promise<void> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    // If tracking is disabled, do nothing
    if (mergedConfig.disableTracking) {
      this.logger.debug(`EventDispatcher: Event tracking disabled, ${events.length} events skipped`);
      return;
    }
    
    this.logger.debug(`EventDispatcher: Tracking ${events.length} events in ${this.environmentType} environment`);

    // Add all events to the queue
    this.eventQueue.push(...events);
    
    // Setup flush timer if not already setup
    if (!this.flushTimer) {
      this.setupFlushTimer();
    }
    
    // Auto-flush if batch size reached
    if (this.eventQueue.length >= mergedConfig.batchSize!) {
      this.logger.debug(`EventDispatcher: Batch size (${mergedConfig.batchSize}) reached, auto-flushing`);
      this.safeWaitUntil(this.flushEvents(mergedConfig));
    }
  }

  /**
   * Immediately dispatches all queued events to Optimizely.
   * @param config - Optional configuration for this dispatch operation.
   * @returns A promise that resolves when all events are dispatched.
   */
  async flushEvents(config?: EventConfig): Promise<void> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    // If tracking is disabled, clear queue but don't send
    if (mergedConfig.disableTracking) {
      this.logger.debug(`EventDispatcher: Event tracking disabled, clearing ${this.eventQueue.length} events`);
      this.eventQueue = [];
      this.clearRetryState();
      return;
    }
    
    // Don't do anything if no events in queue
    if (this.eventQueue.length === 0) {
      this.logger.debug("EventDispatcher: No events to flush");
      return;
    }
    
    // Clear the flush timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Take events from the queue
    const events = [...this.eventQueue];
    this.eventQueue = [];
    
    this.logger.info(`EventDispatcher: Flushing ${events.length} events to Optimizely API`);
    
    // Convert events to Optimizely Events API format
    const batch = this.formatEventBatch(events, mergedConfig.sdkKey);
    
    try {
      // Send the events to the Optimizely Events API
      await this.sendEventBatch(batch);
      this.logger.debug("EventDispatcher: Successfully sent events to Optimizely");
      
      // Clear any retry state if we succeed
      this.clearRetryState();
    } catch (error) {
      this.logger.error("EventDispatcher: Failed to send events to Optimizely", error);
      
      // Handle retry with exponential backoff
      this.handleRetry(events, error);
      throw error;
    }
  }
  
  /**
   * Sets up the automatic flush timer.
   */
  private setupFlushTimer(): void {
    // Clear any existing timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    
    // Setup new timer
    this.flushTimer = setTimeout(() => {
      this.logger.debug(`EventDispatcher: Flush interval (${this.defaultConfig.flushInterval}ms) reached, auto-flushing`);
      this.safeWaitUntil(this.flushEvents());
      this.flushTimer = null;
    }, this.defaultConfig.flushInterval);
  }
  
  /**
   * Safely executes waitUntil based on the current environment.
   * Provides fallbacks for environments where waitUntil might behave differently.
   * 
   * @param promise - The promise to execute in waitUntil.
   */
  private safeWaitUntil(promise: Promise<unknown>): void {
    try {
      switch (this.environmentType) {
        case EnvironmentType.CLOUDFLARE:
          // Cloudflare has reliable waitUntil
          this.envAdapter.waitUntil(promise);
          break;
        
        case EnvironmentType.VERCEL:
          // Vercel's waitUntil requires extra care
          this.envAdapter.waitUntil(
            promise.catch(error => {
              this.logger.error(`EventDispatcher: Vercel waitUntil error`, error);
            })
          );
          break;
        
        case EnvironmentType.FASTLY:
          // Fastly might not have native waitUntil, adapter should handle fallback
          this.envAdapter.waitUntil(
            promise.catch(error => {
              this.logger.error(`EventDispatcher: Fastly waitUntil error`, error);
            })
          );
          break;
        
        default:
          // Unknown environment - use waitUntil but with extra error handling
          this.envAdapter.waitUntil(
            promise.catch(error => {
              this.logger.error(`EventDispatcher: Unknown environment waitUntil error`, error);
            })
          );
          break;
      }
    } catch (error) {
      // If waitUntil itself throws (shouldn't happen with proper adapters)
      this.logger.error(`EventDispatcher: Error in waitUntil for ${this.environmentType} environment`, error);
      
      // Execute the promise anyway to ensure events are processed
      promise.catch(promiseError => {
        this.logger.error('EventDispatcher: Background task error', promiseError);
      });
    }
  }
  
  /**
   * Handles retry logic for failed event dispatches with exponential backoff.
   * Adapts retry behavior based on the environment type.
   * 
   * @param events - The events that failed to send.
   * @param error - The error that occurred.
   */
  private handleRetry(events: OptimizelyEventData[], error: any): void {
    // Initialize retry state if first attempt
    if (!this.retryState) {
      this.retryState = {
        attempts: 0,
        events: [],
        timer: null
      };
    }
    
    // Add these events to retry queue
    this.retryState.events.push(...events);
    
    // If exceeded max retries, give up and log
    if (this.retryState.attempts >= MAX_RETRY_ATTEMPTS) {
      this.logger.error(`EventDispatcher: Exceeded maximum retry attempts (${MAX_RETRY_ATTEMPTS}), dropping ${this.retryState.events.length} events`, error);
      this.clearRetryState();
      return;
    }
    
    // Increment attempt count
    this.retryState.attempts++;
    
    // Calculate backoff time with jitter
    const backoffDelay = this.calculateBackoffDelay(this.retryState.attempts);
    this.logger.debug(`EventDispatcher: Scheduling retry attempt ${this.retryState.attempts} in ${backoffDelay}ms for ${this.environmentType} environment`);
    
    // Schedule retry - adjust timeout for different environments if needed
    this.retryState.timer = setTimeout(() => {
      const retryEvents = [...this.retryState!.events];
      this.retryState!.events = [];
      
      this.logger.debug(`EventDispatcher: Executing retry attempt ${this.retryState!.attempts} for ${retryEvents.length} events in ${this.environmentType} environment`);
      this.safeWaitUntil(this.retryFlush(retryEvents));
    }, backoffDelay);
  }
  
  /**
   * Executes a retry flush attempt.
   * Enhanced to handle environment-specific considerations.
   * 
   * @param events - The events to retry sending.
   */
  private async retryFlush(events: OptimizelyEventData[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    
    try {
      // Convert events to Optimizely Events API format
      const batch = this.formatEventBatch(events, this.defaultConfig.sdkKey);
      
      // Send the events to the Optimizely Events API
      await this.sendEventBatch(batch);
      this.logger.info(`EventDispatcher: Retry successful in ${this.environmentType} environment, sent ${events.length} events`);
      
      // Check if we have more events in retry queue
      if (this.retryState && this.retryState.events.length > 0) {
        const remainingEvents = [...this.retryState.events];
        this.retryState.events = [];
        await this.retryFlush(remainingEvents);
      } else {
        // Clear retry state if we're done
        this.clearRetryState();
      }
    } catch (error) {
      this.logger.error(`EventDispatcher: Retry attempt ${this.retryState?.attempts} failed in ${this.environmentType} environment`, error);
      
      // Put events back in retry queue
      if (this.retryState) {
        this.retryState.events.push(...events);
        
        // Schedule another retry if we haven't exceeded max attempts
        if (this.retryState.attempts < MAX_RETRY_ATTEMPTS) {
          const backoffDelay = this.calculateBackoffDelay(this.retryState.attempts);
          this.logger.debug(`EventDispatcher: Scheduling retry attempt ${this.retryState.attempts + 1} in ${backoffDelay}ms for ${this.environmentType} environment`);
          
          this.retryState.timer = setTimeout(() => {
            this.retryState!.attempts++;
            const retryEvents = [...this.retryState!.events];
            this.retryState!.events = [];
            this.safeWaitUntil(this.retryFlush(retryEvents));
          }, backoffDelay);
        } else {
          // Give up after max retries
          this.logger.error(`EventDispatcher: Exceeded maximum retry attempts (${MAX_RETRY_ATTEMPTS}) in ${this.environmentType} environment, dropping ${this.retryState.events.length} events`);
          this.clearRetryState();
        }
      }
    }
  }
  
  /**
   * Calculate exponential backoff delay with jitter.
   * 
   * @param attempt - The current retry attempt number.
   * @returns The delay in milliseconds before the next retry.
   */
  private calculateBackoffDelay(attempt: number): number {
    // Base exponential backoff formula: BASE_DELAY * 2^attempt
    const exponentialDelay = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
    
    // Add jitter to prevent thundering herd problem (±25% randomization)
    const jitter = exponentialDelay * 0.5 * Math.random() - exponentialDelay * 0.25;
    
    return Math.max(1000, Math.min(30000, exponentialDelay + jitter));
  }
  
  /**
   * Clears the retry state.
   */
  private clearRetryState(): void {
    if (this.retryState && this.retryState.timer) {
      clearTimeout(this.retryState.timer);
    }
    this.retryState = null;
  }
  
  /**
   * Formats event data for the Optimizely Events API.
   * @param events - Array of events to format.
   * @param sdkKey - Optional SDK key for the events.
   * @returns A properly formatted event batch for the Optimizely Events API.
   */
  private formatEventBatch(events: OptimizelyEventData[], sdkKey?: string): OptimizelyEventBatch {
    // Group events by visitor ID
    const visitorMap: Record<string, OptimizelyEventData[]> = {};
    
    for (const event of events) {
      const visitorId = this.getEventUserId(event);
      if (!visitorMap[visitorId]) {
        visitorMap[visitorId] = [];
      }
      visitorMap[visitorId].push(event);
    }
    
    // Format the batch
    const batch: OptimizelyEventBatch = {
      client_name: this.clientInfo.clientName,
      client_version: this.clientInfo.clientVersion,
      anonymize_ip: true,
      visitors: []
    };
    
    // Add account/project ID if available from SDK key
    if (sdkKey) {
      // Example SDK key format: "SDK:account:project"
      const parts = sdkKey.split(':');
      if (parts.length >= 3) {
        batch.account_id = parts[1];
        batch.project_id = parts[2];
      }
    }
    
    // Process each visitor's events
    for (const [visitorId, visitorEvents] of Object.entries(visitorMap)) {
      const visitor: VisitorData = {
        visitor_id: visitorId,
        snapshots: [],
      };
      
      // Add visitor attributes if available
      if (visitorEvents[0]?.userContext.attributes) {
        visitor.attributes = this.formatAttributes(visitorEvents[0].userContext.attributes);
      }
      
      // Group events into snapshots
      const snapshot: SnapshotData = {
        events: [],
        decisions: []
      };
      
      // Add events to the snapshot
      for (const event of visitorEvents) {
        const eventData: EventData = {
          entity_id: event.eventKey || event.flagKey || 'unknown',
          timestamp: event.timestamp,
          uuid: event.uuid,
          key: event.eventKey || event.type,
        };
        
        // Add revenue and value if available
        if (event.revenue !== undefined) {
          eventData.revenue = event.revenue;
        }
        if (event.value !== undefined) {
          eventData.value = event.value;
        }
        
        // Add tags if available
        if (event.tags) {
          eventData.tags = event.tags;
        }
        
        snapshot.events.push(eventData);
        
        // Add impression decisions if this is an impression event
        if (event.type === 'impression' && event.flagKey && event.variationKey) {
          const decision: DecisionData = {
            campaign_id: event.flagKey,
            experiment_id: event.flagKey,
            variation_id: event.variationKey,
          };
          
          if (!snapshot.decisions) {
            snapshot.decisions = [];
          }
          
          snapshot.decisions.push(decision);
        }
      }
      
      visitor.snapshots.push(snapshot);
      batch.visitors.push(visitor);
    }
    
    return batch;
  }
  
  /**
   * Formats user attributes for the Optimizely Events API.
   * @param attributes - The user attributes.
   * @returns An array of formatted attributes.
   */
  private formatAttributes(attributes: Record<string, any>): AttributeData[] {
    const result: AttributeData[] = [];
    
    for (const [key, value] of Object.entries(attributes)) {
      // Skip special keys like forcedDecisions
      if (key === 'forcedDecisions') {
        continue;
      }
      
      // Skip non-serializable values
      if (
        typeof value !== 'string' && 
        typeof value !== 'number' && 
        typeof value !== 'boolean'
      ) {
        this.logger.debug(`EventDispatcher: Skipping non-serializable attribute: ${key}`);
        continue;
      }
      
      result.push({
        entity_id: key,
        key: key,
        type: 'custom',
        value: value
      });
    }
    
    return result;
  }
  
  /**
   * Sends an event batch to the Optimizely Events API.
   * Enhanced with environment-specific error handling.
   * @param batch - The formatted event batch.
   * @returns A promise that resolves when the batch is sent.
   */
  private async sendEventBatch(batch: OptimizelyEventBatch): Promise<void> {
    this.logger.debug(`EventDispatcher: Sending event batch to Optimizely Events API from ${this.environmentType} environment`, { 
      url: OPTIMIZELY_EVENTS_API,
      visitorCount: batch.visitors.length,
      eventCount: batch.visitors.reduce((sum, visitor) => 
        sum + visitor.snapshots.reduce((sum, snapshot) => 
          sum + snapshot.events.length, 0), 0)
    });
    
    try {
      // Use the environment adapter's fetch to make the request
      const response = await this.envAdapter.fetch(OPTIMIZELY_EVENTS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(batch)
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to send events from ${this.environmentType} environment: ${response.status} ${response.statusText} - ${text}`);
      }
      
      this.logger.debug(`EventDispatcher: Successfully sent event batch from ${this.environmentType} environment`, { 
        statusCode: response.status
      });
    } catch (error) {
      this.logger.error(`EventDispatcher: Error sending event batch from ${this.environmentType} environment`, error);
      throw error;
    }
  }

  /**
   * Safely extracts user ID from an event's user context.
   * @param event - The event containing user context.
   * @returns The user ID string.
   */
  private getEventUserId(event: OptimizelyEventData): string {
    const ctx = event.userContext;
    
    // Properly handle different ways the user ID might be stored
    
    // Try to access userContext as any to check for expected properties
    const anyCtx = ctx as any;
    
    // If the context implements getUserId() method (type-safe approach)
    if (anyCtx && typeof anyCtx.getUserId === 'function') {
      return anyCtx.getUserId();
    }
    
    // Direct property access to known runtime properties
    if (anyCtx?.userId) {
      return anyCtx.userId;
    }
    if (anyCtx?.visitorId) {
      return anyCtx.visitorId;
    }
    
    // Fallback
    return 'unknown';
  }
} 