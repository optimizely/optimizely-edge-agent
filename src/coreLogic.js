/**
 * @module coreLogic
 */

import * as optlyHelper from './_helpers_/optimizelyHelper';
import RequestConfig from './_config_/requestConfig';
import defaultSettings from './_config_/defaultSettings';
import EventListeners from './_event_listeners_/eventListeners';

/**
 * Optimizely Feature Variable Name for Settings: "cdnVariationSettings"
 *
 * This variable is crucial for configuring the behavior of GET requests during feature tests or targeted deliveries.
 *
 * cdnVariationSettings: {
 *     // The URL to match for GET requests to determine which experiment to apply, whether to return content directly
 *     // or forward the request to the origin.
 *     cdnExperimentURL: 'https://www.expedge.com/page/1',
 *
 *     // The URL from which to fetch the variation content. This content can be served from origin or cache depending
 *     // on the cache configuration.
 *     cdnResponseURL: 'https://www.expedge.com/page/2',
 *
 *     // Specifies the cache key for GET requests. Using "VARIATION_KEY" employs the combination of flagKey and
 *     // variationKey to create a unique cache key. If a custom value is provided, it will be used as the cache key.
 *     // Cache keys are constructed by appending a path segment to the fully qualified domain name of the request URL.
 *     cacheKey: 'VARIATION_KEY',
 *
 *     // If true for GET requests, decisions made by Optimizely (e.g., which variation to serve) are forwarded to the
 *     // origin server as part of the request, encapsulated in cookies or headers. If the cdnResponseURL is a valid URL,
 *     // the request is forwarded to this URL instead of the original request URL.
 *     forwardRequestToOrigin: 'true',
 *
 *     // If set to true, any requests that are forwarded to the origin are cached, optimizing subsequent requests for
 *     // the same content and reducing load on the origin server.
 *     cacheRequestToOrigin: 'true',
 *
 *     // Indicates whether the settings being used are for the control group in an A/B test. When false, it implies that
 *     // the variation is experimental.
 *     isControlVariation: 'false'
 * },
 */

/**
 * The CoreLogic class is the core logic class for processing requests and managing Optimizely decisions.
 * CoreLogic is shared across all CDN Adapters. CoreLogic utilizes the AbstractionHelper to abstract the request and response objects.
 * It implements the following methods:
 * - setCdnAdapter(cdnAdapter) - Sets the CDN provider for the instance.
 * - getCdnAdapter() - Retrieves the current CDN provider.
 * - processRequest(request, env, ctx) - Processes the incoming request, initializes configurations, and determines response based on
 * 	 operation type.
 * - findMatchingConfig(requestURL, decisions, ignoreQueryParameters) - Searches for a CDN configuration that matches a given URL within an
 * 	 array of decision objects.
 * - prepareDecisions(optlyResponse, flagsToForce, validStoredDecisions, requestConfig) - Prepares the decisions for the final response.
 * - prepareFinalResponse(allDecisions, visitorId, requestConfig, serializedDecisions) - Prepares the final response based on the decisions.
 * - shouldReturnJsonResponse() - Checks if the response should be returned in JSON format.
 * - getIsDecideOperation(pathName) - Checks if the pathname indicates a decide operation.
 * - getVisitorId(request, requestConfig) - Retrieves the visitor ID from the request.
 * - retrieveDatafile(requestConfig, env) - Retrieves the datafile from the Optimizely CDN.
 * - initializeOptimizely(datafile, visitorId, requestConfig, userAgent) - Initializes Optimizely with the retrieved datafile.
 * - determineFlagsToDecide(requestConfig) - Determines which flags to force and which to decide based on the request.
 * - optimizelyExecute(filteredFlagsToDecide, flagsToForce, requestConfig) - Executes the Optimizely logic and returns the decisions.
 * - updateMetadata(requestConfig, flagsToForce, validStoredDecisions) - Updates the metadata for the request.
 * - deleteAllUserContexts(decisions) - Deletes the userContext key from each decision object in the given array.
 * - extractCdnSettings(decisions) - Maps an array of decisions to a new array of objects containing specific CDN settings.
 * - getConfigForDecision(decisions, flagKey, variationKey) - Filters a provided array of decision settings to find a specific CDN
 *   configuration for an indivdual experiment
 * based on flagKey and variationKey, then returns the specific variation's configuration.
 *
 */
export default class CoreLogic {
	/**
	 * Creates an instance of CoreLogic.
	 * @param {*} cdnAdapter - The CDN provider.
	 * @param {*} optimizelyProvider - The Optimizely provider.
	 */
	constructor(optimizelyProvider, env, ctx, sdkKey, abstractionHelper, kvStore, kvStoreUserProfile, logger) {
		this.logger = logger;
		this.logger.info(`CoreLogic instance created for SDK Key: ${sdkKey}`);
		this.env = env;
		this.ctx = ctx;
		this.kvStore = kvStore || undefined;
		this.sdkKey = sdkKey;
		this.logger = logger;
		this.abstractionHelper = abstractionHelper;
		this.optimizelyProvider = optimizelyProvider;
		this.kvStoreUserProfile = kvStoreUserProfile;
		this.eventListeners = EventListeners.getInstance();
		this.cdnAdapter = undefined;
		this.reqResponseObjectType = 'response';
		this.allDecisions = undefined;
		this.serializedDecisions = undefined;
		this.cdnExperimentSettings = undefined;
		this.cdnExperimentURL = undefined;
		this.cdnResponseURL = undefined;
		this.forwardRequestToOrigin = undefined;
		this.cacheKey = undefined;
		this.isDecideOperation = undefined;
		this.isPostMethod = undefined;
		this.isGetMethod = undefined;
		this.forwardToOrigin = undefined;
		this.activeFlags = undefined;
		this.savedCookieDecisions = undefined;
		this.validCookiedDecisions = undefined;
		this.invalidCookieDecisions = undefined;
		this.datafileOperation = false;
		this.configOperation = false;
		this.request = undefined;
		this.env = undefined;
		this.ctx = undefined;
	}

