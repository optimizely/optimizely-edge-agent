import { logger } from '../../../utils/helpers/optimizelyHelper';

type EventListener = (...args: unknown[]) => Promise<Record<string, unknown> | void> | Record<string, unknown> | void;

type EventType =
  | 'beforeResponse'
  | 'afterResponse'
  | 'beforeCreateCacheKey'
  | 'afterCreateCacheKey'
  | 'beforeCacheResponse'
  | 'afterCacheResponse'
  | 'beforeRequest'
  | 'afterRequest'
  | 'beforeDecide'
  | 'afterDecide'
  | 'beforeDetermineFlagsToDecide'
  | 'afterDetermineFlagsToDecide'
  | 'beforeReadingCookie'
  | 'afterReadingCookie'
  | 'beforeReadingCache'
  | 'afterReadingCache'
  | 'beforeProcessingRequest'
  | 'afterProcessingRequest'
  | 'beforeReadingRequestConfig'
  | 'afterReadingRequestConfig'
  | 'beforeDispatchingEvents'
  | 'afterDispatchingEvents';

type EventListenersMap = {
  [K in EventType]: EventListener[];
};

/**
 * Class representing the EventListeners.
 * Provides a unified interface for managing event listeners and triggering events.
 */
export class EventListeners {
  private static instance: EventListeners;
  private readonly listeners: EventListenersMap;
  private readonly registeredEvents: Set<EventType>;

  /**
   * Creates an instance of EventListeners.
   * Uses the Singleton pattern to ensure only one instance exists.
   */
  private constructor() {
    logger().debug('Inside EventListeners constructor');

    this.listeners = {
      beforeResponse: [],
      afterResponse: [],
      beforeCreateCacheKey: [],
      afterCreateCacheKey: [],
      beforeCacheResponse: [],
      afterCacheResponse: [],
      beforeRequest: [],
      afterRequest: [],
      beforeDecide: [],
      afterDecide: [],
      beforeDetermineFlagsToDecide: [],
      afterDetermineFlagsToDecide: [],
      beforeReadingCookie: [],
      afterReadingCookie: [],
      beforeReadingCache: [],
      afterReadingCache: [],
      beforeProcessingRequest: [],
      afterProcessingRequest: [],
      beforeReadingRequestConfig: [],
      afterReadingRequestConfig: [],
      beforeDispatchingEvents: [],
      afterDispatchingEvents: []
    };

    this.registeredEvents = new Set();
  }

  /**
   * Gets the singleton instance of EventListeners.
   */
  static getInstance(): EventListeners {
    if (!EventListeners.instance) {
      EventListeners.instance = new EventListeners();
    }
    return EventListeners.instance;
  }

  /**
   * Registers a listener for a given event.
   */
  on(event: EventType, listener: EventListener): void {
    if (this.listeners[event]) {
      this.listeners[event].push(listener);
      this.registeredEvents.add(event);
    } else {
      logger().error(`Event ${event} not supported`);
    }
  }

  /**
   * Triggers an event with optional arguments.
   */
  async trigger(event: EventType, ...args: unknown[]): Promise<Record<string, unknown>> {
    const combinedResults: Record<string, unknown> = {};

    if (this.registeredEvents.has(event)) {
      for (const listener of this.listeners[event]) {
        try {
          const result = await listener(...args);
          if (result !== undefined) {
            Object.assign(combinedResults, result);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger().error(`Error in listener for event ${event}: ${message}`);
        }
      }
    } else {
      logger().error(`Event ${event} not registered`);
    }

    return combinedResults;
  }

  /**
   * Gets all registered event types.
   */
  getRegisteredEvents(): EventType[] {
    return Array.from(this.registeredEvents);
  }

  /**
   * Gets all listeners for a specific event.
   */
  getListeners(event: EventType): EventListener[] {
    return this.listeners[event] || [];
  }

  /**
   * Removes a specific listener from an event.
   */
  off(event: EventType, listener: EventListener): void {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(listener);
      if (index !== -1) {
        this.listeners[event].splice(index, 1);
        if (this.listeners[event].length === 0) {
          this.registeredEvents.delete(event);
        }
      }
    }
  }

  /**
   * Removes all listeners for a specific event.
   */
  removeAllListeners(event: EventType): void {
    if (this.listeners[event]) {
      this.listeners[event] = [];
      this.registeredEvents.delete(event);
    }
  }
}
