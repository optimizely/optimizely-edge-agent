import * as optlyHelper from '../../utils/helpers/optimizelyHelper';
import { logger } from '../../utils/helpers/optimizelyHelper';

/**
 * Class representing a User Profile Service.
 */
class UserProfileService {
	/**
	 * Create a User Profile Service instance.
	 * @param {Object} kvStore - The key-value store to use for the user profile data.
	 * @param {string} sdkKey - The SDK key used for the KV Key prefix for user profile data.
	 */
	constructor(kvStore, sdkKey) {
		this.kvStore = kvStore;
		this.sdkKey = sdkKey;
		this.UPS_LS_PREFIX = 'optly-ups';
		this.cache = new Map();
		this.logger = logger;
		this.logger().debug('UserProfileService is enabled and initialized [constructor] - sdkKey:', sdkKey);
	}

	/**
	 * Get the visitor key for a given user ID.
	 * @param {string} visitorId - The user ID.
	 * @returns {string} The visitor key.
	 */
	getUserKey(visitorId) {
		return `${this.UPS_LS_PREFIX}-${this.sdkKey}-${visitorId}`;
	}

	/**
	 * Read user profile data from the key-value store and update the cache.
	 * @param {string} key - The visitor key.
	 * @returns {Promise<Object>} A promise that resolves to the user profile data.
	 */
	async read(key) {
		let userProfileData = await this.kvStore.get(key);

		if (userProfileData) {
			userProfileData = optlyHelper.safelyParseJSON(userProfileData);
			this.cache.set(key, userProfileData); // Cache the data
		}

		if (this.cache.has(key)) {
			const cachedData = this.cache.get(key);
			this.logger().debug('UserProfileService - read() - returning cached data:', cachedData);
			return cachedData;
		}

		return {};
	}

	/**
	 * Save user profile data to the key-value store.
	 * @param {string} key - The visitor key.
	 * @param {Object} data - The user profile data to write.
	 * @returns {Promise<Object>} A promise that resolves to the user profile data.
	 */
	async saveToKVStorage(key, data) {
		let result = await this.kvStore.put(key, data);
		return result;
	}

	/**
	 * Write user profile data to the key-value store and update the cache.
	 * @param {string} key - The visitor key.
	 * @param {Object} data - The user profile data to write.
	 * @returns {Promise<void>} A promise that resolves when the write operation is complete.
	 */
	async write(key, data) {
		this.logger().debug('UserProfileService - write() - writing data:', data);
		let existingData = this.cache.get(key);
		if (existingData) {
			if (optlyHelper.isValidObject(existingData, true)) {
				// Merge experiment_bucket_map properties
				const newExperimentBucketMap = data.experiment_bucket_map;
				const existingExperimentBucketMap = existingData.experiment_bucket_map || {};

				for (const [experimentId, variationData] of Object.entries(newExperimentBucketMap)) {
					existingExperimentBucketMap[experimentId] = variationData;
				}

				// Update the existing data with the merged experiment_bucket_map
				existingData.experiment_bucket_map = existingExperimentBucketMap;
				data = existingData;
			}
		}

		const parsedData = optlyHelper.safelyStringifyJSON(data);
		await this.kvStore.put(key, parsedData); // Write to KV store
		this.cache.set(key, data); // Update the cache with the latest data
	}

	/**
	 * Look up user profile data for a given user ID.
	 * @param {string} visitorId - The visitor ID.
	 * @returns {Promise<Object>} A promise that resolves to the user profile data.
	 */
	async lookup(visitorId) {
		const key = this.getUserKey(visitorId);
		return this.read(key)
			.then((data) => {
				this.logger().debug('UserProfileService - lookup() - returning data:', data);
				return data;
			})
			.catch((error) => {
				this.logger().error('UserProfileService - lookup() - error:', error);
				return {};
			});
	}

	/**
	 * Synchronous save method for the Optimizely SDK.
	 * @param {Object} userProfileMap - The user profile data to save.
	 */
	saveSync(userProfileMap) {
		const userKey = this.getUserKey(userProfileMap.user_id);
		this.cache.set(userKey, userProfileMap); // Synchronously update the cache
	}

	/**
	 * Method to get user profile data asynchronously.
	 * @param {string} visitorId - The visitor ID.
	 * @returns {Promise<Object>} A promise that resolves to an object containing the visitor ID key and the user profile data.
	 */
	getUserProfileFromCache(visitorId) {
		let userProfileMap = {};
		const key = this.getUserKey(visitorId);
		try {
			if (this.cache.has(key)) {
				userProfileMap = this.cache.get(key);
			}
			this.logger().debug('UserProfileService - getUserProfileAsync() - returning data for visitorId:', key);
			return { key, userProfileMap };
		} catch (error) {
			this.logger().error('UserProfileService - getUserProfileAsync() - error:', error);
			return { key, userProfileMap: {} };
		}
	}

	/**
	 * Prefetch user profiles to populate the cache.
	 * @param {Array<string>} visitorIds - The list of visitor IDs to prefetch.
	 * @returns {Promise<void>} A promise that resolves when the prefetch operation is complete.
	 */
	async prefetchUserProfiles(visitorIds) {
		for (const visitorId of visitorIds) {
			const key = this.getUserKey(visitorId);
			const result = await this.read(key);
			this.logger().debug('UserProfileService - prefetchUserProfiles() - returning data for visitorId:', key);
		}
	}

	/**
	 * Synchronous method to get user profile from cache.
	 * @param {string} visitorId - The user ID.
	 * @returns {Object|null} The user profile data or null if not found.
	 */
	getUserProfileSync(visitorId) {
		const key = this.getUserKey(visitorId);
		if (this.cache.has(key)) {
			return this.cache.get(key);
		}
		return {};
	}
}

export default UserProfileService;
