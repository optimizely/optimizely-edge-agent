import { IEventService, OptimizelyEventData, EventConfig } from "../interfaces/IEventService";
import { ILoggerAdapter } from "../../adapters/interfaces/ILoggerAdapter";
import { IEnvironmentAdapter } from "../../adapters/interfaces/IEnvironmentAdapter";
import { IStorageAdapter } from "../../adapters/interfaces/IStorageAdapter";
import { CloudflareExecutionContext } from "../../adapters/implementations/cloudflare/CloudflareEnvironmentAdapter";

// Update IEnvironmentAdapter interface definition if needed
declare module "../../adapters/interfaces/IEnvironmentAdapter" {
  interface IEnvironmentAdapter {
    getEnvironment(): { ctx?: unknown; [key: string]: unknown };
  }
}

// Define explicit types for Optimizely event API
interface OptimizelySnapshot {
  decisions?: Array<{
    campaign_id: string;
    experiment_id: string;
    variation_id: string;
    metadata: {
      flag_key?: string;
      rule_key: string;
      rule_type: string;
      variation_key?: string;
    };
  }>;
  events: Array<{
    entity_id: string;
    timestamp: number;
    key: string;
    uuid: string;
    tags?: Record<string, string | number | boolean>;
    revenue?: number;
    value?: number;
  }>;
}

interface OptimizelyVisitor {
  visitor_id: string;
  snapshots: OptimizelySnapshot[];
  attributes?: Array<{
    entity_id: string;
    key: string;
    type: string;
    value: string | number | boolean;
  }>;
}

interface OptimizelyEventsPayload {
  client_name: string;
  client_version: string;
  account_id: string;
  revision: string;
  anonymize_ip: boolean;
  enrich_decisions: boolean;
  visitors: OptimizelyVisitor[];
}

/**
 * Cloudflare-specific implementation of the EventService.
 * Uses Cloudflare Workers' waitUntil to track events asynchronously.
 */
export class CloudflareEventService implements IEventService {
  private readonly EVENTS_QUEUE_KEY_PREFIX = "events_queue:";
  private readonly EVENTS_LAST_FLUSH_KEY_PREFIX = "events_last_flush:";
  private readonly OPTIMIZELY_EVENTS_ENDPOINT = "https://logx.optimizely.com/v1/events";
  private eventQueue: OptimizelyEventData[] = [];
  private defaultConfig: EventConfig = {
    disableTracking: false,
    batchSize: 10,
    flushInterval: 30000 // 30 seconds
  };

  /**
   * Creates a new instance of CloudflareEventService.
   * @param storageAdapter - The storage adapter for persisting event queues.
   * @param environmentAdapter - The environment adapter for accessing execution context.
   * @param logger - The logger adapter.
   */
  constructor(
    private storageAdapter: IStorageAdapter,
    private environmentAdapter: IEnvironmentAdapter,
    private logger: ILoggerAdapter
  ) {
    if (!storageAdapter || !environmentAdapter || !logger) {
      throw new Error("CloudflareEventService requires storageAdapter, environmentAdapter, and logger.");
    }
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
    this.logger.debug("CloudflareEventService: Default config updated", this.defaultConfig);
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
      this.logger.debug("CloudflareEventService: Event tracking disabled, event skipped", { eventType: event.type });
      return;
    }
    
    // Add the event to the queue
    this.eventQueue.push(event);
    this.logger.debug(`CloudflareEventService: Event added to queue (${this.eventQueue.length})`, { eventType: event.type });
    
    // Check if we should flush the queue based on batch size
    const batchSize = mergedConfig.batchSize || this.defaultConfig.batchSize || 10;
    if (this.eventQueue.length >= batchSize) {
      this.logger.debug(`CloudflareEventService: Batch size reached (${this.eventQueue.length}), flushing events`);
      await this.flushEvents(mergedConfig);
    } else {
      // Schedule async flush if enough time has passed since last flush
      this.scheduleAsyncFlush(mergedConfig);
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
      this.logger.debug(`CloudflareEventService: Event tracking disabled, ${events.length} events skipped`);
      return;
    }
    
    // Add all events to the queue
    this.eventQueue.push(...events);
    this.logger.debug(`CloudflareEventService: ${events.length} events added to queue (total: ${this.eventQueue.length})`);
    
