import * as optlyHelper from '../../utils/helpers/optimizelyHelper';
import { Logger } from '../../utils/logging/Logger';
import type { KVStore } from '../../types/cdn/store';

// Get singleton instances
const logger = Logger.getInstance({});

interface UserProfile {
  user_id: string;
  experiment_bucket_map: Record<string, {
    variation_id: string;
    campaign_id: string;
  }>;
}

interface CacheData {
  key: string;
  userProfileMap: UserProfile | Record<string, never>;
}

/**
 * Class representing a User Profile Service.
 * Manages user profiles for Optimizely experiments, including caching and persistence.
 */
export class UserProfileService {
  private readonly UPS_LS_PREFIX = 'optly-ups';
  private readonly cache: Map<string, UserProfile>;
  private readonly logger: typeof logger;

  /**
   * Create a User Profile Service instance.
   */
  constructor(
    private readonly kvStore: KVStore,
    private readonly sdkKey: string
  ) {
    this.cache = new Map();
    this.logger = logger;
    this.logger.debug(
      'UserProfileService is enabled and initialized [constructor] - sdkKey:',
      sdkKey
    );
  }

  /**
   * Get the visitor key for a given user ID.
   */
  private getUserKey(visitorId: string): string {
    return `${this.UPS_LS_PREFIX}-${this.sdkKey}-${visitorId}`;
  }

  /**
   * Read user profile data from the key-value store and update the cache.
   */
  private async read(key: string): Promise<UserProfile | Record<string, never>> {
    let userProfileData = await this.kvStore.get(key);

    if (userProfileData) {
      userProfileData = optlyHelper.safelyParseJSON(userProfileData);
      this.cache.set(key, userProfileData as unknown as UserProfile);
    }

    if (this.cache.has(key)) {
      const cachedData = this.cache.get(key);
      this.logger.debug('UserProfileService - read() - returning cached data:', cachedData);
      return cachedData as UserProfile;
    }

    return {};
  }

  /**
   * Write user profile data to the key-value store and update the cache.
   */
  private async write(key: string, data: UserProfile): Promise<void> {
    this.logger.debug('UserProfileService - write() - writing data:', data);
    const existingData = this.cache.get(key);

    if (existingData && optlyHelper.isValidObject(existingData, true)) {
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

    const parsedData = optlyHelper.safelyStringifyJSON(data);
    await this.kvStore.put(key, parsedData);
    this.cache.set(key, data);
  }

  /**
   * Look up user profile data for a given user ID.
   */
  async lookup(visitorId: string): Promise<UserProfile | Record<string, never>> {
    const key = this.getUserKey(visitorId);
    try {
      const data = await this.read(key);
      this.logger.debug('UserProfileService - lookup() - returning data:', data);
      return data;
    } catch (error) {
      this.logger.error('UserProfileService - lookup() - error:', error);
      return {};
    }
  }

  /**
   * Synchronous save method for the Optimizely SDK.
   */
  saveSync(userProfileMap: UserProfile): void {
    const userKey = this.getUserKey(userProfileMap.user_id);
    this.cache.set(userKey, userProfileMap);
  }

  /**
   * Method to get user profile data from cache.
   */
  getUserProfileFromCache(visitorId: string): CacheData {
    const key = this.getUserKey(visitorId);
    try {
      const userProfileMap = this.cache.has(key) ? this.cache.get(key) : {};
      this.logger.debug(
        'UserProfileService - getUserProfileFromCache() - returning data for visitorId:',
        key
      );
      return { key, userProfileMap: userProfileMap as UserProfile };
    } catch (error) {
      this.logger.error('UserProfileService - getUserProfileFromCache() - error:', error);
      return { key, userProfileMap: {} };
    }
  }

  /**
   * Prefetch user profiles to populate the cache.
   */
  async prefetchUserProfiles(visitorIds: string[]): Promise<void> {
    for (const visitorId of visitorIds) {
      const key = this.getUserKey(visitorId);
      await this.read(key);
      this.logger.debug(
        'UserProfileService - prefetchUserProfiles() - returning data for visitorId:',
        key
      );
    }
  }

  /**
   * Synchronous method to get user profile from cache.
   */
  getUserProfileSync(visitorId: string): UserProfile | Record<string, never> {
    const key = this.getUserKey(visitorId);
    return this.cache.has(key) ? (this.cache.get(key) as UserProfile) : {};
  }
}
