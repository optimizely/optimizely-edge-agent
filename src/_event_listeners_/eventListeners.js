/**
 * @module EventListeners
 *
 * The EventListeners module is a module that provides a unified interface for interacting with the event listeners.
 * It is used to abstract the specifics of how the event listeners are implemented.
 *
 * The following methods are implemented:
 * - on(event, listener) - Registers a listener for a given event.
 * - trigger(event, ...args) - Triggers an event with optional arguments.
 */

import { logger } from '../_helpers_/optimizelyHelper.js';

class EventListeners {
  constructor() {
    if (EventListeners.instance) {
      return EventListeners.instance;
    }
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
    this.registeredEvents = new Set();
    EventListeners.instance = this;
  }

  static getInstance() {
    if (!EventListeners.instance) {
      EventListeners.instance = new EventListeners();
    }
    return EventListeners.instance;
  }

  on(event, listener) {
    if (this.listeners[event]) {
      this.listeners[event].push(listener);
      this.registeredEvents.add(event);
    } else {
      logger().error(`Event ${event} not supported`);
    }
  }

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


	// async trigger(event, ...args) {
	// 	if (this.registeredEvents.has(event)) {
	// 		const combinedResults = {};
	// 		for (const listener of this.listeners[event]) {
	// 			const result = await listener(...args);
	// 			if (result !== undefined) {
	// 				Object.assign(combinedResults, result);
	// 			}
	// 		}
	// 		return combinedResults;
	// 	}
	// }

	// async trigger(event, ...args) {
	//   if (this.registeredEvents.has(event)) {
	//     for (const listener of this.listeners[event]) {
	//       const result = await listener(...args);
	//       if (result !== undefined) {
	//         args[0] = result;
	//       }
	//     }
	//   }
	// }

// export default EventListeners;

/* 
import EventListeners from './path/to/eventListeners';
import { logger } from './path/to/logger';

const eventListeners = new EventListeners();

// Register an async event listener that modifies the response object
eventListeners.on('beforeResponse', async (request, response) => {
  logger.debug('Before response event triggered');
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 100));
  // Clone and modify the response object
  const modifiedResponse = new Response(response.body, {
    ...response,
    headers: { ...response.headers, 'X-Custom-Header': 'CustomValue' }
  });
  return modifiedResponse; // Return the modified response
});

// Register an async event listener that logs information without modifying the object
eventListeners.on('beforeRequest', async (request) => {
  logger.debug('Before request event triggered');
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 100));
  // Log information without modifying the request
});

eventListeners.on('afterRequest', async (request) => {
  logger.debug('Before request event triggered');
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 100));
  // Log information without modifying the request
});


// Example request and response objects
let request = new Request('https://example.com');
let response = new Response();

// Trigger the 'beforeResponse' event and await the result
const { modifiedRequest, modifiedResponse } = await eventListeners.trigger('beforeResponse', request, response);


// Trigger the 'beforeRequest' event
request = await eventListeners.trigger('beforeRequest', request);
*/

