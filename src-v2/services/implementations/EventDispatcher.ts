import { IEventDispatcher, OptimizelyEvent } from "../interfaces/IEventDispatcher";
import { IEventService, OptimizelyEventData, EventConfig } from "../interfaces/IEventService";
import { ILoggerAdapter } from "../../adapters/interfaces/ILoggerAdapter";
import { IEnvironmentAdapter } from "../../adapters/interfaces/IEnvironmentAdapter";

/**
 * Service responsible for dispatching Optimizely tracking events.
 * Implements both IEventDispatcher (legacy) and IEventService (new) interfaces.
 */
export class EventDispatcher implements IEventDispatcher, IEventService {
  private logger: ILoggerAdapter;
  private envAdapter: IEnvironmentAdapter;
  private defaultConfig: EventConfig = {
    disableTracking: false,
    batchSize: 10,
    flushInterval: 30000 // 30 seconds
  };

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
  }

  /**
   * [Legacy] Accepts an event for dispatch.
   * NOTE: This basic version does not contain actual event sending/batching logic.
   * It simply logs the event using envAdapter.waitUntil.
   * @param event - The event object to dispatch.
   * @returns A promise resolving immediately.
   */
  async dispatchEvent(event: OptimizelyEvent): Promise<void> {
    this.logger.debug(`EventDispatcher.dispatchEvent called. Basic implementation - logging event asynchronously.`, event);

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
    
    this.logger.debug(`EventDispatcher: Tracking event (basic implementation)`, { eventType: event.type });

    // Use waitUntil to log the event without blocking the response
    this.envAdapter.waitUntil(
      (async () => {
        // Simulate async operation like sending to an endpoint
        await new Promise(resolve => setTimeout(resolve, 1)); // Minimal delay
        this.logger.info(`[Async] Event processed (basic log): ${event.type} - ${event.uuid}`);
        // In a real implementation, this would involve batching and fetch/POST
      })()
    );
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
    
    this.logger.debug(`EventDispatcher: Tracking ${events.length} events (basic implementation)`);

    // Process each event
    await Promise.all(events.map(event => this.trackEvent(event, config)));
  }

  /**
   * Immediately dispatches all queued events to Optimizely.
   * @param config - Optional configuration for this dispatch operation.
   * @returns A promise that resolves when all events are dispatched.
   */
  async flushEvents(config?: EventConfig): Promise<void> {
    this.logger.debug("EventDispatcher: Flush events called (basic implementation - no-op)");
    // Basic implementation - no-op
    return Promise.resolve();
  }
} 