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
        console.error(`Event ${event} not supported`);
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
      console.log('Before response event triggered');
      // Custom logic here
      response.headers.set('X-Custom-Header', 'CustomValue');
    });

    // Trigger Before Response Event
    eventListeners.trigger('beforeResponse', request, response);
  */