	/**
	 * Sets the CDN provider for the instance.
	 * @param {string} provider - The name of the CDN provider to set.
	 */
	setCdnAdapter(cdnAdapter) {
		this.cdnAdapter = cdnAdapter;
	}

	/**
	 * Retrieves the current CDN provider.
	 * @returns {string} The current CDN provider.
	 */
	getCdnAdapter() {
		return this.setCdnAdapter;
	}

	/**
	 * Deletes the userContext key from each decision object in the given array.
	 * @param {Object[]} decisions - Array of decision objects.
	 */
	deleteAllUserContexts(decisions) {
		return decisions;
		if (this.requestConfig.trimmedDecisions === true) {
			decisions.forEach((decision) => {
				delete decision.userContext;
			});
		}
		return decisions;
	}

	/**
	 * Maps an array of decisions to a new array of objects containing specific CDN settings.
	 * Each object includes the flagKey, variationKey, and nested CDN variables.
	 * @param {Object[]} decisions - Array of decision objects.
	 * @returns {Object[]} An array of objects structured by flagKey and variationKey with CDN settings.
	 */
	extractCdnSettings(decisions) {
		this.logger.debugExt('Extracting CDN settings from decisions', decisions);
		const result = decisions.map((decision) => {
			const { flagKey, variationKey, variables } = decision;
			const settings = variables.cdnVariationSettings || {};
			const result = {
				[flagKey]: {
					[variationKey]: {
						cdnExperimentURL: settings.cdnExperimentURL || undefined,
						cdnResponseURL: settings.cdnResponseURL || undefined,
						cacheKey: settings.cacheKey || undefined,
						forwardRequestToOrigin:
							(settings.forwardRequestToOrigin && settings.forwardRequestToOrigin === 'true') || false,
						cacheRequestToOrigin: (settings.cacheRequestToOrigin && settings.cacheRequestToOrigin === 'true') || false,
						isControlVariation: (settings.isControlVariation && settings.isControlVariation === 'true') || false,
					},
				},
			};
			return result;
		});
		this.logger.debugExt('CDN settings extracted: ', result);
		return result;
	}

	/**
	 * Filters a provided array of decision settings to find a specific CDN configuration for an indivdual experiment
	 * based on flagKey and variationKey, then returns the specific variation's configuration.
	 * @param {Object[]} decisions - Array of decision objects structured by flagKey and variationKey.
	 * @param {string} flagKey - The flag key to filter by.
	 * @param {string} variationKey - The variation key to filter by.
	 * @returns {Object|undefined} The specific variation configuration or undefined if not found.
	 */
	async getConfigForDecision(decisions, flagKey, variationKey) {
		const filtered = decisions.find(
			(decision) => decision.hasOwnProperty(flagKey) && decision[flagKey].hasOwnProperty(variationKey)
		);
		return filtered ? filtered[flagKey][variationKey] : undefined;
	}

	/**
	 * Processes an array of decision objects by removing the userContext and extracting CDN settings.
	 * This method first deletes the userContext from each decision object, then extracts specific CDN settings
	 * based on the presence of the cdnVariationSettings variable.
	 * @param {Object[]} decisions - Array of decision objects.
	 * @returns {Object[]} An array of objects structured by flagKey and variationKey with CDN settings.
	 */
	processDecisions(decisions) {
		let result = this.deleteAllUserContexts(decisions); // Remove userContext from all decision objects
		result = this.extractCdnSettings(result); // Extract and return CDN settings
		return result; // Extract and return CDN settings
	}

	/**
	 * Sets the class properties based on the CDN configuration found.
	 * @param {Object} cdnConfig - The CDN configuration object.
	 * @param {string} flagKey - The flag key associated with the configuration.
	 * @param {string} variationKey - The variation key associated with the configuration.
	 */
	setCdnConfigProperties(cdnConfig, flagKey, variationKey) {
		this.cdnExperimentURL = cdnConfig.cdnExperimentURL;
		this.cdnResponseURL = cdnConfig.cdnResponseURL;
		this.cacheKey = cdnConfig.cacheKey;
		this.forwardRequestToOrigin = cdnConfig.forwardRequestToOrigin;
		this.activeVariation = variationKey;
		this.activeFlag = flagKey;
		cdnConfig.flagKey = flagKey;
		cdnConfig.variationKey = variationKey;
	}

