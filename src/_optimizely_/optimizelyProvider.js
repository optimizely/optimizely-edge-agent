import * as optlyHelper from '../_helpers_/optimizelyHelper';
import Logger from '../_helpers_/logger';
import EventListeners from '../_event_listeners_/eventListeners';

import {
	createInstance,
	enums as OptimizelyEnums,
	OptimizelyDecideOption as optlyDecideOptions,
} from '@optimizely/optimizely-sdk/dist/optimizely.lite.min.js';

const CLOUDFLARE_CLIENT_ENGINE = 'javascript-sdk/cloudflare';

export default class OptimizelyProvider {
	constructor(request, env, ctx, requestConfig, abstractionHelper) {
		this.optimizelyClient = undefined;
		this.optimizelyUserContext = undefined;
		this.cdnAdapter = undefined;
		this.request = request;
		this.requestConfig = requestConfig;
		this.abstractionHelper = abstractionHelper;
		this.env = env;
		this.ctx = ctx;
	}

	/**
	 * Sets the CDN adapter.
	 * @param {Object} adapter - The CDN adapter to be used.
	 * @throws {TypeError} - Throws an error if the adapter is not an object.
	 */
	setCdnAdapter(adapter) {
		if (typeof adapter !== 'object' || adapter === null) {
			throw new TypeError('CDN adapter must be an object.');
		}
		this.cdnAdapter = adapter;
	}

	/**
	 * Gets the CDN adapter.
	 * @returns {Object} - The current CDN adapter.
	 * @throws {Error} - Throws an error if the CDN adapter has not been set.
	 */
	getCdnAdapter() {
		if (this.cdnAdapter === undefined) {
			throw new Error('CDN adapter has not been set.');
		}
		return this.cdnAdapter;
	}

	/**
	 * Validates the types of various parameters required for initializing Optimizely.
	 * @param {Object} attributes - Attributes to validate as a proper object.
	 * @param {Object} eventTags - Event tags to validate as a proper object.
	 * @param {Array} defaultDecideOptions - Options to validate as an array.
	 * @param {string} userAgent - User agent to validate as a string.
	 * @param {string} datafileAccessToken - Datafile access token to validate as a string.
	 * @throws {TypeError} - Throws a TypeError if any parameter does not match its expected type.
	 */
	validateParameters(attributes, eventTags, defaultDecideOptions, userAgent, datafileAccessToken) {
		if (typeof attributes !== 'object') {
			throw new TypeError('Attributes must be a valid object.');
		}
		if (typeof eventTags !== 'object') {
			throw new TypeError('Event tags must be a valid object.');
		}
		if (!Array.isArray(defaultDecideOptions)) {
			throw new TypeError('Default decide options must be an array.');
		}
		if (typeof userAgent !== 'string') {
			throw new TypeError('User agent must be a string.');
		}
		if (datafileAccessToken && typeof datafileAccessToken !== 'string') {
			throw new TypeError('Datafile access token must be a string.');
		}
	}

	/**
	 * Initializes the Optimizely client with provided configuration.
	 * Catches and rethrows any errors encountered during the initialization process.
	 *
	 * @param {Object} datafile - The Optimizely datafile.
	 * @param {string} visitorId - Unique identifier for the visitor.
	 * @param {string[]} [defaultDecideOptions=[]] - Default decision options for the Optimizely decide API.
	 * @param {Object} [attributes={}] - User attributes for targeted decision making.
	 * @param {Object} [eventTags={}] - Tags to be used for the event.
	 * @param {string} [datafileAccessToken=""] - Access token for the datafile (optional).
	 * @param {string} [userAgent=""] - User agent string of the client, used in attributes fetching.
	 * @returns {Promise<boolean>} - True if initialization is successful.
	 * @throws {Error} - Propagates any errors encountered.
	 */
	async initializeOptimizely(
		datafile,
		visitorId,
		defaultDecideOptions = [],
		attributes = {},
		eventTags = {},
		datafileAccessToken = '',
		userAgent = ''
	) {
		try {
			this.validateParameters(attributes, eventTags, defaultDecideOptions, userAgent, datafileAccessToken);

			if (!datafile) {
				throw new Error('Datafile must be provided.');
			}
			if (!visitorId) {
				throw new Error('Visitor ID must be provided.');
			}

			const params = this.buildInitParameters(datafile, datafileAccessToken, defaultDecideOptions);
			attributes = await this.getAttributes(attributes, userAgent);

			this.optimizelyClient = createInstance(params);
			this.optimizelyUserContext = this.optimizelyClient.createUserContext(visitorId, attributes);

			return true;
		} catch (error) {
			console.error('Error initializing Optimizely:', error);
			throw error; // Rethrow the error for further handling
		}
	}

