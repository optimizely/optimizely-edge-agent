/**
 * @module OptimizelyProvider
 */

import * as optlyHelper from '../_helpers_/optimizelyHelper';
import { logger } from '../_helpers_/optimizelyHelper';
// import EventListeners from '../_event_listeners_/eventListeners';
import defaultSettings from '../_config_/defaultSettings';
import UserProfileService from './userProfileService';

import {
	createInstance,
	enums as OptimizelyEnums,
	OptimizelyDecideOption as optlyDecideOptions,
} from '@optimizely/optimizely-sdk/dist/optimizely.lite.min.js';

// Global variables to store the SDK key and the Optimizely client. These are used to make sure that the
// same Optimizely client is used across multiple instances of the OptimizelyProvider class, and only one instance
// of the Optimizely client is created for each SDK key.
let globalSdkKey = undefined;
let globalOptimizelyClient = undefined;
let globalKVStore = undefined;
let globalKVStoreUserProfile = undefined;

// const userProfileService = {
// 	// Adapter that provides helpers to read and write from KV Store
// 	UPS_LS_PREFIX: 'optly-ups-data',
// 	kvStorageAdapter: {
// 	  read: async function(key) {
// 		let userProfileData = await kvStore.get(key);
// 		if (userProfileData) {
// 			userProfileData = JSON.parse(userProfileData);
// 			return optlyHelper.isValidObject(userProfileData, true);
// 		}
// 		return {};
// 	  },
// 	  write: async function(key, data) {
// 		let userProfileData = optlyHelper.isValidObject(data, true);
// 		await kvStore.put(key, JSON.stringify(userProfileData));
// 	  },
// 	},
// 	getUserKey: function (userId) {
// 	  return `${this.UPS_LS_PREFIX}-${userId}`;
// 	},
// 	// Perform user profile lookup
// 	lookup: function(userId) {
// 	  return this.kvStorageAdapter.read(this.getUserKey(userId));
// 	},
// 	// Persist user profile
// 	save: async function(userProfileMap) {
// 	  const userKey = this.getUserKey(userProfileMap.user_id);
// 	  await this.kvStorageAdapter.write(userKey, userProfileMap);
// 	},
//   };

/**
 * The OptimizelyProvider class is a class that provides a common interface for handling Optimizely operations.
 * It is designed to be extended by other classes to provide specific implementations for handling Optimizely operations.
 * It implements the following methods:
 * - constructor(request, env, ctx, requestConfig, abstractionHelper) - Initializes the OptimizelyProvider instance with the
 *   request, environment, context, requestConfig, and abstractionHelper objects.
 * - setCdnAdapter(adapter) - Sets the CDN adapter.
 * - getCdnAdapter() - Gets the CDN adapter.
 * - validateParameters(attributes, eventTags, defaultDecideOptions, userAgent, datafileAccessToken) - Validates the types of
 *   various parameters required for initializing Optimizely.
 * - initializeOptimizely(datafile, visitorId, defaultDecideOptions, attributes, eventTags, datafileAccessToken, userAgent)
 *   Initializes the Optimizely client with provided configuration.
 * - createEventDispatcher(decideOptions, ctx) - Constructs the custom event dispatcher if decision events are not disabled.
 * - buildInitParameters(datafile, datafileAccessToken, defaultDecideOptions) - Builds the initialization parameters for the Optimizely client.
 * - getAttributes(attributes, userAgent) - Retrieves the user attributes.
 * - buildDecideOptions(decideOptions) - Builds the decision options for the Optimizely client.
 * - getActiveFlags() - Retrieves the active feature flags.
 * - decide(flagKeys, flagsToForce, forcedDecisionKeys) - Makes a decision for the specified feature flag keys.
 * - isForcedDecision(flagKey, forcedDecisions) - Checks if a flag key must be handled as a forced decision.
 * - getDecisionForFlag(flagObj, doForceDecision) - Retrieves the decision for a flag.
 * - track(eventKey, attributes, eventTags) - Tracks an event.
 * - datafile() - Retrieves the Optimizely datafile.
 * - config() - Retrieves the Optimizely configuration.
 */