	/**
	 * Searches for a CDN configuration that matches a given URL within an array of decision objects.
	 * It compares the request URL against each cdnExperimentURL, optionally ignoring query parameters based on the flag.
	 * Efficiently compares URLs and caches matched configuration data for quick access.
	 * @param {string} requestURL - The URL to match against cdnExperimentURLs in the decisions data.
	 * @param {Array} decisions - The array of decision objects to search within.
	 * @param {boolean} [ignoreQueryParameters=true] - Whether to ignore query parameters in the URL during comparison.
	 * @returns {Object|null} The first matching CDN configuration object, or null if no match is found.
	 */
	async findMatchingConfig(requestURL, decisions, ignoreQueryParameters = true) {
		this.logger.debug(`Searching for matching CDN configuration for URL: ${requestURL}`);
		// Process decisions to prepare them for comparison
		const processedDecisions = this.processDecisions(decisions);
		const url = this.abstractionHelper.abstractRequest.getNewURL(requestURL);
		// Ensure the URL uses HTTPS
		if (url.protocol !== 'https:') {
			url.protocol = 'https:';
		}
		const testFlagKey =
			this.env.LOG_LEVEL === 'debug' && this.env.TESTING_FLAG_DEBUG && this.env.TESTING_FLAG_DEBUG.trim() !== ''
				? this.env.TESTING_FLAG_DEBUG.trim()
				: null;

		// Remove query parameters if needed
		if (ignoreQueryParameters) {
			url.search = '';
		}

		// Normalize the pathname by removing a trailing '/' if present
		const normalizedPathname = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
		// Construct a comparison URL string
		const compareOriginAndPath = url.origin + normalizedPathname;

		// Log the normalized URL to be compared
		this.logger.debug(`Normalized URL for comparison: ${compareOriginAndPath}`);

		// Iterate through decisions to find a matching CDN configuration
		for (let decision of processedDecisions) {
			for (let flagKey in decision) {
				for (let variationKey in decision[flagKey]) {
					const cdnConfig = decision[flagKey][variationKey];
					if (cdnConfig && cdnConfig.cdnExperimentURL) {
						// Normalize the CDN URL for comparison
						const cdnUrl = this.abstractionHelper.abstractRequest.getNewURL(cdnConfig.cdnExperimentURL);
						if (ignoreQueryParameters) {
							cdnUrl.search = '';
						}
						const cdnNormalizedPathname = cdnUrl.pathname.endsWith('/')
							? cdnUrl.pathname.slice(0, -1)
							: cdnUrl.pathname;
						const targetUrl = cdnUrl.origin + cdnNormalizedPathname;

						// Log the comparison details
						this.logger.debug('Comparing URL: ' + compareOriginAndPath + ' with ' + targetUrl);
						// Compare the normalized URLs
						if (compareOriginAndPath === targetUrl || (testFlagKey && testFlagKey === flagKey)) {
							this.logger.debug(
								`Match found for URL: ${requestURL}. Flag Key: ${flagKey}, Variation Key: ${variationKey}, CDN Config: ${cdnConfig}`
							);
							this.setCdnConfigProperties(cdnConfig, flagKey, variationKey);
							return cdnConfig;
						}
					}
				}
			}
		}

		// Return null if no matching configuration is found
		this.logger.debug('No matching configuration found in cdnVariationSettings [findMatchingConfig]');
		return null;
	}

	/**
	 * Processes the incoming request, initializes configurations, and determines response based on operation type.
	 * Handles both POST and GET requests differently based on the decision operation flag.
	 * @param {Request} request - The incoming request object.
	 * @param {Object} env - The environment configuration.
	 * @param {Object} ctx - Context for execution.
	 * @returns {Promise<Object>} - A promise that resolves to an object containing the response and any CDN experiment settings.
	 */
	async processRequest(request, env, ctx) {
		this.eventListeners = EventListeners.getInstance();
		this.logger.info('Entering processRequest [coreLogic.js]');
		try {
			let reqResponse;
			this.env = this.abstractionHelper.env;
			this.ctx = this.abstractionHelper.ctx;
			this.request = this.abstractionHelper.abstractRequest.request;
			// Initialize request configuration and check operation type
			const requestConfig = new RequestConfig(
				this.request,
				this.env,
				this.ctx,
				this.cdnAdapter,
				this.abstractionHelper
			);
			this.logger.debug('RequestConfig initialized');
			await requestConfig.initialize(request);
			// this.logger.debugExt('RequestConfig: ', requestConfig);
			this.requestConfig = requestConfig;

			// Get the pathname and check if it starts with "//"
			this.pathName = requestConfig.url.pathname.toLowerCase();
			this.href = requestConfig.url.href.toLowerCase();
			if (this.pathName.startsWith('//')) {
				this.pathName = this.pathName.substring(1);
			}

			// Check the operation type
			const isDecideOperation = this.getIsDecideOperation(this.pathName);
			this.logger.debug(`Is Decide Operation: ${isDecideOperation}`);
			this.datafileOperation = this.pathName === '/v1/datafile';
			this.configOperation = this.pathName === '/v1/config';
			this.httpMethod = request.method;
			this.isPostMethod = this.httpMethod === 'POST';
			this.isGetMethod = this.httpMethod === 'GET';

			// Clone the request
			// this.request = this.abstractionHelper.abstractRequest.cloneRequest(request);

			// Get visitor ID, datafile, and user agent
			const visitorId = await this.getVisitorId(request, requestConfig);
			const datafile = await this.retrieveDatafile(requestConfig, env);
			const userAgent = requestConfig.getHeader('User-Agent');

			// Initialize Optimizely with the retrieved datafile
			const initSuccess = await this.initializeOptimizely(datafile, visitorId, requestConfig, userAgent);
			if (!initSuccess) throw new Error('Failed to initialize Optimizely');

			this.eventListenersResult = await this.eventListeners.trigger(
				'beforeDetermineFlagsToDecide',
				request,
				requestConfig
			);
			// Process decision flags if required
			let flagsToForce, filteredFlagsToDecide, validStoredDecisions;
			if (isDecideOperation) {
				({ flagsToForce, filteredFlagsToDecide, validStoredDecisions } = await this.determineFlagsToDecide(
					requestConfig
				));
				this.logger.debugExt(
					'Flags to decide:',
					filteredFlagsToDecide,
					'Flags to force:',
					flagsToForce,
					'Valid stored decisions:',
					validStoredDecisions
				);
			}
			this.eventListenersResult = await this.eventListeners.trigger(
				'afterDetermineFlagsToDecide',
				request,
				requestConfig,
				flagsToForce,
				filteredFlagsToDecide,
				validStoredDecisions
			);

			// Execute Optimizely logic and prepare responses based on the request method
			this.logger.debug('Executing Optimizely logic and preparing responses based on the request method');
			const optlyResponse = await this.optimizelyExecute(filteredFlagsToDecide, flagsToForce, requestConfig);
			this.logger.debug(`Optimizely processing completed [optimizelyExecute]`);
			this.logger.debugExt('Optimizely response: ', optlyResponse);

			// Prepare the response based on the operation type
			if (this.shouldReturnJsonResponse(this) && !isDecideOperation) {
				// Datafile or config operation
				reqResponse = await this.cdnAdapter.getNewResponseObject(optlyResponse, 'application/json', true);
				this.reqResponseObjectType = 'response';
			} else if (this.isPostMethod && !isDecideOperation) {
				// POST method without decide operation
				reqResponse = await this.cdnAdapter.getNewResponseObject(optlyResponse, 'application/json', true);
				this.cdnExperimentSettings = undefined;
				this.reqResponseObjectType = 'response';
			} else if (this.isDecideOperation) {
				// Update metadata if enabled
				if (isDecideOperation) this.updateMetadata(requestConfig, flagsToForce, validStoredDecisions);
				// Look for a matching configuration in the cdnVariationSettings variable since this is a GET request
				if (this.isGetMethod && isDecideOperation)
					this.cdnExperimentSettings = await this.findMatchingConfig(
						request.url,
						optlyResponse,
						defaultSettings.urlIgnoreQueryParameters
					);

				if (this.isGetMethod && isDecideOperation && !this.cdnExperimentSettings) {
					reqResponse = "NO_MATCH";
				} else {
					// Prepare decisions and final response
					this.serializedDecisions = await this.prepareDecisions(
						optlyResponse,
						flagsToForce,
						validStoredDecisions,
						requestConfig
					);
					reqResponse = await this.prepareFinalResponse(
						this.allDecisions,
						visitorId,
						requestConfig,
						this.serializedDecisions
					);
				}
			}

			// Package the final response
			return {
				reqResponse,
				cdnExperimentSettings: this.cdnExperimentSettings,
				reqResponseObjectType: this.reqResponseObjectType,
				forwardRequestToOrigin: this.forwardRequestToOrigin,

				errorMessage: undefined,
				isError: false,
				isPostMethod: this.isPostMethod,
				isGetMethod: this.isGetMethod,
				isDecideOperation: this.isDecideOperation,
				isDatafileOperation: this.datafileOperation,
				isConfigOperation: this.configOperation,
				flagsToDecide: filteredFlagsToDecide,
				flagsToForce: flagsToForce,
				validStoredDecisions: validStoredDecisions,
				href: this.href,
				pathName: this.pathName,
			};
		} catch (error) {
			// Handle any errors during the process, returning a server error response
			this.logger.error('Error processing request:', error);
			return {
				reqResponse: await this.cdnAdapter.getNewResponseObject(
					`Internal Server Error: ${error.message}`,
					'text/html',
					false,
					500
				),
				cdnExperimentSettings: undefined,
				reqResponseObjectType: 'response',
				forwardRequestToOrigin: this.forwardRequestToOrigin,
				errorMessage: error.message,
				isError: true,
			};
		}
	}

