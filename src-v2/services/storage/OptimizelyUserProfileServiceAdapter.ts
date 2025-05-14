import { IUserProfileService } from '../interfaces/IUserProfileService';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';

/**
 * Adapter to convert our IUserProfileService to Optimizely SDK's UserProfileService interface.
 * 
 * This is needed because the Optimizely SDK expects a specific shape with synchronous lookup and save methods.
 */
export class OptimizelyUserProfileServiceAdapter {
  private userProfileService: IUserProfileService;
  private logger: ILoggerAdapter;
  private profileCache: Map<string, any>;
  private decisionsFromStorage: Map<string, Set<string>> = new Map(); // userId -> Set of experimentIds
  private decisionSaveTimestamps: Map<string, Map<string, number>> = new Map(); // userId -> Map<experimentId, timestamp>
  private decisionLoadTimestamps: Map<string, Map<string, number>> = new Map(); // userId -> Map<experimentId, timestamp>

  constructor(userProfileService: IUserProfileService, logger: ILoggerAdapter) {
    this.userProfileService = userProfileService;
    this.logger = logger;
    this.profileCache = new Map<string, any>();
    
    // Log creation for debugging
    this.logger.info(`[OptimizelyUserProfileServiceAdapter] Initialized`);
  }

  /**
   * Get the SDK-compatible UserProfileService object
   * Implements the interface required by the Optimizely SDK
   */
  public getSDKUserProfileService(): { lookup: (userId: string) => any; save: (userProfile: any) => void } {
    return {
      /**
       * Lookup method - MUST be synchronous for Optimizely SDK
       * We'll use the cache for sync access, and refresh it asynchronously
       */
      lookup: (userId: string): any => {
        this.logger.debug(`[OptimizelyUserProfileServiceAdapter] Looking up profile for: ${userId}`);
        
        // Check if we already have this profile cached
        if (this.profileCache.has(userId)) {
          const cachedProfile = this.profileCache.get(userId);
          
          // Track which decisions came from storage for tracking purposes
          if (cachedProfile && cachedProfile.experiment_bucket_map) {
            if (!this.decisionsFromStorage.has(userId)) {
              this.decisionsFromStorage.set(userId, new Set());
            }
            
            const userExperiments = this.decisionsFromStorage.get(userId)!;
            const experimentIds = Object.keys(cachedProfile.experiment_bucket_map);
            
            for (const experimentId of experimentIds) {
              // Track when this decision was loaded with timestamp
              if (!this.decisionLoadTimestamps.has(userId)) {
                this.decisionLoadTimestamps.set(userId, new Map());
              }
              this.decisionLoadTimestamps.get(userId)!.set(experimentId, Date.now());
              
              userExperiments.add(experimentId);
              this.logger.debug(`[OptimizelyUserProfileServiceAdapter] Tracking decision from lookup: ${userId}:${experimentId}`);
            }
            
            this.logger.debug(`[OptimizelyUserProfileServiceAdapter] Returning cached profile for: ${userId}`, {
              hasBucketMap: !!cachedProfile.experiment_bucket_map,
              experimentCount: experimentIds.length
            });
          }
          
          return cachedProfile;
        }
        
        // For first request, do a synchronous initialization
        // This is needed because the SDK expects a synchronous lookup
        this.logger.debug(`[OptimizelyUserProfileServiceAdapter] First lookup for ${userId}, initializing cache synchronously`);
        
        try {
          // Try to get a stored profile for this user from memory only (no KV access)
          const lookupPromise = this.userProfileService.lookup(userId);
          
          // We need to handle this promise synchronously
          // This is a workaround since we can't actually do async in a sync function
          // Start async refresh for future lookups
          this.refreshProfileAsync(userId).catch(error => {
            this.logger.error(`[OptimizelyUserProfileServiceAdapter] Error refreshing profile: ${error.message}`);
          });
          
          // Return empty for first lookup
          return {};
        } catch (e) {
          this.logger.error(`[OptimizelyUserProfileServiceAdapter] Error in synchronous lookup: ${e}`);
          return {};
        }
      },
      
      /**
       * Save method
       * We'll update the cache immediately and save asynchronously
       */
      save: (userProfile: any): void => {
        if (!userProfile || !userProfile.user_id) {
          this.logger.warn('[OptimizelyUserProfileServiceAdapter] Attempted to save profile without user_id');
          return;
        }
        
        const userId = userProfile.user_id;
        this.logger.info(`[OptimizelyUserProfileServiceAdapter] Saving profile for: ${userId}`);
        
        // Update cache immediately
        this.profileCache.set(userId, userProfile);
        
        const experimentMap = userProfile.experiment_bucket_map || {};
        const experimentIds = Object.keys(experimentMap);
        
        // Log details about the profile being saved
        this.logger.info(`[OptimizelyUserProfileServiceAdapter] Profile contains ${experimentIds.length} experiment decisions`, {
          userId,
          experimentIds: experimentIds.join(', '),
          profileSize: JSON.stringify(userProfile).length
        });
        
        // Track which decisions were saved to storage
        if (experimentIds.length > 0) {
          if (!this.decisionsFromStorage.has(userId)) {
            this.decisionsFromStorage.set(userId, new Set());
          }
          
          const userExperiments = this.decisionsFromStorage.get(userId)!;
          
          for (const experimentId of experimentIds) {
            // Track when this decision was saved with timestamp
            if (!this.decisionSaveTimestamps.has(userId)) {
              this.decisionSaveTimestamps.set(userId, new Map());
            }
            this.decisionSaveTimestamps.get(userId)!.set(experimentId, Date.now());
            
            // Don't add to decisionsFromStorage here - it's being saved, not loaded from storage
            // Log details about each experiment for debugging
            const expDetails = experimentMap[experimentId];
            this.logger.info(`[OptimizelyUserProfileServiceAdapter] Saving experiment decision: ${userId}:${experimentId}`, {
              experimentId,
              variationId: expDetails?.variation_id,
              activationId: expDetails?.activation_id,
              saveTimestamp: this.decisionSaveTimestamps.get(userId)!.get(experimentId)
            });
          }
        }
        
        // Save asynchronously to KV storage
        this.userProfileService.save(userProfile)
          .then(() => {
            this.logger.info(`[OptimizelyUserProfileServiceAdapter] Successfully saved profile to KV for: ${userId}`);
          })
          .catch(error => {
            this.logger.error(`[OptimizelyUserProfileServiceAdapter] Error saving profile to KV: ${error.message}`);
          });
      }
    };
  }
  
