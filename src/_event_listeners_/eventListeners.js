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

// eventLsteners.js
class EventListeners {
    constructor() {
      this.listeners = {
        beforeResponse: [],
        afterResponse: [],
        beforeRequest: [],
        afterRequest: [],
        beforeDecide: [],
        afterDecide: [],
        beforeDetermineFlag: [],
        afterDetermineFlag: [],
        beforeReadingCookie: [],
        afterReadingCookie: [],
        beforeReadingCache: [],
        afterReadingCache: [],
        beforeProcessingRequest: [],
        afterProcessingRequest: [],
      };
    }
  
    on(event, listener) {
      if (this.listeners[event]) {
        this.listeners[event].push(listener);
      } else {
        logger().error(`Event ${event} not supported`);
      }
    }
  
    trigger(event, ...args) {
      if (this.listeners[event]) {
        for (const listener of this.listeners[event]) {
          listener(...args);
        }
      }
    }
  }
  
  export default EventListeners;
  

  /*
    // Register Event Listeners
    eventListeners.on('beforeResponse', (request, response) => {
      logger.debug('Before response event triggered');
      // Custom logic here
      response.headers.set('X-Custom-Header', 'CustomValue');
    });

    // Trigger Before Response Event
    eventListeners.trigger('beforeResponse', request, response);
  */