import EventListeners from '../eventListeners';
import { logger } from '../../_helpers_/optimizelyHelper';
import { AbstractionHelper } from '../../_helpers_/abstractionHelper';
import { AbstractRequest } from '../../_helpers_/abstraction-classes/abstractRequest';
import { AbstractResponse } from '../../_helpers_/abstraction-classes/abstractResponse';
let eventListeners = EventListeners.getInstance();

//// Register an async event listener for 'beforeCacheResponse'
eventListeners.on('beforeCacheResponse', async (request, response) => {
	logger().debug('Before cache response event triggered');
	// 	// Function to modify request and response objects
	// 	async function modifyRequestResponse(request, response) {
	// 		// Modify the request object if needed
	// 		// For example, add a new header to the request
	// 		let clonedRequest;
	// 		if (request.headers) {
	// 			clonedRequest = AbstractRequest.createNewRequest(request);
	// 			AbstractRequest.setHeaderInRequest(clonedRequest, 'X-Modified-Header', 'Modified Request');
	// 		}

	// 		// Modify the response object if needed
	// 		// For example, add a new header to the response
	// 		AbstractResponse.setHeader(response, 'X-Modified-Response-Header', 'Modified Response');

	// 		// Clone the response using AbstractResponse.cloneResponse if needed
	// 		const clonedResponse = await AbstractResponse.cloneResponse(response);

	// 		// Return an object with the modified request and response
	// 		return { modifiedRequest: clonedRequest, modifiedResponse: clonedResponse };
	// }

	// 	// Call the modifyRequestResponse function and await the result
	// 	const { modifiedRequest, modifiedResponse } = await modifyRequestResponse(request, response);

	// 	// Read values from the modified request and response objects
	// 	const modifiedRequestHeader = AbstractRequest.getHeaderFromRequest(modifiedRequest, 'X-Modified-Header');
	// 	const modifiedResponseHeader = AbstractResponse.getHeader(modifiedResponse, 'X-Modified-Response-Header');

	// 	// Log the read values
	// 	logger().debug('Modified request header value:', modifiedRequestHeader);
	// 	logger().debug('Modified response header value:', modifiedResponseHeader);

	// 	// Return an object with the modified request and response
	// 	return { modifiedRequest, modifiedResponse };
});

// Register an async event listener for 'afterCacheResponse'
eventListeners.on('afterCacheResponse', async (request, response, cdnExperimentSettings) => {
	logger().debug('After cache response event triggered');
	// This must be an async operation
	// await new Promise(resolve => { return AbstractResponse.cloneResponse(response) });
	// Log information without modifying the response
});

//// Register an async event listener for 'beforeResponse'
eventListeners.on('beforeResponse', async (request, response, cdnExperimentSettings) => {
	logger().debug('Before response event triggered');
	// This must be an async operation
	// await new Promise(resolve => { return AbstractResponse.cloneResponse(response) });
	// Log information without modifying the response
	// return { modifiedRequest, modifiedResponse };
});

// Register an async event listener for 'afterResponse'
eventListeners.on('afterResponse', async (request, response, cdnExperimentSettings) => {
	logger().debug('After response event triggered');

	// // Function to modify request and response objects
	// async function modifyRequestResponse(request, response) {
	// 	// Modify the request object if needed
	// 	// For example, add a new header to the request
	// 	let clonedRequest;
	// 	if (request.headers) {
	// 		clonedRequest = AbstractRequest.createNewRequest(request);
	// 		AbstractRequest.setHeaderInRequest(clonedRequest, 'X-Modified-Header', 'Modified Request');
	// 	}

	// 	// Modify the response object if needed
	// 	// For example, add a new header to the response
	// 	AbstractResponse.setHeader(response, 'X-Modified-Response-Header', 'Modified Response');

	// 	// Clone the response using AbstractResponse.cloneResponse if needed
	// 	const clonedResponse = await AbstractResponse.cloneResponse(response);

	// 	// Return an object with the modified request and response
	// 	return { modifiedRequest: clonedRequest, modifiedResponse: clonedResponse };
	// }

	// // Call the modifyRequestResponse function and await the result
	// const { modifiedRequest, modifiedResponse } = await modifyRequestResponse(request, response);

	// // Read values from the modified request and response objects
	// const modifiedRequestHeader = AbstractRequest.getHeaderFromRequest(modifiedRequest, 'X-Modified-Header');
	// const modifiedResponseHeader = AbstractResponse.getHeader(modifiedResponse, 'X-Modified-Response-Header');

	// // Log the read values
	// logger().debug('Modified request header value:', modifiedRequestHeader);
	// logger().debug('Modified response header value:', modifiedResponseHeader);

	// // Return an object with the modified request and response
	// return { modifiedRequest, modifiedResponse };
});

// Register an async event listener for 'beforeCreateCacheKey'
eventListeners.on('beforeCreateCacheKey', async (request, cdnExperimentSettings) => {
	// If you provide your own value for cacheKey, then this value will be used.
	let cacheKey = undefined;
	logger().debug('Before create cache key event triggered');
	// This must be an async operation
	// await new Promise(resolve => { return AbstractRequest.cloneRequest(request) });
	// Log information without modifying the request
	return { request, cacheKey };
});

