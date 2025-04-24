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

  constructor(userProfileService: IUserProfileService, logger: ILoggerAdapter) {
    this.userProfileService = userProfileService;
    this.logger = logger;
    this.profileCache = new Map<string, any>();
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
        
        // Start async refresh for next time
        this.refreshProfileAsync(userId).catch(error => {
          this.logger.error(`[OptimizelyUserProfileServiceAdapter] Error refreshing profile: ${error.message}`);
        });
        
        // Return from cache immediately (or empty object if not found)
        const cachedProfile = this.profileCache.get(userId) || {};
        this.logger.debug(`[OptimizelyUserProfileServiceAdapter] Returning cached profile for: ${userId}`, {
          hasBucketMap: !!cachedProfile.experiment_bucket_map,
          experimentCount: cachedProfile.experiment_bucket_map ? Object.keys(cachedProfile.experiment_bucket_map).length : 0
        });
        
        return cachedProfile;
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
        this.logger.debug(`[OptimizelyUserProfileServiceAdapter] Saving profile for: ${userId}`);
        
        // Update cache immediately
        this.profileCache.set(userId, userProfile);
        
        // Save asynchronously
        this.userProfileService.save(userProfile).catch(error => {
          this.logger.error(`[OptimizelyUserProfileServiceAdapter] Error saving profile: ${error.message}`);
        });
      }
    };
  }

  /**
   * Refresh a user profile asynchronously
   * Used to populate the cache for future synchronous lookups
   */
  private async refreshProfileAsync(userId: string): Promise<void> {
    try {
      const profile = await this.userProfileService.lookup(userId);
      this.profileCache.set(userId, profile);
      this.logger.debug(`[OptimizelyUserProfileServiceAdapter] Updated cache for: ${userId}`);
    } catch (error) {
      this.logger.error(`[OptimizelyUserProfileServiceAdapter] Error in refreshProfileAsync: ${error instanceof Error ? error.message : String(error)}`);
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