	shouldReturnJsonResponse() {
		return (
			(this.datafileOperation || this.configOperation || this.trackOperation || this.sendOdpEventOperation) &&
			!this.isDecideOperation
		);
	}

	/**
	 * Handles POST decisions based on the request URL path.
	 * @param {string[]} flagsToDecide - An array of flags to decide.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @returns {Promise<Object|null>} - The decisions object or null.
	 */
	async handlePostOperations(flagsToDecide, flagsToForce, requestConfig) {
		switch (this.pathName) {
			case '/v1/decide':
				this.eventListenersResult = await this.eventListeners.trigger(
					'beforeDecide',
					this.request,
					requestConfig,
					flagsToDecide,
					flagsToForce
				);
				this.logger.debug('POST operation [/v1/decide]: Decide');
				let result = await this.optimizelyProvider.decide(flagsToDecide, flagsToForce, requestConfig.forcedDecisions);
				this.eventListenersResult = await this.eventListeners.trigger(
					'afterDecide',
					this.request,
					requestConfig,
					result
				);
				return result;
			case '/v1/track':
				this.logger.debug('POST operation [/v1/track]: Track');
				this.trackOperation = true;
				if (requestConfig.eventKey && typeof requestConfig.eventKey === 'string') {
					let result = await this.optimizelyProvider.track(
						requestConfig.eventKey,
						requestConfig.attributes,
						requestConfig.eventTags
					);
					if (!result) {
						result = {
							message: 'Conversion event was dispatched to Optimizely.',
							attributes: requestConfig.attributes,
							eventTags: requestConfig.eventTags,
							status: 200,
						};
						return result;
					}
					result = {
						message: 'An unknown error has occurred.',
						status: 500,
					};
					return result;
				} else {
					return await this.cdnAdapter.getNewResponseObject(
						'Invalid or missing event key. An event key is required for tracking conversions.',
						'text/html',
						false,
						400
					);
				}
			case '/v1/datafile':
				this.logger.debug('POST operation [/v1/datafile]: Datafile');
				const datafileObj = await this.optimizelyProvider.datafile();
				this.datafileOperation = true;
				if (requestConfig.enableResponseMetadata) {
					return { datafile: datafileObj, metadata: requestConfig.configMetadata };
				}
				return datafileObj;
			case '/v1/config':
				this.logger.debug('POST operation [/v1/config]: Config');
				const configObj = await this.optimizelyProvider.config();
				this.configOperation = true;
				if (requestConfig.enableResponseMetadata) {
					return { config: configObj, metadata: requestConfig.configMetadata };
				}
				return { config: configObj };
			case '/v1/batch':
				this.logger.debug('POST operation [/v1/batch]: Batch');
				await this.optimizelyProvider.batch();
				this.batchOperation = true;
				return null;
			case '/v1/send-odp-event':
				this.logger.debug('POST operation [/v1/send-odp-event]: Send ODP Event');
				await this.optimizelyProvider.sendOdpEvent();
				this.sendOdpEventOperation = true;
				return null;
			default:
				throw new Error(`URL Endpoint Not Found: ${this.pathName}`);
		}
	}

	/**
	 * Executes decisions for the flags.
	 * @param {string[]} flagsToDecide - An array of flags to decide.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @returns {Promise<Object>} - The decisions object.
	 */
	async optimizelyExecute(flagsToDecide, flagsToForce, requestConfig) {
		if (this.httpMethod === 'POST' || this.datafileOperation || this.configOperation) {
			this.logger.debug('Handling POST operations [handlePostOperations]');
			return await this.handlePostOperations(flagsToDecide, flagsToForce, requestConfig);
		} else {
			this.logger.debug('Handling GET operations [optimizelyExecute]');
			return await this.optimizelyProvider.decide(flagsToDecide, flagsToForce);
		}
	}

