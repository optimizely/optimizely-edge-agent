/**
 * @module EventListeners
 *
 * The EventListeners module is a module that provides a unified interface for interacting with the event listeners.
 * It is used to abstract the specifics of how the event listeners are implemented.
 *
 * The following methods are implemented:
 * - getInstance() - Gets the singleton instance of EventListeners.
 * - on(event, listener) - Registers a listener for a given event.
 * - trigger(event, ...args) - Triggers an event with optional arguments.
 */

import { logger } from '../../../utils/helpers/optimizelyHelper';
import defaultSettings from '../../../legacy/config/defaultSettings';

/**
 * Class representing the EventListeners.
 */
class EventListeners {
	/**
	 * Creates an instance of EventListeners.
	 * @constructor
	 */
	constructor() {
		logger().debug('Inside EventListeners constructor');
		if (EventListeners.instance) {
			return EventListeners.instance;
		}

		/**
		 * The registered event listeners.
		 * @type {Object}
		 */
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
			afterDispatchingEvents: [],
		};

		/**
		 * The set of registered events.
		 * @type {Set}
		 */
		this.registeredEvents = new Set();

		EventListeners.instance = this;
	}

	/**
	 * Gets the singleton instance of EventListeners.
	 * @returns {EventListeners} The EventListeners instance.
	 */
	static getInstance() {
		if (!EventListeners.instance) {
			EventListeners.instance = new EventListeners();
		}
		return EventListeners.instance;
	}

	/**
	 * Registers a listener for a given event.
	 * @param {string} event - The event to register the listener for.
	 * @param {Function} listener - The listener function to be called when the event is triggered.
	 */
	on(event, listener) {
		if (this.listeners[event]) {
			this.listeners[event].push(listener);
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
			for (const listener of this.listeners[event]) {
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
}

export default EventListeners;
