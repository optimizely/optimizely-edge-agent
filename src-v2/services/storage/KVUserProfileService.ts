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
  private readonly decisionsFromStorage: Map<string, Set<string>> = new Map(); // userId -> Set of experimentIds
  private readonly decisionSaveTimestamps: Map<string, Map<string, number>> = new Map(); // userId -> Map<experimentId, timestamp>
  private readonly decisionLoadTimestamps: Map<string, Map<string, number>> = new Map(); // userId -> Map<experimentId, timestamp>

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
    // Only cache profiles that actually have data
    if (!profile || 
        Object.keys(profile).length === 0 || 
        !profile.experiment_bucket_map || 
        Object.keys(profile.experiment_bucket_map || {}).length === 0) {
      this.logger.debug(`[KVUserProfileService] Not caching empty profile for user: ${userId}`);
      return;
    }
    
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
    this.logger.debug(`[KVUserProfileService] Added profile to cache for user: ${userId}`);
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
        
        // Get the profile from memory cache
        const profile = this.memoryCache.get(userId) || {};
        
        // Track any experiments in this profile as coming from storage
        if (profile && profile.experiment_bucket_map) {
          if (!this.decisionsFromStorage.has(userId)) {
            this.decisionsFromStorage.set(userId, new Set());
          }
          
          const userExperiments = this.decisionsFromStorage.get(userId)!;
          for (const experimentId in profile.experiment_bucket_map) {
            // Track this as loaded from cache with timestamp
            if (!this.decisionLoadTimestamps.has(userId)) {
              this.decisionLoadTimestamps.set(userId, new Map());
            }
            this.decisionLoadTimestamps.get(userId)!.set(experimentId, Date.now());
            
            userExperiments.add(experimentId);
            this.logger.debug(`[KVUserProfileService] Tracking cache decision from storage: ${userId}:${experimentId}`);
          }
        }
        
        return profile;
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
      
      // Track decisions from storage
      if (profile && profile.experiment_bucket_map) {
        if (!this.decisionsFromStorage.has(userId)) {
          this.decisionsFromStorage.set(userId, new Set());
        }
        
        const userExperiments = this.decisionsFromStorage.get(userId)!;
        for (const experimentId in profile.experiment_bucket_map) {
          // Track this as loaded from KV with timestamp
          if (!this.decisionLoadTimestamps.has(userId)) {
            this.decisionLoadTimestamps.set(userId, new Map());
          }
          this.decisionLoadTimestamps.get(userId)!.set(experimentId, Date.now());
          
          userExperiments.add(experimentId);
          this.logger.debug(`[KVUserProfileService] Tracking KV decision from storage: ${userId}:${experimentId}`);
        }
      }
      
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
      
      // Log incoming user profile data
      this.logger.info(`[KVUserProfileService] Saving profile for user: ${userId}`, {
        incomingProfile: JSON.stringify(userProfileData).substring(0, 200) + 
                        (JSON.stringify(userProfileData).length > 200 ? '...' : '')
      });
      
      // Check experiment_bucket_map
      const incomingExperiments = userProfileData.experiment_bucket_map || {};
      const experimentIds = Object.keys(incomingExperiments);
      this.logger.info(`[KVUserProfileService] Incoming profile has ${experimentIds.length} experiments`, {
        experimentIds: experimentIds.join(', ')
      });
      
      // Check if we have an existing profile to merge with
      let existingProfile: UserProfileData = {};
      
      if (this.memoryCache.has(userId)) {
        existingProfile = this.memoryCache.get(userId) || {};
        this.logger.info(`[KVUserProfileService] Found existing profile in memory cache for: ${userId}`);
      } else {
        this.logger.info(`[KVUserProfileService] No existing profile in memory cache, checking KV store with key: ${key}`);
        const storedProfile = await this.storageAdapter.get(key, 'json');
        if (storedProfile) {
          existingProfile = (typeof storedProfile === 'string') 
            ? JSON.parse(storedProfile) 
            : storedProfile as UserProfileData;
          this.logger.info(`[KVUserProfileService] Found existing profile in KV store for: ${userId}`);
        } else {
          this.logger.info(`[KVUserProfileService] No existing profile found in KV store for: ${userId}`);
        }
      }

      // Log existing profile
      const existingExperiments = existingProfile.experiment_bucket_map || {};
      const existingExperimentIds = Object.keys(existingExperiments);
      this.logger.info(`[KVUserProfileService] Existing profile has ${existingExperimentIds.length} experiments`, {
        experimentIds: existingExperimentIds.join(', '),
        existingProfile: existingExperimentIds.length > 0 ? 
          JSON.stringify(existingProfile).substring(0, 200) + 
          (JSON.stringify(existingProfile).length > 200 ? '...' : '') : 'empty'
      });

      // Merge the existing experiment bucket map with the new one
      const mergedProfile: UserProfileData = {
        ...existingProfile,
        user_id: userId,
        experiment_bucket_map: {
          ...(existingProfile.experiment_bucket_map || {}),
          ...(userProfileData.experiment_bucket_map || {})
        }
      };

      // Log merged profile
      const mergedExperiments = mergedProfile.experiment_bucket_map || {};
      const mergedExperimentIds = Object.keys(mergedExperiments);
      this.logger.info(`[KVUserProfileService] Merged profile has ${mergedExperimentIds.length} experiments`, {
        experimentIds: mergedExperimentIds.join(', '),
        mergedProfile: JSON.stringify(mergedProfile).substring(0, 200) + 
                     (JSON.stringify(mergedProfile).length > 200 ? '...' : '')
      });

      // Store options for put operation
      const options: { expirationTtl?: number } = {};
      if (this.ttl) {
        options.expirationTtl = this.ttl;
      }

      // Save to KV store
      this.logger.info(`[KVUserProfileService] Saving to KV store with key: ${key}`);
      await this.storageAdapter.put(key, JSON.stringify(mergedProfile), options);
      this.logger.info(`[KVUserProfileService] Successfully saved to KV store for: ${userId}`);
      
      // Update cache
      this.addToCache(userId, mergedProfile);
      this.logger.info(`[KVUserProfileService] Updated memory cache for: ${userId}`);

      // Track decisions stored in KV
      if (userProfileData.experiment_bucket_map) {
        if (!this.decisionsFromStorage.has(userId)) {
          this.decisionsFromStorage.set(userId, new Set());
        }
        
        const userExperiments = this.decisionsFromStorage.get(userId)!;
        for (const experimentId in userProfileData.experiment_bucket_map) {
          // Track when this decision was saved, not that it came from storage
          if (!this.decisionSaveTimestamps.has(userId)) {
            this.decisionSaveTimestamps.set(userId, new Map());
          }
          this.decisionSaveTimestamps.get(userId)!.set(experimentId, Date.now());
          
          // Don't add to decisionsFromStorage here! We'll only track what's been loaded, not saved
          this.logger.info(`[KVUserProfileService] Tracking save timestamp for: ${userId}:${experimentId}`);
        }
        
        // Log what's in the tracking map
        this.logger.info(`[KVUserProfileService] Tracking map now contains ${userExperiments.size} experiments for ${userId}`, {
          trackedExperiments: Array.from(userExperiments).join(', ')
        });
      }
    } catch (error) {
      this.logger.error(`[KVUserProfileService] Error saving profile for user: ${userProfileData.user_id}`, error);
    }
  }

  /**
   * Checks if a decision for a specific user and experiment ID came from storage
   * 
   * @param userId - The user ID
   * @param experimentId - The experiment ID (not flag key)
   * @returns True if the decision was retrieved from storage, false otherwise
   */
  public isDecisionFromStorage(userId: string, experimentId: string): boolean {
    const checkTime = Date.now();
    this.logger.info(`[KVUserProfileService] [${checkTime}] Checking if decision from storage: ${userId}:${experimentId}`);
    
    // First validate inputs
    if (!userId || !experimentId) {
      this.logger.debug(`[KVUserProfileService] Invalid inputs for isDecisionFromStorage: userId=${userId}, experimentId=${experimentId}`);
      return false;
    }
    
    // Debug: log current state of memory cache and tracking map
    this.logger.info(`[KVUserProfileService] [${checkTime}] CACHE STATE: memoryCache size=${this.memoryCache.size}, trackingMap size=${this.decisionsFromStorage.size}`);
    
    // Check if this decision was loaded from storage
    const loadTimestamps = this.decisionLoadTimestamps.get(userId);
    const loadTime = loadTimestamps?.get(experimentId);
    
    // Check if this decision was recently saved
    const saveTimestamps = this.decisionSaveTimestamps.get(userId);
    const saveTime = saveTimestamps?.get(experimentId);
    
    // Log timestamps for debugging
    this.logger.info(`[KVUserProfileService] Timestamp check for ${userId}:${experimentId}: loadTime=${loadTime || 'none'}, saveTime=${saveTime || 'none'}`);
    
    // A decision is considered from storage ONLY if:
    // 1. It was loaded from storage at some point (loadTime exists)
    // 2. AND EITHER:
    //    a. It was never saved (saveTime doesn't exist) OR
    //    b. It was loaded more recently than it was saved (loadTime > saveTime)
    //    This second condition ensures we don't incorrectly mark freshly saved decisions as "from storage"
    if (loadTime && (!saveTime || loadTime > saveTime)) {
      this.logger.info(`[KVUserProfileService] CONFIRMED: Decision from storage ${userId}:${experimentId} (loaded at ${loadTime})`);
      return true;
    }
    
    // The profile exists in memory cache but hasn't been confirmed from storage via timestamps
    // Let's check if it's a real profile decision that was loaded from storage
    const profile = this.memoryCache.get(userId);
    if (profile && profile.experiment_bucket_map) {
      // Only consider it from storage if it has actual data and wasn't just saved
      if (Object.keys(profile.experiment_bucket_map).length > 0 && 
          profile.experiment_bucket_map[experimentId] && 
          (!saveTime || (loadTime && loadTime > saveTime))) {
        
        // Found a decision in the profile - validate it has a variation_id
        const decision = profile.experiment_bucket_map[experimentId];
        if (!decision || !decision.variation_id) {
          this.logger.debug(`[KVUserProfileService] Invalid decision data for ${experimentId}, missing variation_id`);
          return false;
        }
        
        this.logger.info(`[KVUserProfileService] FOUND valid profile decision: ${userId}:${experimentId}`);
        return true;
      } else if (profile.experiment_bucket_map[experimentId]) {
        // Found the decision, but it was saved more recently than loaded
        this.logger.info(`[KVUserProfileService] Decision found but was just saved (not from storage): ${userId}:${experimentId}`);
        return false;
      }
    }
    
    this.logger.info(`[KVUserProfileService] Decision NOT found in storage: ${userId}:${experimentId}`);
    return false;
  }
} 