	/**
	 * Constructs the custom event dispatcher if decision events are not disabled.
	 * This dispatcher integrates with Cloudflare's Worker environment.
	 * @param {Array<string>} decideOptions - Array of decision options to check for disabling events.
	 * @param {Object} ctx - The context object provided by the Cloudflare Worker runtime.
	 * @returns {Object|null} - Custom event dispatcher or null if disabled.
	 */
	createEventDispatcher(decideOptions, ctx) {
		if (decideOptions.includes('DISABLE_DECISION_EVENT')) {
			return null; // Disable the event dispatcher if specified in decide options.
		}
		return {
			dispatchEvent: (optimizelyEvent) => {
				try {
					this.cdnAdapter.dispatchEventToOptimizely(optimizelyEvent).catch((err) => {
						console.error('Failed to dispatch event:', err);
					});
				} catch (error) {
					console.error('Error in custom event dispatcher:', error);
				}
			},
		};
	}

	/**
	 * Builds the initialization parameters for the Optimizely client.
	 * @param {Object} datafile - The Optimizely datafile.
	 * @param {string} [datafileAccessToken] - The datafile access token.
	 * @param {string[]} [defaultDecideOptions=[]] - The default decision options.
	 * @returns {Object} - The initialization parameters with a custom event dispatcher if applicable.
	 */
	buildInitParameters(datafile, datafileAccessToken, defaultDecideOptions = []) {
		const params = {
			datafile,
			logLevel: OptimizelyEnums.LOG_LEVEL.ERROR,
			clientEngine: CLOUDFLARE_CLIENT_ENGINE,
			eventDispatcher: this.createEventDispatcher(defaultDecideOptions), // Add custom event dispatcher
		};

		if (defaultDecideOptions.length > 0) {
			params.defaultDecideOptions = this.buildDecideOptions(defaultDecideOptions);
		}

		if (datafileAccessToken) {
			params.access_token = datafileAccessToken;
		}

		return params;
	}

	/**
	 * Retrieves the user attributes.
	 * @param {Object} attributes - The user attributes.
	 * @param {string} [userAgent] - The user agent string.
	 * @returns {Promise<Object>} - A promise that resolves to the user attributes.
	 */
	async getAttributes(attributes = {}, userAgent) {
		let result = {};

		if (attributes) {
			result = attributes;
		}

		if (userAgent) {
			result['$opt_user_agent'] = userAgent;
			return attributes;
		}
	}

	/**
	 * Builds the decision options for the Optimizely client.
	 * @param {string[]} decideOptions - The decision options.
	 * @returns {OptimizelyDecideOption[]} - The built decision options.
	 */
	buildDecideOptions(decideOptions) {
		return decideOptions.map((option) => optlyDecideOptions[option]);
	}

	/**
	 * Retrieves the active feature flags.
	 * @returns {Promise<string[]>} - A promise that resolves to an array of active feature flag keys.
	 */ d;
	async getActiveFlags() {
		if (!this.optimizelyClient) {
			throw new Error('Optimizely Client is not initialized.');
		}

		const config = await this.optimizelyClient.getOptimizelyConfig();
		return Object.keys(config.featuresMap);
	}

