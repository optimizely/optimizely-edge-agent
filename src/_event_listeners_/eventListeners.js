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
	 */
	listeners = new Map(Object.entries(EventListeners.LISTENER_EVENTS).map(([_, value]) => [value, []]));

	/**
	 * The set of registered events.
	 * @type {Set}
	 */
	registeredEvents = new Set();

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
		if (this.listeners.has(event)) {
			this.listeners.get(event).push(listener);
			this.registeredEvents.add(event);
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
		if (this.registeredEvents.has(event)) {
			for (const listener of this.listeners.get(event)) {
				try {
					const result = await listener(...args);
					if (result !== undefined) {
						Object.assign(combinedResults, result);
					}
				} catch (error) {
					logger().error(`Error in listener for event ${event}: ${error.message}`);
				}
			}
		} else {
			logger().error(`Event ${event} not registered`);
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
		if (!this.listeners.has(event)) {
			logger().error(`Event ${event} not supported`);
			return false;
		}

		const listeners = this.listeners.get(event);
		const index = listeners.indexOf(listener);
		if (index === -1) {
			return false;
		}

		listeners.splice(index, 1);
		if (listeners.length === 0) {
			this.registeredEvents.delete(event);
		}
		return true;
	}

	/**
	 * Clears all registered event listeners
	 */
	clearListeners() {
		this.listeners = new Map(Object.entries(EventListeners.LISTENER_EVENTS).map(([_, value]) => [value, []]));
		this.registeredEvents.clear();
	}
}

export default EventListeners;