	/**
	 * Retrieves the Optimizely datafile from KV storage or CDN based on configuration.
	 * This function attempts to retrieve the datafile first from KV storage if enabled, and falls back to CDN if not found or not enabled.
	 *
	 * @param {Object} requestConfig - Configuration object containing settings and metadata for retrieval.
	 * @param {Object} env - The environment object, typically including access to storage and other resources.
	 * @returns {Promise<string>} A promise that resolves to the datafile string, or throws an error if unable to retrieve.
	 */
	async retrieveDatafile(requestConfig, env) {
		this.logger.debug('Retrieving datafile [retrieveDatafile]');
		try {
			// Prioritize KV storage if enabled in settings
			if (requestConfig.datafileFromKV) {
				const datafile = await this.cdnAdapter.getDatafileFromKV(requestConfig.sdkKey, this.kvStore);
				if (datafile) {
					this.logger.debug('Datafile retrieved from KV storage');
					if (requestConfig.enableResponseMetadata) {
						requestConfig.configMetadata.datafileFrom = 'KV Storage';
					}
					return datafile;
				}
				this.logger.error('Datafile not found in KV Storage; falling back to CDN.');
			}

			// Fallback to CDN if KV storage is not enabled or datafile is not found
			const datafileFromCDN = await this.cdnAdapter.getDatafile(requestConfig.sdkKey, 600);
			if (datafileFromCDN) {
				this.logger.debug('Datafile retrieved from CDN');
				if (requestConfig.enableResponseMetadata) {
					requestConfig.configMetadata.datafileFrom = 'CDN';
				}
				return datafileFromCDN;
			} else {
				this.logger.error(`Failed to retrieve datafile from CDN with sdkKey: ${requestConfig.sdkKey}`);
				throw new Error('Unable to retrieve the required datafile.');
			}
		} catch (error) {
			// Log and rethrow error to be handled by the caller
			this.logger.error('Error retrieving datafile:', error.message);
			throw new Error(`Datafile retrieval error: ${error.message}`);
		}
	}

	/**
	 * Initializes the Optimizely instance.
	 * @param {Object} datafile - The Optimizely datafile object.
	 * @param {string} visitorId - The visitor ID.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @param {string} userAgent - The user agent string.
	 * @returns {Promise<boolean>} - True if initialization was successful, false otherwise.
	 */
	async initializeOptimizely(datafile, visitorId, requestConfig, userAgent) {
		return await this.optimizelyProvider.initializeOptimizely(
			datafile,
			visitorId,
			requestConfig.decideOptions,
			requestConfig.attributes,
			requestConfig.eventTags,
			requestConfig.datafileAccessToken,
			userAgent,
			this.sdkKey
		);
	}

	getIsDecideOperation(pathName) {
		if (this.isDecideOperation !== undefined) return this.isDecideOperation;
		const result = !['/v1/config', '/v1/datafile', '/v1/track', '/v1/batch'].includes(pathName);
		this.isDecideOperation = result;
		return result;
	}

	/**
	 * Determines the flags to decide and handles stored decisions.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @returns {Promise<{flagsToDecide: string[], validStoredDecisions: Object[]}>}
	 */
	async determineFlagsToDecide(requestConfig) {
		this.logger.debug('Determining flags to decide [determineFlagsToDecide]');
		try {
			const flagKeys = (await this.retrieveFlagKeys(requestConfig)) || (await this.optimizelyProvider.getActiveFlags());
			const activeFlags = await this.optimizelyProvider.getActiveFlags();
			const isDecideOperation = this.getIsDecideOperation(this.pathName);

			if (!isDecideOperation) {
				return;
			}

			const decisions = await this.handleCookieDecisions(requestConfig, activeFlags, this.httpMethod);
			const { validStoredDecisions } = decisions;

			if (!isDecideOperation) return;

			const flagsToDecide = this.calculateFlagsToDecide(requestConfig, flagKeys, validStoredDecisions, activeFlags);

			// spread operator for returning { flagsToForce, filteredFlagsToDecide };
			return { ...flagsToDecide, validStoredDecisions };
		} catch (error) {
			this.logger.error('Error in determineFlagsToDecide:', error);
			throw error;
		}
	}

	/**
	 * Handle cookie-based decisions from request.
	 */
	async handleCookieDecisions(requestConfig, activeFlags, httpMethod) {
		this.logger.debug('Handling cookie decisions [handleCookieDecisions]');
		let savedCookieDecisions = [];
		let validStoredDecisions = [];
		let invalidCookieDecisions = [];
		if (httpMethod === 'POST') {
			return { savedCookieDecisions, validStoredDecisions, invalidCookieDecisions };
		}

		this.eventListenersResult = await this.eventListeners.trigger(
			'beforeReadingCookie',
			this.request,
			requestConfig.headerCookiesString
		);

		if (requestConfig.headerCookiesString && !this.isPostMethod) {
			try {
				const tempCookie = optlyHelper.getCookieValueByName(
					requestConfig.headerCookiesString,
					requestConfig.settings.decisionsCookieName
				);
				savedCookieDecisions = optlyHelper.deserializeDecisions(tempCookie);
				validStoredDecisions = optlyHelper.getValidCookieDecisions(savedCookieDecisions, activeFlags);
				invalidCookieDecisions = optlyHelper.getInvalidCookieDecisions(savedCookieDecisions, activeFlags);
			} catch (error) {
				this.logger.error('Error while handling stored cookie decisions:', error);
			}
		}

		this.eventListenersResult = await this.eventListeners.trigger(
			'afterReadingCookie',
			this.request,
			savedCookieDecisions,
			validStoredDecisions,
			invalidCookieDecisions
		);
		if (this.eventListenersResult) {
			savedCookieDecisions = this.eventListenersResult.savedCookieDecisions || savedCookieDecisions;
			validStoredDecisions = this.eventListenersResult.validStoredDecisions || validStoredDecisions;
			invalidCookieDecisions = this.eventListenersResult.invalidCookieDecisions || invalidCookieDecisions;
		}

		return { savedCookieDecisions, validStoredDecisions, invalidCookieDecisions };
	}