    // Check if we should flush the queue based on batch size
    const batchSize = mergedConfig.batchSize || this.defaultConfig.batchSize || 10;
    if (this.eventQueue.length >= batchSize) {
      this.logger.debug(`CloudflareEventService: Batch size reached (${this.eventQueue.length}), flushing events`);
      await this.flushEvents(mergedConfig);
    } else {
      // Schedule async flush if enough time has passed since last flush
      this.scheduleAsyncFlush(mergedConfig);
    }
  }

  /**
   * Immediately dispatches all queued events to Optimizely.
   * @param config - Optional configuration for this dispatch operation.
   * @returns A promise that resolves when all events are dispatched.
   */
  async flushEvents(config?: EventConfig): Promise<void> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    
    // If tracking is disabled, do nothing
    if (mergedConfig.disableTracking) {
      this.logger.debug("CloudflareEventService: Event tracking disabled, flush skipped");
      return;
    }
    
    // If no events to flush, do nothing
    if (this.eventQueue.length === 0) {
      this.logger.debug("CloudflareEventService: No events to flush");
      return;
    }
    
    // Get events to flush (copy and clear the queue)
    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];
    
    this.logger.debug(`CloudflareEventService: Flushing ${eventsToFlush.length} events`);
    
    try {
      // Format the events for the Optimizely Events API
      const formattedEvents = this.formatEventsForOptimizely(eventsToFlush, mergedConfig.sdkKey);
      
      // Send the events to Optimizely
      await this.sendEventsToOptimizely(formattedEvents);
      
      // Update last flush time
      if (mergedConfig.sdkKey) {
        const lastFlushKey = this.getLastFlushKey(mergedConfig.sdkKey);
        await this.storageAdapter.put(lastFlushKey, Date.now().toString());
      }
      
      this.logger.debug(`CloudflareEventService: Successfully flushed ${eventsToFlush.length} events`);
    } catch (error) {
      this.logger.error("CloudflareEventService: Failed to flush events", error);
      
      // Put the events back in the queue if we failed to send them
      this.eventQueue = [...eventsToFlush, ...this.eventQueue];
      
      // Persist the queue for retry later if we have storage
      try {
        if (mergedConfig.sdkKey) {
          const queueKey = this.getQueueKey(mergedConfig.sdkKey);
          await this.storageAdapter.put(queueKey, JSON.stringify(this.eventQueue));
        }
      } catch (storageError) {
        this.logger.error("CloudflareEventService: Failed to persist event queue", storageError);
      }
      
      throw error;
    }
  }

  /**
   * Schedules an asynchronous flush of events using Cloudflare waitUntil.
   * @param config - The event configuration.
   * @private
   */
  private scheduleAsyncFlush(config: EventConfig): void {
    // Get the Cloudflare execution context to use waitUntil
    const ctx = this.getCloudflareContext();
    if (!ctx) {
      this.logger.warn("CloudflareEventService: No execution context for waitUntil, skipping async flush");
      return;
    }
    
    // Only schedule a flush if we have a valid sdkKey
    if (!config.sdkKey) {
      this.logger.debug("CloudflareEventService: No sdkKey provided for async flush");
      return;
    }
    
    // Check if enough time has passed since the last flush
    this.getLastFlushTime(config.sdkKey)
      .then(lastFlushTime => {
        const now = Date.now();
        const flushInterval = config.flushInterval || this.defaultConfig.flushInterval || 30000;
        
        if (!lastFlushTime || (now - lastFlushTime) >= flushInterval) {
          // Use waitUntil to schedule the async flush
          ctx.waitUntil(this.flushEvents(config).catch(error => {
            this.logger.error("CloudflareEventService: Async flush failed", error);
          }));
          
          this.logger.debug(`CloudflareEventService: Scheduled async flush for ${this.eventQueue.length} events`);
        }
      })
      .catch(error => {
        this.logger.error("CloudflareEventService: Failed to get last flush time", error);
      });
  }

  /**
   * Gets the last time events were flushed for a specific SDK key.
   * @param sdkKey - The SDK key.
   * @returns A promise resolving to the last flush time or undefined if never flushed.
   * @private
   */
  private async getLastFlushTime(sdkKey: string): Promise<number | undefined> {
    try {
      const lastFlushKey = this.getLastFlushKey(sdkKey);
      const lastFlushTimeStr = await this.storageAdapter.get(lastFlushKey, 'text');
      
      if (!lastFlushTimeStr) {
        return undefined;
      }
      
      return parseInt(lastFlushTimeStr, 10);
    } catch (error) {
      this.logger.error(`CloudflareEventService: Failed to get last flush time for SDK key: ${sdkKey}`, error);
      return undefined;
    }
  }

  /**
   * Gets the Cloudflare execution context from the environment adapter.
   * @returns The Cloudflare execution context or undefined if not available.
   * @private
   */
  private getCloudflareContext(): CloudflareExecutionContext | undefined {
    // Try to get the execution context from the environment adapter
    try {
      const env = this.environmentAdapter.getEnvironment();
      return (env.ctx as CloudflareExecutionContext) || undefined;
    } catch (error) {
      this.logger.error("CloudflareEventService: Failed to get execution context", error);
      return undefined;
    }
  }

  /**
   * Formats events for the Optimizely Events API.
   * @param events - The events to format.
   * @param sdkKey - The SDK key associated with the events.
   * @returns The formatted events payload.
   * @private
   */
  private formatEventsForOptimizely(events: OptimizelyEventData[], sdkKey?: string): OptimizelyEventsPayload {
    // Basic implementation - in a real implementation, this would format the events
    // according to the Optimizely Events API specification
    return {
      client_name: "optimizely-edge-agent",
      client_version: "2.0.0",
      account_id: sdkKey ? sdkKey.split('_')[0] : "unknown",
      revision: "1",
      anonymize_ip: true,
      enrich_decisions: true,
      visitors: events.map(event => this.formatEventForOptimizely(event))
    };
  }

  /**
   * Formats a single event for the Optimizely Events API.
   * @param event - The event to format.
   * @returns The formatted event.
   * @private
   */
  private formatEventForOptimizely(event: OptimizelyEventData): OptimizelyVisitor {
    // Convert internal event format to Optimizely Events API format
    const visitor: OptimizelyVisitor = {
      visitor_id: this.getUsedId(event.userContext),
      snapshots: []
    };
    
    // Add the snapshot based on event type
    if (event.type === "impression") {
      const snapshot: OptimizelySnapshot = {
        decisions: [{
          campaign_id: "unknown", // Would be determined from the datafile
          experiment_id: "unknown", // Would be determined from the datafile
          variation_id: "unknown", // Would be determined from the datafile
          metadata: {
            flag_key: event.flagKey,
            rule_key: "unknown", // Would be determined from the datafile
            rule_type: "unknown", // Would be determined from the datafile
            variation_key: event.variationKey
          }
        }],
        events: [{
          entity_id: "unknown", // Would be determined from the datafile
          timestamp: event.timestamp,
          key: "campaign_activated",
          uuid: event.uuid
        }]
      };
      visitor.snapshots.push(snapshot);
    } else if (event.type === "conversion") {
      const snapshot: OptimizelySnapshot = {
        events: [{
          entity_id: "unknown", // Would be determined from the datafile
          timestamp: event.timestamp,
          key: event.eventKey || "unknown",
          uuid: event.uuid,
          tags: event.tags || {},
          revenue: event.revenue,
          value: event.value
        }]
      };
      visitor.snapshots.push(snapshot);
    }
    
    return visitor;
  }

  /**
   * Sends events to the Optimizely Events API.
   * @param formattedEvents - The formatted events payload.
   * @returns A promise that resolves when the events are sent.
   * @private
   */
  private async sendEventsToOptimizely(formattedEvents: OptimizelyEventsPayload): Promise<void> {
    this.logger.debug("CloudflareEventService: Sending events to Optimizely", { 
      endpoint: this.OPTIMIZELY_EVENTS_ENDPOINT,
      visitorCount: formattedEvents.visitors.length
    });
    
    const response = await fetch(this.OPTIMIZELY_EVENTS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(formattedEvents)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send events to Optimizely. Status: ${response.status}, Response: ${errorText}`);
    }
    
    this.logger.debug("CloudflareEventService: Events sent successfully", { status: response.status });
  }

  /**
   * Gets the storage key for the event queue.
   * @param sdkKey - The SDK key.
   * @returns The storage key.
   * @private
   */
  private getQueueKey(sdkKey: string): string {
    return `${this.EVENTS_QUEUE_KEY_PREFIX}${sdkKey}`;
  }

  /**
   * Gets the storage key for the last flush time.
   * @param sdkKey - The SDK key.
   * @returns The storage key.
   * @private
   */
  private getLastFlushKey(sdkKey: string): string {
    return `${this.EVENTS_LAST_FLUSH_KEY_PREFIX}${sdkKey}`;
  }

  /**
   * Safely extracts the user ID from the user context.
   * Handles different ways it might be stored.
   * @param userContext - The user context object.
   * @returns The user ID as a string.
   * @private
   */
  private getUsedId(userContext: any): string {
    // First try proper method access if available
    if (userContext && typeof userContext.getUserId === 'function') {
      return userContext.getUserId();
    }
    
    // Then try direct property access
    if (userContext && typeof userContext.userId === 'string') {
      return userContext.userId;
    }
    
    // Try alternative property names
    if (userContext && typeof userContext.visitorId === 'string') {
      return userContext.visitorId;
    }
    
    // Last resort, return a placeholder
    return 'unknown-user';
  }
} 