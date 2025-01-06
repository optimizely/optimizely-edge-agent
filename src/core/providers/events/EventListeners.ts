
import { Logger } from '../../../utils/logging/Logger';
import { EventType, EventListener, EventListenerParameters } from '../../../types/events';

type TypedEventListener<K extends EventType> = EventListener<EventListenerParameters[K]>;

type EventListenersMap = {
  [K in EventType]: TypedEventListener<K>[];
};

// Get singleton instances
const logger = Logger.getInstance({});

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
    logger.debug('Inside EventListeners constructor');

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

    this.registeredEvents = new Set<EventType>();
  }

  /**
   * Gets the singleton instance of EventListeners.
   * @returns The EventListeners instance
   */
  public static getInstance(): EventListeners {
    if (!EventListeners.instance) {
      EventListeners.instance = new EventListeners();
    }
    return EventListeners.instance;
  }

  /**
   * Registers an event listener for a specific event type.
   * @param event - The event type to listen for
   * @param listener - The listener function to call when the event occurs
   */
  public on<K extends EventType>(event: K, listener: TypedEventListener<K>): void {
    logger.debug(`Registering listener for event: ${event}`);
    this.listeners[event].push(listener);
    this.registeredEvents.add(event);
  }

  /**
   * Removes an event listener for a specific event type.
   * @param event - The event type to remove the listener from
   * @param listener - The listener function to remove
   */
  public off<K extends EventType>(event: K, listener: TypedEventListener<K>): void {
    logger.debug(`Removing listener for event: ${event}`);
    const index = this.listeners[event].indexOf(listener);
    if (index !== -1) {
      this.listeners[event].splice(index, 1);
    }
    if (this.listeners[event].length === 0) {
      this.registeredEvents.delete(event);
    }
  }

  /**
   * Emits an event with the provided arguments.
   * @param event - The event type to emit
   * @param args - The arguments to pass to the event listeners
   * @returns A promise that resolves when all listeners have been called
   */
  public async emit<K extends EventType>(
    event: K,
    ...args: EventListenerParameters[K]
  ): Promise<void> {
    logger.debug(`Emitting event: ${event}`);
    if (!this.registeredEvents.has(event)) {
      return;
    }

    const listeners = this.listeners[event] as TypedEventListener<K>[];
    for (const listener of listeners) {
      try {
        await listener(...args);
      } catch (error) {
        logger.error(`Error in event listener for ${event}: ${error}`);
      }
    }
  }

  /**
   * Checks if there are any listeners registered for a specific event type.
   * @param event - The event type to check
   * @returns True if there are listeners registered for the event, false otherwise
   */
  public hasListeners(event: EventType): boolean {
    return this.registeredEvents.has(event);
  }

  /**
   * Gets all registered event types.
   * @returns An array of registered event types
   */
  public getRegisteredEvents(): EventType[] {
    return Array.from(this.registeredEvents);
  }
}