  /**
   * Checks if a decision for a specific user and flag key came from storage
   * 
   * @param userId - The user ID
   * @param flagKey - The feature flag key
   * @returns True if the decision was retrieved from storage, false otherwise
   */
  public isDecisionFromStorage(userId: string, experimentIdOrFlagKey: string): boolean {
    // Add detailed logging to help debug the issue
    const checkTime = Date.now();
    this.logger.info(`[OptimizelyUserProfileServiceAdapter] [${checkTime}] Checking if decision from storage: ${userId}:${experimentIdOrFlagKey}`);
    
    // For debugging, log the current state of the cache
    this.logger.info(`[OptimizelyUserProfileServiceAdapter] [${checkTime}] CACHE STATE: profileCache size=${this.profileCache.size}, decisionMap size=${this.decisionsFromStorage.size}`);
    
    // Check if this decision was loaded from storage
    const loadTimestamps = this.decisionLoadTimestamps.get(userId);
    const loadTime = loadTimestamps?.get(experimentIdOrFlagKey);
    
    // Check if this decision was recently saved
    const saveTimestamps = this.decisionSaveTimestamps.get(userId);
    const saveTime = saveTimestamps?.get(experimentIdOrFlagKey);
    
    // Log timestamps for debugging
    this.logger.info(`[OptimizelyUserProfileServiceAdapter] Timestamp check for ${userId}:${experimentIdOrFlagKey}: loadTime=${loadTime || 'none'}, saveTime=${saveTime || 'none'}`);
    
    // A decision is considered from storage ONLY if:
    // 1. It was loaded from storage at some point (loadTime exists)
    // 2. AND EITHER:
    //    a. It was never saved (saveTime doesn't exist) OR
    //    b. It was loaded more recently than it was saved (loadTime > saveTime)
    if (loadTime && (!saveTime || loadTime > saveTime)) {
      this.logger.info(`[OptimizelyUserProfileServiceAdapter] CONFIRMED: Decision from storage ${userId}:${experimentIdOrFlagKey} via timestamps`);
      return true;
    }
    
    // Check in our cache for a backup check
    const cachedProfile = this.profileCache.get(userId);
    if (cachedProfile && cachedProfile.experiment_bucket_map && cachedProfile.experiment_bucket_map[experimentIdOrFlagKey]) {
      // Only consider it from storage if it wasn't just saved
      if (!saveTime || (loadTime && loadTime > saveTime)) {
        this.logger.info(`[OptimizelyUserProfileServiceAdapter] FOUND in profile cache: ${userId}:${experimentIdOrFlagKey}`);
        return true;
      } else {
        this.logger.info(`[OptimizelyUserProfileServiceAdapter] Found in cache but was just saved (not from storage): ${userId}:${experimentIdOrFlagKey}`);
        return false;
      }
    }
    
    // Fallback to checking with the underlying storage service
    if (this.userProfileService.isDecisionFromStorage && 
        typeof this.userProfileService.isDecisionFromStorage === 'function') {
      this.logger.info(`[OptimizelyUserProfileServiceAdapter] Checking underlying storage service for ${userId}:${experimentIdOrFlagKey}`);
      
      const result = this.userProfileService.isDecisionFromStorage(userId, experimentIdOrFlagKey);
      
      if (result) {
        this.logger.info(`[OptimizelyUserProfileServiceAdapter] FOUND in underlying storage: ${userId}:${experimentIdOrFlagKey}`);
        
        // Update load timestamps for future checks
        if (!this.decisionLoadTimestamps.has(userId)) {
          this.decisionLoadTimestamps.set(userId, new Map());
        }
        this.decisionLoadTimestamps.get(userId)!.set(experimentIdOrFlagKey, Date.now());
        
        return true;
      } else {
        this.logger.info(`[OptimizelyUserProfileServiceAdapter] NOT found in underlying storage: ${userId}:${experimentIdOrFlagKey}`);
      }
      
      return result;
    }
    
    this.logger.info(`[OptimizelyUserProfileServiceAdapter] Decision NOT found in storage: ${userId}:${experimentIdOrFlagKey}`);
    return false;
  }