// Register an async event listener for 'afterCreateCacheKey'
eventListeners.on('afterCreateCacheKey', async (cacheKey, cdnExperimentSettings) => {
	// This method expects no return value.
	logger().debug('After create cache key event triggered, cacheKey:', cacheKey);
	// This must be an async operation
	// await new Promise(resolve => { return AbstractRequest.cloneRequest(request) });
	// Log information without modifying the request
});

// Register an async event listener for 'beforeRequest'
eventListeners.on('beforeRequest', async (request, cdnExperimentSettings) => {
	logger().debug('Before request event triggered');
	// This must be an async operation
	// await new Promise(resolve => { return AbstractRequest.cloneRequest(request) });
	// Log information without modifying the request
});

// Register an async event listener for 'afterRequest'
eventListeners.on('afterRequest', async (request, response, cdnExperimentSettings) => {
	logger().debug('After request event triggered');
	// This must be an async operation
	// await new Promise(resolve => { return AbstractRequest.cloneRequest(request) });
	// Log information without modifying the request
	// return { modifiedRequest, modifiedResponse };
});

// Register an async event listener for 'beforeDecide'
eventListeners.on('beforeDecide', async (request, requestConfig, flagsToDecide, flagsToForce) => {
	// logger().debug('Before decide event triggered');
	// This must be an async operation
	// This method expects no return value.
	// Log information without modifying the request
});

// Register an async event listener for 'afterDecide'
eventListeners.on('afterDecide', async (request, requestConfig, decisions) => {
	// logger().debug('After decide event triggered');
	// This must be an async operation
	// await new Promise(resolve => { return decisions });
	// Log information without modifying the request
});

// Register an async event listener for 'beforeDetermineFlag'
eventListeners.on('beforeDetermineFlagsToDecide', async (request, requestConfig) => {
	// 	// logger().debug('Before determine flag event triggered');
	// 	// This must be an async operation
	// 	// This method expects no return value.
	// 	// Log information without modifying the request
});

// Register an async event listener for 'afterDetermineFlag'
eventListeners.on(
	'afterDetermineFlagsToDecide',
	async (request, requestConfig, flagsToForce, flagsToDecide, validStoredDecisions) => {
		// logger().debug('After determine flag event triggered');
		// This must be an async operation
		// This method expects no return value.
		// Log information without modifying the request
	}
);

// Register an async event listener for 'beforeReadingCookie'
eventListeners.on('beforeReadingCookie', async (request, cookieHeaderString) => {
	// logger().debug('Before reading cookie event triggered');
	// 	// This must be an async operation
	// 	// This method expects no return value.
	// 	// Log information without modifying the request
});

// Register an async event listener for 'afterReadingCookie'
eventListeners.on(
	'afterReadingCookie',
	async (request, savedCookieDecisions, validStoredDecisions, invalidCookieDecisions) => {
		logger().debug('After reading cookie event triggered');
		logger().debug(
			'Saved cookie decisions:',
			savedCookieDecisions,
			'Valid stored decisions:',
			validStoredDecisions,
			'Invalid cookie decisions:',
			invalidCookieDecisions
		);
		// This must be an async operation
		return { savedCookieDecisions, validStoredDecisions, invalidCookieDecisions };
		// Log information without modifying the request
	}
);

// Register an async event listener for 'beforeReadingCache'
eventListeners.on('beforeReadingCache', async (request, requestConfig, cdnExperimentSettings) => {
	logger().debug('Before reading cache event triggered');
	// This must be an async operation
	// const modifiedResponse = await new Promise(resolve => { return AbstractRequest.cloneResponse(responseToCache) });	
	// Log information without modifying the request
    //return { modifiedResponse };
});

// Register an async event listener for 'afterReadingCache'
eventListeners.on('afterReadingCache', async (request, responseFromCache, requestConfig, cdnExperimentSettings) => {
	logger().debug('After reading cache event triggered');
	// This must be an async operation
	// const modifiedResponse = await new Promise(resolve => { return AbstractRequest.cloneResponse(responseFromCache) });
	// Log information without modifying the request
	// return { modifiedResponse };
});

// Register an async event listener for 'beforeProcessingRequest'
eventListeners.on('beforeProcessingRequest', async (request, requestConfig) => {
	// logger().debug('Before processing request event triggered');
	// This must be an async operation
	// await new Promise(resolve => { return AbstractRequest.cloneRequest(request) });
	// Log information without modifying the request
	// return { modifiedRequest };
});

// Register an async event listener for 'afterProcessingRequest'
eventListeners.on('afterProcessingRequest', async (request, response, requestConfig, processedResult) => {
	// logger().debug('After processing request event triggered');
	// This must be an async operation
	// await new Promise(resolve => { return AbstractRequest.cloneRequest(request) });
	// Log information without modifying the request
	// return { modfiedResponse };
});

export default eventListeners;
// event