export default class OptimizelyProvider {
	constructor(request, env, ctx, requestConfig, abstractionHelper, kvStoreUserProfile) {
		logger().debug('Initializing OptimizelyProvider');
		this.visitorId = undefined;
		this.optimizelyClient = undefined;
		this.optimizelyUserContext = undefined;
		this.cdnAdapter = undefined;
		this.request = request;
		this.httpMethod = abstractionHelper.abstractRequest.method;
		this.requestConfig = requestConfig;
		this.abstractionHelper = abstractionHelper;
		this.kvStoreUserProfile = kvStoreUserProfile;
		this.kvStoreUserProfileEnabled = kvStoreUserProfile ? true : false;
		this.env = env;
		this.ctx = ctx;
		this.abstractContext = abstractionHelper.abstractContext;
		globalKVStore = kvStoreUserProfile;
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
		logger().debug('Validating Optimizely client parameters [validateParameters]');
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
	 * @param {string} [sdkKey=""] - The datafile SDK key.
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
		userAgent = '',
		sdkKey = '',
	) {
		logger().debug('Initializing Optimizely [initializeOptimizely]');
		this.visitorId = visitorId;

		try {
			this.validateParameters(attributes, eventTags, defaultDecideOptions, userAgent, datafileAccessToken);

			if (!datafile) {
				throw new Error('Datafile must be provided.');
			}
			if (!visitorId) {
				throw new Error('Visitor ID must be provided.');
			}

			if (globalSdkKey !== sdkKey) {
				// Create and / or assign the global KV Storage User Profile Service
				globalKVStoreUserProfile = this.kvStoreUserProfileEnabled
					? globalKVStoreUserProfile || new UserProfileService(this.kvStoreUserProfile, sdkKey)
					: null;

				logger().debug(
					'Creating new Optimizely client [initializeOptimizely] - new sdkKey: ',
					sdkKey,
					' - previous sdkKey: ',
					globalSdkKey,
				);
				const params = this.buildInitParameters(
					datafile,
					datafileAccessToken,
					defaultDecideOptions,
					visitorId,
					globalKVStoreUserProfile,
				);
				globalOptimizelyClient = createInstance(params);
				globalSdkKey = sdkKey;
			} else {
				logger().debug('Reusing existing Optimizely client [initializeOptimizely] - sdkKey: ', sdkKey);
			}

			if (this.kvStoreUserProfileEnabled) {
				// Prefetch user profiles for anticipated user(s)
				if (globalKVStoreUserProfile) {
					await globalKVStoreUserProfile.prefetchUserProfiles([visitorId]);
				}
			}

			this.optimizelyClient = globalOptimizelyClient;
			attributes = await this.getAttributes(attributes, userAgent);
			logger().debug('Creating Optimizely user context [initializeOptimizely]');
			this.optimizelyUserContext = this.optimizelyClient.createUserContext(visitorId, attributes);

			return true;
		} catch (error) {
			logger().error('Error initializing Optimizely:', error);
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
		logger().debug('Creating event dispatcher [createEventDispatcher]');
		if (decideOptions.includes('DISABLE_DECISION_EVENT')) {
			logger().debug('Event dispatcher disabled [createEventDispatcher]');
			return null; // Disable the event dispatcher if specified in decide options.
		}
		return {
			dispatchEvent: (optimizelyEvent) => {
				try {
					this.cdnAdapter.dispatchEventToOptimizely(optimizelyEvent).catch((err) => {
						logger().error('Failed to dispatch event:', err);
					});
				} catch (error) {
					logger().error('Error in custom event dispatcher:', error);
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
	buildInitParameters(datafile, datafileAccessToken, defaultDecideOptions = [], visitorId, globalUserProfile) {
		let userProfileService;
		if (this.kvStoreUserProfileEnabled) {
			userProfileService = {
				lookup: (visitorId) => {
					const userProfile = globalUserProfile.getUserProfileSync(visitorId);
					if (userProfile) {
						return userProfile;
					} else {
						throw new Error('User profile not found in cache');
					}
				},
				save: (userProfileMap) => {
					globalUserProfile.saveSync(userProfileMap, this.abstractContext);
				},
			};
		} else {
			userProfileService = {};
		}

		logger().debug('Building initialization parameters [buildInitParameters]');
		const params = {
			datafile,
			logLevel: OptimizelyEnums.LOG_LEVEL.ERROR,
			clientEngine: defaultSettings.optlyClientEngine,
			clientVersion: defaultSettings.optlyClientEngineVersion,
			eventDispatcher: this.createEventDispatcher(defaultDecideOptions),
			userProfileService,
		};

		if (defaultDecideOptions.length > 0) {
			params.defaultDecideOptions = this.buildDecideOptions(defaultDecideOptions);
		}

		if (datafileAccessToken) {
			params.access_token = datafileAccessToken;
		}

		logger().debugExt('Initialization parameters built [buildInitParameters]: ', params);
		return params;
	}

	/**
	 * Retrieves the user attributes.
	 * @param {Object} attributes - The user attributes.
	 * @param {string} [userAgent] - The user agent string.
	 * @returns {Promise<Object>} - A promise that resolves to the user attributes.
	 */
	async getAttributes(attributes = {}, userAgent) {
		logger().debug('Retrieving user attributes [getAttributes]');
		let result = {};

		if (attributes) {
			result = attributes;
		}

		if (userAgent) {
			result['$opt_user_agent'] = userAgent;
		}

		logger().debugExt('User attributes retrieved [getAttributes]: ', result);
		return result;
	}

	/**
	 * Builds the decision options for the Optimizely client.
	 * @param {string[]} decideOptions - The decision options.
	 * @returns {OptimizelyDecideOption[]} - The built decision options.
	 */
	buildDecideOptions(decideOptions) {
		const result = decideOptions.map((option) => optlyDecideOptions[option]);
		logger().debugExt('Decide options built [buildDecideOptions]: ', result);
		return result;
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
		const result = Object.keys(config.featuresMap);
		logger().debugExt('Active feature flags retrieved [getActiveFlags]: ', result);
		return result;
	}

	/**
	 * Makes a decision for the specified feature flag keys.
	 * @param {string[]} flagKeys - The feature flag keys.
	 * @param {Object[]} flagsToForce - Flags for forced decisions, as in the user profile based on the cookie stored decisions
	 * @param {string[]} forcedDecisionKeys - The keys for forced decisionsd.
	 * @returns {Promise<Object[]>} - A promise that resolves to an array of decision objects.
	 */
	async decide(flagKeys, flagsToForce, forcedDecisionKeys = []) {
		logger().debug('Executing Optimizely decide operation in OptimizelyProvider [decide]');
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

		logger().debugExt('Processing non-forced decisions [decide]: ', flagKeys);
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
		logger().debugExt('Processing forced decisions [decide]: ', forcedDecisions);
		for (const forcedDecision of forcedDecisions) {
			const decision = await this.getDecisionForFlag(forcedDecision, true);
			if (decision) {
				decisions.push(decision);
			}
		}

		logger().debugExt('Decisions made [decide]: ', decisions);

		if (this.kvStoreUserProfileEnabled && this.kvStoreUserProfile) {
			const { key, userProfileMap } = await globalKVStoreUserProfile.getUserProfileFromCache(this.visitorId);
			const resultJSON = optlyHelper.safelyStringifyJSON(userProfileMap);
			logger().debugExt(
				'Retrieved user profile data for visitor [decide -> saveToKVStorage] - key:',
				key,
				'user profile map:',
				userProfileMap,
			);
			await globalKVStoreUserProfile.saveToKVStorage(key, resultJSON);
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
				{ variationKey: flagObj.variationKey },
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
		logger().debug(
			'Tracking an event [track]:',
			'Event Key:',
			eventKey,
			'Attributes:',
			attributes,
			'Event Tags:',
			eventTags,
		);
		const result = this.optimizelyUserContext.trackEvent(eventKey, attributes, eventTags);
		return result;
	}

	/**
	 * Retrieves the Optimizely datafile.
	 * @returns {Promise<Object>} - A promise that resolves to the datafile.
	 */
	async datafile() {
		logger().debug('Retrieving datafile from the Optimizely Client [OptimizelyProvider -> datafile]');
		return optlyHelper.safelyParseJSON(this.optimizelyClient.getOptimizelyConfig().getDatafile());
	}

	/**
	 * Retrieves the Optimizely configuration.
	 * @returns {Promise<Object>} - A promise that resolves to the Optimizely configuration.
	 */
	async config() {
		logger().debug('Retrieving config in OptimizelyProvider [config]');
		return this.optimizelyClient.getOptimizelyConfig();
	}

	/**
	 * Sends an ODP (Optimizely Data Platform) event.
	 * @param {string} eventType - The type of the event.
	 * @param {Object} [eventData={}] - The data associated with the event.
	 * @returns {Promise<void>} - A promise that resolves when the event is sent.
	 * @throws {Error} - Throws an error if the Optimizely client or user context is not initialized.
	 */
	async sendOdpEvent(odpEvent = {}) {
		logger().debug('Sending ODP event [sendOdpEvent]:', 'Event Type:', eventType, 'Event Data:', eventData);

		if (!this.optimizelyClient || !this.optimizelyUserContext) {
			throw new Error('Optimizely Client or User Context is not initialized.');
		}

		try {
			// TODO: Implement the method sendOdpEvent
			logger().debug('ODP event sent successfully [sendOdpEvent]:', '');
		} catch (error) {
			logger().error('Error sending ODP event [sendOdpEvent]:', error);
			throw error;
		}
	}

	/**
	 * Batches multiple events to be sent together.
	 * @returns {Promise<void>} - A promise that resolves when the batch is processed.
	 * @throws {Error} - Throws an error if the Optimizely client is not initialized.
	 */
	async batch(batchOperations) {
		logger().debug('Executing Optimizely batch operation in OptimizelyProvider [batch]');

		try {
			// TODO: Implement the method  batch
			logger().debug('Batch operation completed successfully [batch]');
		} catch (error) {
			logger().error('Error batching events [batch]:', error);
			throw error;
		}
	}
}
