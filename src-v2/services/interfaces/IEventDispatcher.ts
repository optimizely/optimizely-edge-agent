import { OptimizelyUserContext } from "./IDecisionService";

/**
 * Represents an Optimizely event to be dispatched.
 * TODO: Define structure based on Optimizely event batch/format requirements.
 */
export interface OptimizelyEvent { // Replace with actual type
  type: 'impression' | 'conversion';
  timestamp: number;
  uuid: string;
  userContext: OptimizelyUserContext;
  // ... other event properties (flagKey, eventKey, revenue, tags etc.)
}

/**
 * @interface IEventDispatcher
 * @description Defines the contract for dispatching Optimizely tracking events.
 */
export interface IEventDispatcher {
  /**
   * Dispatches a single Optimizely event.
   * @param event - The event object to dispatch.
   * @returns A promise resolving when the event is accepted for dispatch (may not mean sent).
   */
  dispatchEvent(event: OptimizelyEvent): Promise<void>;

  /**
   * Flushes any buffered events (optional, if batching is used).
   * @returns A promise resolving when buffered events are sent or accepted for sending.
   */
  flushEvents?(): Promise<void>;
} 