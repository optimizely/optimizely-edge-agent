import { OptimizelyUserContext } from "./IDecisionService";

/**
 * Represents an Optimizely event to be tracked.
 */
export interface OptimizelyEventData {
  /**
   * The type of event (e.g., 'impression', 'conversion', 'custom').
   */
  type: string;
  
  /**
   * The flag or experiment key (for impression events).
   */
  flagKey?: string;
  
  /**
   * The variation key (for impression events).
   */
  variationKey?: string;
  
  /**
   * The event key (for conversion events).
   */
  eventKey?: string;
  
  /**
   * The user context associated with the event.
   */
  userContext: OptimizelyUserContext;
  
  /**
   * Timestamp when the event occurred (milliseconds since epoch).
   */
  timestamp: number;
  
  /**
   * Unique identifier for the event.
   */
  uuid: string;
  
  /**
   * Event tags (for conversion events).
   */
  tags?: Record<string, string | number | boolean>;
  
  /**
   * Revenue amount (for revenue events).
   */
  revenue?: number;
  
  /**
   * Event value (for value events).
   */
  value?: number;
}

/**
 * Configuration for event tracking.
 */
export interface EventConfig {
  /**
   * Whether to disable event tracking entirely.
   */
  disableTracking?: boolean;
  
  /**
   * The SDK key associated with the event.
   */
  sdkKey?: string;
  
  /**
   * Batch size for event dispatching (defaults to 10).
   */
  batchSize?: number;
  
  /**
   * Flush interval in milliseconds (defaults to 30000 - 30 seconds).
   */
  flushInterval?: number;
}

/**
 * @interface IEventService
 * @description Defines the contract for tracking and dispatching Optimizely events.
 */
export interface IEventService {
  /**
   * Tracks a single event.
   * @param event - The event data to track.
   * @param config - Optional configuration for this specific event.
   * @returns A promise that resolves when the event is tracked (not necessarily dispatched).
   */
  trackEvent(event: OptimizelyEventData, config?: EventConfig): Promise<void>;
  
  /**
   * Tracks multiple events in a batch.
   * @param events - Array of events to track.
   * @param config - Optional configuration for this batch of events.
   * @returns A promise that resolves when all events are tracked.
   */
  trackEvents(events: OptimizelyEventData[], config?: EventConfig): Promise<void>;
  
  /**
   * Immediately dispatches all queued events to Optimizely.
   * @param config - Optional configuration for this dispatch operation.
   * @returns A promise that resolves when all events are dispatched.
   */
  flushEvents(config?: EventConfig): Promise<void>;
  
  /**
   * Sets the global default configuration for event tracking.
   * @param config - The configuration to set as default.
   */
  setDefaultConfig(config: EventConfig): void;
} 