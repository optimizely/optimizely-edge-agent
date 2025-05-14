/**
 * @interface IUserProfileService
 * @description Defines the contract for user profile services that provide persistence
 * for user bucketing decisions across requests. Complies with Optimizely SDK's UserProfileService.
 */
export interface IUserProfileService {
  /**
   * Lookup user profile by userId
   * @param userId - The unique identifier for the user
   * @returns User profile data or an empty object if not found
   */
  lookup(userId: string): Promise<UserProfileData>;

  /**
   * Save user profile data
   * @param userProfileData - The user profile data to save
   */
  save(userProfileData: UserProfileData): Promise<void>;
  
  /**
   * Optional: Checks if a decision for a specific user and experiment came from storage
   * @param userId - The user ID
   * @param experimentId - The experiment ID or flag key
   * @returns True if the decision was retrieved from storage, false otherwise
   */
  isDecisionFromStorage?(userId: string, experimentId: string): boolean;
}

/**
 * @interface UserProfileData
 * @description Represents the structure of user profile data as expected by the Optimizely SDK
 */
export interface UserProfileData {
  user_id?: string;
  experiment_bucket_map?: Record<string, ExperimentBucketData>;
  [key: string]: any; // Allow additional properties
}

/**
 * @interface ExperimentBucketData
 * @description Represents an experiment variation assignment within a user profile
 */
export interface ExperimentBucketData {
  variation_id: string;
} 