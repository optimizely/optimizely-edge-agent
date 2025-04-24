import { IUserProfileService, UserProfileData } from '../interfaces/IUserProfileService';
import { IStorageAdapter } from '../../adapters/interfaces/IStorageAdapter';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';

export interface KVUserProfileServiceOptions {
  keyPrefix?: string;
  ttl?: number;
  maxCacheSize?: number;
  sdkKey: string;
}

/**
 * KVUserProfileService provides an implementation of the Optimizely SDK's UserProfileService
 * that uses a KV store through the IStorageAdapter for storing user bucketing decisions.
 * 
 * This enables sticky bucketing to ensure a consistent user experience across requests.
 */
export class KVUserProfileService implements IUserProfileService {
  private readonly storageAdapter: IStorageAdapter;
  private readonly logger: ILoggerAdapter;
  private readonly keyPrefix: string;
  private readonly ttl?: number;
  private readonly memoryCache: Map<string, UserProfileData>;
  private readonly maxCacheSize: number;
  private readonly sdkKey: string;

  /**
   * Creates a new KVUserProfileService instance
   * 
   * @param storageAdapter - The adapter to use for KV store operations
   * @param logger - The logger adapter
   * @param options - Configuration options with required sdkKey
   */
  constructor(
    storageAdapter: IStorageAdapter,
    logger: ILoggerAdapter,
    options: KVUserProfileServiceOptions
  ) {
    if (!options.sdkKey) {
      throw new Error('KVUserProfileService requires sdkKey in options');
    }

    this.storageAdapter = storageAdapter;
    this.logger = logger;
    this.sdkKey = options.sdkKey;
    this.keyPrefix = options.keyPrefix || 'optly-ups';
    this.ttl = options.ttl;
    this.maxCacheSize = options.maxCacheSize || 100;
    this.memoryCache = new Map<string, UserProfileData>();
    
    this.logger.info('[KVUserProfileService] Initialized with SDK key: ' + this.sdkKey);
  }

  /**
   * Generates a storage key for a user profile
   * 
   * @param userId - The user ID
   * @returns The storage key
   */
  private getStorageKey(userId: string): string {
    return `${this.keyPrefix}:${this.sdkKey}:${userId}`;
  }

  /**
   * Adds a user profile to the in-memory cache
   * 
   * @param userId - The user ID
   * @param profile - The user profile data
   */
  private addToCache(userId: string, profile: UserProfileData): void {
    // Manage cache size with simple LRU-like behavior
    if (this.memoryCache.size >= this.maxCacheSize) {
      // Remove the oldest entry (first item in the map)
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
        this.logger.debug(`[KVUserProfileService] Cache full, removing oldest entry: ${firstKey}`);
      }
    }
    this.memoryCache.set(userId, profile);
  }

  /**
   * Lookups a user profile by user ID
   * 
   * @param userId - The user ID to lookup
   * @returns A promise resolving to the user profile data or an empty object if not found
   */
  public async lookup(userId: string): Promise<UserProfileData> {
    try {
      // Try memory cache first for performance
      if (this.memoryCache.has(userId)) {
        this.logger.debug(`[KVUserProfileService] Cache hit for user: ${userId}`);
        return this.memoryCache.get(userId) || {};
      }

      // If not in cache, try to get from KV store
      const key = this.getStorageKey(userId);
      this.logger.debug(`[KVUserProfileService] Looking up user profile with key: ${key}`);
      
      const value = await this.storageAdapter.get(key, 'json');
      
      if (!value) {
        this.logger.debug(`[KVUserProfileService] No profile found for user: ${userId}`);
        return {};
      }

      // Parse if stored as string (though we requested JSON)
      let profile: UserProfileData;
      if (typeof value === 'string') {
        try {
          profile = JSON.parse(value);
        } catch (e) {
          this.logger.error(`[KVUserProfileService] Failed to parse profile for user ${userId}`, e);
          return {};
        }
      } else {
        // Already parsed by the adapter
        profile = value as UserProfileData;
      }

      // Add to cache for next time
      this.addToCache(userId, profile);
      
      this.logger.debug(`[KVUserProfileService] Retrieved profile for user: ${userId}`, { 
        experimentCount: profile.experiment_bucket_map ? Object.keys(profile.experiment_bucket_map).length : 0 
      });
      
      return profile;
    } catch (error) {
      this.logger.error(`[KVUserProfileService] Error looking up profile for user: ${userId}`, error);
      return {};
    }
  }

  /**
   * Saves a user profile
   * 
   * @param userProfileData - The user profile data to save
   * @returns A promise that resolves when the save operation is complete
   */
  public async save(userProfileData: UserProfileData): Promise<void> {
    try {
      if (!userProfileData || !userProfileData.user_id) {
        this.logger.warn('[KVUserProfileService] Cannot save profile without user_id');
        return;
      }

      const userId = userProfileData.user_id;
      const key = this.getStorageKey(userId);
      
      // Check if we have an existing profile to merge with
      let existingProfile: UserProfileData = {};
      
      if (this.memoryCache.has(userId)) {
        existingProfile = this.memoryCache.get(userId) || {};
      } else {
        const storedProfile = await this.storageAdapter.get(key, 'json');
        if (storedProfile) {
          existingProfile = (typeof storedProfile === 'string') 
            ? JSON.parse(storedProfile) 
            : storedProfile as UserProfileData;
        }
      }

      // Merge the existing experiment bucket map with the new one
      const mergedProfile: UserProfileData = {
        ...existingProfile,
        user_id: userId,
        experiment_bucket_map: {
          ...(existingProfile.experiment_bucket_map || {}),
          ...(userProfileData.experiment_bucket_map || {})
        }
      };

      // Store options for put operation
      const options: { expirationTtl?: number } = {};
      if (this.ttl) {
        options.expirationTtl = this.ttl;
      }

      // Save to KV store
      await this.storageAdapter.put(key, JSON.stringify(mergedProfile), options);
      
      // Update cache
      this.addToCache(userId, mergedProfile);
      
      this.logger.debug(`[KVUserProfileService] Saved profile for user: ${userId}`, { 
        experimentCount: mergedProfile.experiment_bucket_map ? Object.keys(mergedProfile.experiment_bucket_map).length : 0 
      });
    } catch (error) {
      this.logger.error(`[KVUserProfileService] Error saving profile for user: ${userProfileData.user_id}`, error);
    }
  }
} 