	/**
	 * Calculate flags to decide based on request config and stored decisions.
	 */
	calculateFlagsToDecide(requestConfig, flagKeys, validStoredDecisions, activeFlags) {
		this.logger.debug('Calculating flags to decide [calculateFlagsToDecide]');
		const validFlagKeySet = new Set(flagKeys);
		let flagsToForce = requestConfig.overrideVisitorId
			? []
			: validStoredDecisions.filter((decision) => validFlagKeySet.has(decision.flagKey));
		let filteredFlagsToDecide = flagKeys.filter((flag) => activeFlags.includes(flag));

		if (requestConfig.decideAll || (flagKeys.length === 0 && flagsToForce.length === 0)) {
			filteredFlagsToDecide = [...activeFlags];
		}

		return { flagsToForce, filteredFlagsToDecide };
	}

	/**
	 * Filters valid decisions from the result flags.
	 * @param {Object[]} validCookieDecisions - An array of valid stored decisions.
	 * @param {string[]} filteredFlagsToDecide - An array of flags that need a new decision.
	 * @param {boolean} isPostMethod - Whether the request method is POST.
	 * @returns {string[]} - An array of valid flags to decide.
	 */
	filterValidDecisions(validCookieDecisions, filteredFlagsToDecide, isPostMethod) {
		if (
			isPostMethod ||
			!optlyHelper.arrayIsValid(validCookieDecisions) ||
			!optlyHelper.arrayIsValid(filteredFlagsToDecide)
		) {
			return filteredFlagsToDecide;
		}

		const validFlagSet = new Set(validCookieDecisions.map((decision) => decision.flagKey));
		return filteredFlagsToDecide.filter((flag) => !validFlagSet.has(flag));
	}

	/**
	 * Updates the request configuration metadata.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @param {string[]} flagsToDecide - An array of flags to decide.
	 * @param {Object[]} validStoredDecisions - An array of valid stored decisions.
	 */
	updateMetadata(requestConfig, flagsToDecide, validStoredDecisions, cdnVariationSettings) {
		if (requestConfig.enableResponseMetadata) {
			requestConfig.configMetadata.flagKeysDecided = flagsToDecide;
			requestConfig.configMetadata.savedCookieDecisions = validStoredDecisions;
			requestConfig.configMetadata.agentServerMode = requestConfig.method === 'POST';
			requestConfig.configMetadata.pathName = requestConfig.url.pathname.toLowerCase();
			requestConfig.configMetadata.cdnVariationSettings = cdnVariationSettings;
		}
	}

	/**
	 * Prepares the decisions for the response.
	 * @param {Object[]} decisions - The decisions object array.
	 * @param {Object[]} flagsToForce - An array of stored flag keys and corresponding decisions that must be forced as user profile.
	 * @param {Object[]} validStoredDecisions - An array of valid stored decisions.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @returns {Promise<string|null>} - The serialized decisions string or null.
	 */
	async prepareDecisions(decisions, flagsToForce, validStoredDecisions, requestConfig) {
		this.logger.debug(`Preparing decisions for response with method: ${this.httpMethod}`);
		if (decisions) {
			this.allDecisions = optlyHelper.getSerializedArray(
				decisions,
				// flagsToForce,
				requestConfig.excludeVariables,
				requestConfig.includeReasons,
				requestConfig.enabledFlagsOnly,
				requestConfig.trimmedDecisions,
				this.httpMethod
			);
		}

		if (optlyHelper.arrayIsValid(this.allDecisions)) {
			// if (validStoredDecisions) this.allDecisions = this.allDecisions.concat(validStoredDecisions);
			let serializedDecisions = optlyHelper.serializeDecisions(this.allDecisions);
			if (serializedDecisions) {
				serializedDecisions = optlyHelper.safelyStringifyJSON(serializedDecisions);
			}
			this.logger.debugExt('Serialized decisions [prepareDecisions]: ', serializedDecisions);
			return serializedDecisions;
		}
		return null;
	}

	/**
	 * Retrieves flag keys from various sources based on request configuration.
	 * The method prioritizes KV storage, then URL query parameters, and lastly the request body for POST methods.
	 *
	 * @param {Object} requestConfig - Configuration object containing settings and metadata.
	 * @returns {Promise<Array>} - A promise that resolves to an array of flag keys.
	 */
	async retrieveFlagKeys(requestConfig) {
		this.logger.debug('Retrieving flag keys [retrieveFlagKeys]');
		try {
			let flagKeys = [];

			// Retrieve flags from KV storage if configured
			if (this.kvStore && (requestConfig.settings.flagsFromKV || requestConfig.enableFlagsFromKV)) {
				const flagsFromKV = await this.cdnAdapter.getFlagsFromKV(this.kvStore);
				if (flagsFromKV) {
					this.logger.debug('Flag keys retrieved from KV storage');
					flagKeys = await optlyHelper.splitAndTrimArray(flagsFromKV);
					if (requestConfig.enableResponseMetadata) {
						requestConfig.configMetadata.flagKeysFrom = 'KV Storage';
					}
				}
			}

			// Fallback to URL query parameters if no valid flags from KV
			if (!optlyHelper.arrayIsValid(flagKeys)) {
				flagKeys = requestConfig.flagKeys || [];
				this.logger.debug('Flag keys retrieved from URL query parameters');
				if (requestConfig.enableResponseMetadata && flagKeys.length > 0) {
					requestConfig.configMetadata.flagKeysFrom = 'Query Parameters';
				}
			}

			// Check for flag keys in request body if POST method and no valid flags from previous sources
			if (
				requestConfig.method === 'POST' &&
				!optlyHelper.arrayIsValid(flagKeys) &&
				requestConfig.body?.flagKeys?.length > 0
			) {
				flagKeys = await optlyHelper.trimStringArray(requestConfig.body.flagKeys);
				this.logger.debug('Flag keys retrieved from request body');
				if (requestConfig.enableResponseMetadata) {
					requestConfig.configMetadata.flagKeysFrom = 'Body';
				}
			}
			this.logger.debug(`Flag keys retrieved [retrieveFlagKeys]: ${flagKeys}`);
			return flagKeys;
		} catch (error) {
			this.logger.error('Error retrieving flag keys [retrieveFlagKeys]:', error);
			throw new Error(`Failed to retrieve flag keys: ${error.message}`);
		}
	}

