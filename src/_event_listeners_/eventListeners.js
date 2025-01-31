/**
 * @module EventListeners
 *
 * The EventListeners module is a module that provides a unified interface for interacting with the event listeners.
 * It is used to abstract the specifics of how the event listeners are implemented.
 *
 * The following methods are implemented:
 * - getInstance() - Gets the singleton instance of EventListeners.
 * - on(event, listener) - Registers a listener for a given event.
 * - off(event, listener) - Removes a specific listener from an event.
 * - trigger(event, ...args) - Triggers an event with optional arguments.
 * - clearListeners() - Clears all registered event listeners.
 */

import { logger } from '../_helpers_/optimizelyHelper.js';

/**
 * Class representing the EventListeners.
 */
class EventListeners {
	static #instance = null; // Private static field
	static LISTENER_EVENTS = {
		BEFORE_RESPONSE: 'beforeResponse',
		AFTER_RESPONSE: 'afterResponse',
		BEFORE_CREATE_CACHE_KEY: 'beforeCreateCacheKey',
		AFTER_CREATE_CACHE_KEY: 'afterCreateCacheKey',
		BEFORE_CACHE_RESPONSE: 'beforeCacheResponse',
		AFTER_CACHE_RESPONSE: 'afterCacheResponse',
		BEFORE_REQUEST: 'beforeRequest',
		AFTER_REQUEST: 'afterRequest',
		BEFORE_DECIDE: 'beforeDecide',
		AFTER_DECIDE: 'afterDecide',
		BEFORE_DETERMINE_FLAGS_TO_DECIDE: 'beforeDetermineFlagsToDecide',
		AFTER_DETERMINE_FLAGS_TO_DECIDE: 'afterDetermineFlagsToDecide',
		BEFORE_READING_COOKIE: 'beforeReadingCookie',
		AFTER_READING_COOKIE: 'afterReadingCookie',
		BEFORE_READING_CACHE: 'beforeReadingCache',
		AFTER_READING_CACHE: 'afterReadingCache',
		BEFORE_PROCESSING_REQUEST: 'beforeProcessingRequest',
		AFTER_PROCESSING_REQUEST: 'afterProcessingRequest',
		BEFORE_READING_REQUEST_CONFIG: 'beforeReadingRequestConfig',
		AFTER_READING_REQUEST_CONFIG: 'afterReadingRequestConfig',
		BEFORE_DISPATCHING_EVENTS: 'beforeDispatchingEvents',
		AFTER_DISPATCHING_EVENTS: 'afterDispatchingEvents',
	};

	/**
	 * The registered event listeners.
	 * @type {Map<string, Array<Function>>}
	 * @private
	 */
	#listeners = new Map(Object.entries(EventListeners.LISTENER_EVENTS).map(([_, value]) => [value, []]));

	/**
	 * Creates an instance of EventListeners.
	 * @constructor
	 */
	constructor() {
		logger().debug('Inside EventListeners constructor');

		// since #constructor can be private
		if (EventListeners.#instance) {
			throw new Error('Use EventListeners.getInstance() instead');
		}

		EventListeners.#instance = this;
	}

	/**
	 * Gets the singleton instance of EventListeners.
	 * @returns {EventListeners} The EventListeners instance.
	 */
	static getInstance() {
		if (!EventListeners.#instance) {
			EventListeners.#instance = new EventListeners();
		}
		return EventListeners.#instance;
	}

	/**
	 * Registers a listener for a given event.
	 * @param {string} event - The event to register the listener for.
	 * @param {Function} listener - The listener function to be called when the event is triggered.
	 */
	on(event, listener) {
		if (this.#listeners.has(event)) {
			this.#listeners.get(event).push(listener);
		} else {
			logger().error(`Event ${event} not supported`);
		}
	}

	/**
	 * Triggers an event with optional arguments.
	 * @param {string} event - The event to trigger.
	 * @param {...*} args - The arguments to pass to the event listeners.
	 * @returns {Promise<Object>} A promise that resolves to the combined results of all event listeners.
	 */
	async trigger(event, ...args) {
		const combinedResults = {};
		const eventListeners = this.#listeners.get(event);
		
		if (!eventListeners) {
			logger().error(`Event ${event} not supported`);
			return combinedResults;
		}

		if (eventListeners.length === 0) {
			logger().debug(`No listeners registered for event ${event}`);
			return combinedResults;
		}

		for (const listener of eventListeners) {
			try {
				const result = await listener(...args);
				if (result !== undefined) {
					Object.assign(combinedResults, result);
				}
			} catch (error) {
				logger().error(`Error in listener for event ${event}: ${error.message}`);
			}
		}
		return combinedResults;
	}

	/**
	 * Removes a specific listener from an event
	 * @param {string} event - The event to remove the listener from
	 * @param {Function} listener - The listener function to remove
	 * @returns {boolean} - True if the listener was found and removed, false otherwise
	 */
	off(event, listener) {
		if (!this.#listeners.has(event)) {
			logger().error(`Event ${event} not supported`);
			return false;
		}

		const listeners = this.#listeners.get(event);
		const index = listeners.indexOf(listener);
		if (index === -1) {
			return false;
		}

		listeners.splice(index, 1);
		return true;
	}

	/**
	 * Clears all registered event listeners
	 */
	clearListeners() {
		// Reset all listener arrays to empty while maintaining the same event keys
		for (const [event] of this.#listeners) {
			this.#listeners.set(event, []);
		}
	}

	/**
	 * Gets the number of listeners for a given event.
	 * @param {string} event - The event to get the listener count for
	 * @returns {number} The number of listeners for the event, or 0 if the event is not supported
	 */
	getListenerCount(event) {
		const listeners = this.#listeners.get(event);
		return listeners ? listeners.length : 0;
	}

	/**
	 * Checks if an event has any registered listeners.
	 * @param {string} event - The event to check
	 * @returns {boolean} True if the event has listeners, false otherwise
	 */
	hasListeners(event) {
		return this.getListenerCount(event) > 0;
	}
}

export default EventListeners;