	/**
	 * Makes a decision for the specified feature flag keys.
	 * @param {string[]} flagKeys - The feature flag keys.
	 * @param {Object[]} flagsToForce - Flags for forced decisions, as in the user profile based on the cookie stored decisions
	 * @param {string[]} forcedDecisionKeys - The keys for forced decisionsd.
	 * @returns {Promise<Object[]>} - A promise that resolves to an array of decision objects.
	 */
	async decide(flagKeys, flagsToForce, forcedDecisionKeys = []) {
		const decisions = [];
		let forcedDecisions = [];

		// Validate the arrays using optlyHelper.ArrayIsValid()
		const isFlagsToForceValid = optlyHelper.arrayIsValid(flagsToForce);
		const isForcedDecisionKeysValid = optlyHelper.arrayIsValid(forcedDecisionKeys);

		// Assign forcedDecisions based on validation results
		if (isFlagsToForceValid && isForcedDecisionKeysValid) {
			forcedDecisions = [...flagsToForce, ...forcedDecisionKeys];
		} else if (isFlagsToForceValid) {
			forcedDecisions = flagsToForce;
		} else if (isForcedDecisionKeysValid) {
			forcedDecisions = forcedDecisionKeys;
		} // If both are invalid, forcedDecisions remains an empty array

		// Process non-forced decisions
		for (const flagKey of flagKeys) {
			if (!this.isForcedDecision(flagKey, forcedDecisions)) {
				const decision = this.optimizelyUserContext.decide(flagKey);
				if (decision) {
					decisions.push(decision);
				}
			}
		}

		// Process forced decisions
		for (const forcedDecision of forcedDecisions) {
			const decision = await this.getDecisionForFlag(forcedDecision, true);
			if (decision) {
				decisions.push(decision);
			}
		}

		return decisions;
	}

	/**
	 * Checks if a flag key has a forced decision.
	 * @param {string} flagKey - The flag key.
	 * @param {Object[]} forcedDecisions - The forced decisions.
	 * @returns {boolean} - True if the flag key has a forced decision, false otherwise.
	 */
	isForcedDecision(flagKey, forcedDecisions) {
		return forcedDecisions.some((decision) => decision.flagKey === flagKey);
	}

	/**
	 * Retrieves the decision for a flag.
	 * @param {Object} flagObj - The flag object.
	 * @param {boolean} [doForceDecision=false] - Whether to force the decision.
	 * @returns {Promise<Object>} - A promise that resolves to the decision object.
	 */
	async getDecisionForFlag(flagObj, doForceDecision = false) {
		if (doForceDecision) {
			this.optimizelyUserContext.setForcedDecision(
				{ flagKey: flagObj.flagKey, ruleKey: flagObj.ruleKey },
				{ variationKey: flagObj.variationKey }
			);
		}

		return await this.optimizelyUserContext.decide(flagObj.flagKey);
	}

	/**
	 * Tracks an event.
	 * @param {string} eventKey - The event key.
	 * @param {Object} [attributes={}] - The event attributes.
	 * @param {Object} [eventTags={}] - The event tags.
	 * @returns {Promise<Object>} - A promise that resolves to the tracking result.
	 */
	async track(eventKey, attributes = {}, eventTags = {}) {
		return this.optimizelyUserContext.trackEvent(eventKey, attributes, eventTags);
	}

	/**
	 * Retrieves the Optimizely datafile.
	 * @returns {Promise<Object>} - A promise that resolves to the datafile.
	 */
	async datafile() {
		return optlyHelper.jsonParseSafe(this.optimizelyClient.getOptimizelyConfig().getDatafile());
	}

	/**
	 * Retrieves the Optimizely configuration.
	 * @returns {Promise<Object>} - A promise that resolves to the Optimizely configuration.
	 */
	async config() {
		return this.optimizelyClient.getOptimizelyConfig();
	}
}