	/**
	 * Retrieves the visitor ID from the request, cookie, or generates a new one.
	 * Additionally, tracks the source of the visitor ID and stores this information
	 * in the configuration metadata.
	 * @param {Request} request - The incoming request object.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @returns {Promise<string>} - The visitor ID.
	 */
	async getVisitorId(request, requestConfig) {
		this.logger.debug('Retrieving visitor ID [getVisitorId]');
		let visitorId = requestConfig.visitorId;
		let visitorIdSource = 'request-visitor'; // Default source

		if (requestConfig.overrideVisitorId) {
			this.logger.debug('Overriding visitor ID');
			const result = await this.overrideVisitorId(requestConfig);
			this.logger.debug(`Visitor ID overridden to: ${result}`);
			return result;
		}

		if (!visitorId) {
			[visitorId, visitorIdSource] = await this.retrieveOrGenerateVisitorId(request, requestConfig);
		}

		this.storeVisitorIdMetadata(requestConfig, visitorId, visitorIdSource);
		this.logger.debug(`Visitor ID retrieved: ${visitorId}`);
		return visitorId;
	}

	/**
	 * Overrides the visitor ID by generating a new UUID.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @returns {Promise<string>} - The new visitor ID.
	 */
	async overrideVisitorId(requestConfig) {
		const visitorId = await optlyHelper.generateUUID();
		requestConfig.configMetadata.visitorId = visitorId;
		requestConfig.configMetadata.visitorIdFrom = 'override-visitor';
		return visitorId;
	}

	/**
	 * Retrieves a visitor ID from a cookie or generates a new one if not found.
	 * @param {Request} request - The request object.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @returns {Promise<[string, string]>} - A tuple of the visitor ID and its source.
	 */
	async retrieveOrGenerateVisitorId(request, requestConfig) {
		let visitorId = this.cdnAdapter.getRequestCookie(request, requestConfig.settings.visitorIdCookieName);
		let visitorIdSource = visitorId ? 'cookie-visitor' : 'cdn-generated-visitor';

		if (!visitorId) {
			visitorId = await optlyHelper.generateUUID();
		}

		return [visitorId, visitorIdSource];
	}

	/**
	 * Stores visitor ID and its source in the configuration metadata if enabled.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @param {string} visitorId - The visitor ID.
	 * @param {string} visitorIdSource - The source from which the visitor ID was retrieved or generated.
	 */
	storeVisitorIdMetadata(requestConfig, visitorId, visitorIdSource) {
		if (requestConfig.enableResponseMetadata) {
			requestConfig.configMetadata.visitorId = visitorId;
			requestConfig.configMetadata.visitorIdFrom = visitorIdSource;
		}
	}

	/**
	 * Prepares the response object with decisions and headers/cookies.
	 * @param {Object|string} decisions - The decisions object or a string.
	 * @param {string} visitorId - The visitor ID.
	 * @param {string} serializedDecisions - The serialized decisions string.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @returns {Promise<Response>} - The response object.
	 */
	async prepareResponse(decisions, visitorId, serializedDecisions, requestConfig) {
		this.logger.debug('Preparing response [prepareResponse]');
		try {
			const isEmpty = Array.isArray(decisions) && decisions.length === 0;
			const responseDecisions = isEmpty ? 'NO_DECISIONS' : decisions;

			if (this.shouldForwardToOrigin()) {
				this.logger.debug('Forwarding request to origin [prepareResponse]');
				return this.handleOriginForwarding(visitorId, serializedDecisions, requestConfig);
			} else {
				this.logger.debug('Preparing local response [prepareResponse]');
				this.reqResponseObjectType = 'response';
				return this.prepareLocalResponse(responseDecisions, visitorId, serializedDecisions, requestConfig);
			}
		} catch (error) {
			this.logger.error('Error in prepareResponse:', error);
			throw error;
		}
	}

	/**
	 * Determines if the request should be forwarded to the origin based on configuration settings.
	 * @returns {boolean}
	 */
	shouldForwardToOrigin() {
		return (
			!this.isPostMethod &&
			this.cdnExperimentSettings &&
			this.cdnExperimentSettings.forwardRequestToOrigin &&
			this.getIsDecideOperation(this.pathName)
		);
	}