  /**
   * Refresh a user profile asynchronously
   * Used to populate the cache for future synchronous lookups
   */
  private async refreshProfileAsync(userId: string): Promise<void> {
    try {
      const profile = await this.userProfileService.lookup(userId);
      
      // Only cache if profile has actual data (same check as in preloadProfile)
      if (profile && 
          Object.keys(profile).length > 0 && 
          profile.experiment_bucket_map && 
          Object.keys(profile.experiment_bucket_map).length > 0) {
        this.profileCache.set(userId, profile);
        this.logger.debug(`[OptimizelyUserProfileServiceAdapter] Updated cache with valid profile for: ${userId}`);
      } else {
        // Don't cache empty profiles
        this.logger.debug(`[OptimizelyUserProfileServiceAdapter] No data in profile for: ${userId}, not caching empty profile`);
      }
    } catch (error) {
      this.logger.error(`[OptimizelyUserProfileServiceAdapter] Error in refreshProfileAsync: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Preload a user profile before making a decision
   * This should be called before the SDK's decide method
   * 
   * @param userId - The user ID to preload the profile for
   * @returns A promise that resolves when the profile is loaded
   */
  public async preloadProfile(userId: string): Promise<void> {
    try {
      this.logger.debug(`[OptimizelyUserProfileServiceAdapter] Preloading profile for: ${userId}`);
      
      // If already in cache, return immediately
      if (this.profileCache.has(userId)) {
        this.logger.debug(`[OptimizelyUserProfileServiceAdapter] Profile already in cache for: ${userId}`);
        return;
      }
      
      // Load from storage
      const profile = await this.userProfileService.lookup(userId);
      
      // Only update cache if profile has actual data
      // Empty profiles should not be cached as that causes incorrect decisionFromStorage behavior
      if (profile && 
          Object.keys(profile).length > 0 && 
          profile.experiment_bucket_map && 
          Object.keys(profile.experiment_bucket_map).length > 0) {
        // Profile has real data, cache it
        this.profileCache.set(userId, profile);
        
        // Track all decisions in this profile as loaded from storage with timestamps
        if (!this.decisionLoadTimestamps.has(userId)) {
          this.decisionLoadTimestamps.set(userId, new Map());
        }
        
        // Add load timestamps for each experiment in the profile
        const loadTime = Date.now();
        const experimentIds = Object.keys(profile.experiment_bucket_map);
        for (const experimentId of experimentIds) {
          this.decisionLoadTimestamps.get(userId)!.set(experimentId, loadTime);
          this.logger.debug(`[OptimizelyUserProfileServiceAdapter] Tracking load timestamp for ${userId}:${experimentId}: ${loadTime}`);
        }
        
        this.logger.debug(`[OptimizelyUserProfileServiceAdapter] Cached profile with data for: ${userId}`);
      } else {
        this.logger.debug(`[OptimizelyUserProfileServiceAdapter] No profile data found for: ${userId}, not caching empty profile`);
      }
      
      this.logger.debug(`[OptimizelyUserProfileServiceAdapter] Preloaded profile for: ${userId}`);
      
      // Log what was loaded
      if (profile && profile.experiment_bucket_map) {
        const experimentIds = Object.keys(profile.experiment_bucket_map);
        this.logger.debug(`[OptimizelyUserProfileServiceAdapter] Profile contains ${experimentIds.length} experiments: ${experimentIds.join(', ')}`);
      } else {
        this.logger.debug(`[OptimizelyUserProfileServiceAdapter] No experiments in profile for: ${userId}`);
      }
    } catch (error) {
      this.logger.error(`[OptimizelyUserProfileServiceAdapter] Error preloading profile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Warm up the cache with a set of user IDs
   * Useful for prefetching profiles for known users
   */
  public async warmupCache(userIds: string[]): Promise<void> {
    this.logger.info(`[OptimizelyUserProfileServiceAdapter] Warming up cache for ${userIds.length} users`);
    
    const promises = userIds.map(userId => this.refreshProfileAsync(userId));
    await Promise.all(promises);
    
    this.logger.info(`[OptimizelyUserProfileServiceAdapter] Cache warmup complete`);
  }
} 