	/**
	 * Handles forwarding the request to the origin with the necessary headers and cookies.
	 * @param {string} visitorId - The visitor ID.
	 * @param {string} serializedDecisions - The serialized decisions string.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @returns {Promise<Response>} - The response from the origin.
	 */
	async handleOriginForwarding(visitorId, serializedDecisions, requestConfig) {
		this.logger.debug('Handling origin forwarding [handleOriginForwarding]');
		let clonedRequest;

		try {
			// Set request headers if configured
			if (requestConfig.setRequestHeaders) {
				const headers = {};

				if (visitorId) {
					headers[requestConfig.settings.visitorIdsHeaderName] = visitorId;
					this.cdnAdapter.headersToSetRequest[requestConfig.settings.visitorIdsHeaderName] = visitorId;
				}

				if (serializedDecisions) {
					headers[requestConfig.settings.decisionsHeaderName] = serializedDecisions;
					this.cdnAdapter.headersToSetRequest[requestConfig.settings.decisionsHeaderName] = serializedDecisions;
				}
				this.logger.debugExt('Setting request headers [handleOriginForwarding]:', headers);
				clonedRequest = this.cdnAdapter.setMultipleRequestHeaders(this.request, headers);
			}

			// Set request cookies if configured
			if (requestConfig.setRequestCookies) {
				const [visitorCookie, modReqCookie] = await Promise.all([
					optlyHelper.createCookie(requestConfig.settings.visitorIdCookieName, visitorId),
					optlyHelper.createCookie(requestConfig.settings.decisionsCookieName, serializedDecisions),
				]);

				// Ensure clonedRequest is defined or fallback to this.request
				clonedRequest = clonedRequest || (await this.cdnAdapter.cloneRequest(this.request));
				// Prepare the cookies object based on conditions
				let cookiesToSet = {};
				if (visitorCookie) {
					cookiesToSet['visitorCookie'] = visitorCookie;
					this.cdnAdapter.cookiesToSetRequest.push(visitorCookie);
				}

				if (modReqCookie) {
					cookiesToSet['modReqCookie'] = modReqCookie;
					this.cdnAdapter.cookiesToSetRequest.push(modReqCookie);
				}

				// Use the new function to set multiple cookies at once
				this.logger.debugExt('Setting request cookies [handleOriginForwarding]:', cookiesToSet);
				if (Object.keys(cookiesToSet).length > 0) {
					clonedRequest = this.cdnAdapter.setMultipleReqSerializedCookies(clonedRequest, cookiesToSet);
				}
			}

			// Forward the request to the origin
			const fetchResponse = await fetch(clonedRequest || this.request);
			this.reqResponseObjectType = 'response';
			return fetchResponse;
		} catch (error) {
			this.logger.error('Error in coreLogic.js [handleOriginForwarding]:', error);
			throw error;
		}
	}

	/**
	 * Handles forwarding the request to the origin while setting appropriate headers and cookies.
	 * @param {string} visitorId - The visitor ID.
	 * @param {string} serializedDecisions - The serialized decisions string.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @returns {Promise<Response>}
	 */
	async handleOriginForwarding(visitorId, serializedDecisions, requestConfig) {
		let clonedRequest = await this.setupRequestModification(visitorId, serializedDecisions, requestConfig);
		return clonedRequest || this.request;
	}

	/**
	 * Prepares a response when not forwarding to the origin, primarily for local decisioning.
	 * @param {Object|string} responseDecisions - Decisions to be included in the response.
	 * @param {string} visitorId - The visitor ID.
	 * @param {string} serializedDecisions - The serialized decisions string.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @returns {Promise<Response>}
	 */
	async prepareLocalResponse(responseDecisions, visitorId, serializedDecisions, requestConfig) {
		const jsonBody = {
			[requestConfig.settings.responseJsonKeyName]: requestConfig.trimmedDecisions
				? this.allDecisions
				: responseDecisions,
			...(requestConfig.enableResponseMetadata && { configMetadata: requestConfig.configMetadata }),
		};

		let fetchResponse = await this.cdnAdapter.getNewResponseObject(jsonBody, 'application/json', true);

		if (requestConfig.setResponseHeaders) {
			this.setResponseHeaders(fetchResponse, visitorId, serializedDecisions, requestConfig);
		}

		if (requestConfig.setResponseCookies) {
			await this.setResponseCookies(fetchResponse, visitorId, serializedDecisions, requestConfig);
		}

		return fetchResponse;
	}

	/**
	 * Sets response headers based on the provided visitor ID and serialized decisions.
	 * @param {Response} response - The response object to modify.
	 * @param {string} visitorId - The visitor ID.
	 * @param {string} serializedDecisions - The serialized decisions string.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 */
	setResponseHeaders(response, visitorId, serializedDecisions, requestConfig) {
		this.logger.debug('Setting response headers [setResponseHeaders]');
		if (visitorId) {
			// this.cdnAdapter.setResponseHeader(response, requestConfig.settings.visitorIdsHeaderName, visitorId);
			this.cdnAdapter.headersToSetResponse[requestConfig.settings.visitorIdsHeaderName] = visitorId;
			this.cdnAdapter.responseHeadersSet = true;
		}
		if (serializedDecisions) {
			// this.cdnAdapter.setResponseHeader(response, requestConfig.settings.decisionsHeaderName, serializedDecisions);
			this.cdnAdapter.headersToSetResponse[requestConfig.settings.decisionsHeaderName] = serializedDecisions;
			this.cdnAdapter.responseHeadersSet = true;
		}
	}

	/**
	 * Sets response cookies based on the provided visitor ID and serialized decisions.
	 * @param {Response} response - The response object to modify.
	 * @param {string} visitorId - The visitor ID.
	 * @param {string} serializedDecisions - The serialized decisions string.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @returns {Promise<void>}
	 */
	async setResponseCookies(response, visitorId, serializedDecisions, requestConfig) {
		this.logger.debug('Setting response cookies [setResponseCookies]');
		const [visitorCookie, modRespCookie] = await Promise.all([
			optlyHelper.createCookie(requestConfig.settings.visitorIdCookieName, visitorId),
			optlyHelper.createCookie(requestConfig.settings.decisionsCookieName, serializedDecisions),
		]);

		if (visitorCookie) {
			this.cdnAdapter.cookiesToSetResponse.push(visitorCookie);
		}
		if (modRespCookie) {
			this.cdnAdapter.cookiesToSetResponse.push(modRespCookie);
		}

		response = this.cdnAdapter.setMultipleRespSerializedCookies(response, this.cdnAdapter.cookiesToSetResponse);
		this.cdnAdapter.responseCookiesSet = true;
	}

	/**
	 * Prepares the final response object with decisions.
	 * @param {Object|string} decisions - The decisions object or a string.
	 * @param {string} visitorId - The visitor ID.
	 * @param {RequestConfig} requestConfig - The request configuration object.
	 * @returns {Promise<Response>} - The final response object.
	 */
	async prepareFinalResponse(decisions, visitorId, requestConfig, serializedDecisions) {
		return this.prepareResponse(decisions, visitorId, serializedDecisions, requestConfig);
	}
}
