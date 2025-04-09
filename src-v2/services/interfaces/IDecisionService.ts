import * as optimizely from '@optimizely/optimizely-sdk';

// Our internal user context matches our domain model
export type OptimizelyUserContext = {
  userId: string;
  attributes?: optimizely.UserAttributes;
};

// Re-export the SDK's decision type to ensure compatibility
export type OptimizelyDecision = optimizely.OptimizelyDecision & {
  experimentKey?: string; // Add experimentKey property needed for headers
};
export type OptimizelyDecideOption = optimizely.OptimizelyDecideOption;

/**
 * @interface IDecisionService
 * @description Defines the contract for making Optimizely decisions (feature flags, experiments).
 */
export interface IDecisionService {
  /**
   * Decides which variation, if any, is assigned for a feature flag or experiment.
   * @param flagKey - The key of the feature flag or experiment.
   * @param userContext - The user context (userId and attributes).
   * @param options - Optional: { sdkKey: string, decideOptions: OptimizelyDecideOption[] } to specify datafile/client and decision options.
   * @returns A promise resolving to the OptimizelyDecision.
   */
  decide(
    flagKey: string,
    userContext: OptimizelyUserContext,
    options?: { sdkKey?: string; decideOptions?: OptimizelyDecideOption[] } // Updated options type
  ): Promise<OptimizelyDecision>;
  
  /**
   * Gets a decision for a specific user and flag key.
   * @param userId - The user ID.
   * @param flagKey - The flag key.
   * @param attributes - Optional user attributes.
   * @param options - Optional: { sdkKey?: string, decideOptions?: OptimizelyDecideOption[] }.
   * @returns A promise resolving to the OptimizelyDecision.
   */
  getDecision(
    userId: string,
    flagKey: string,
    attributes?: optimizely.UserAttributes,
    options?: { sdkKey?: string; decideOptions?: OptimizelyDecideOption[] }
  ): Promise<OptimizelyDecision>;
  
  /**
   * Gets all decisions for a user across all flags.
   * @param userId - The user ID.
   * @param attributes - Optional user attributes.
   * @param options - Optional: { sdkKey?: string, decideOptions?: OptimizelyDecideOption[] }.
   * @returns A promise resolving to a map of flag keys to OptimizelyDecision.
   */
  getAllDecisions(
    userId: string,
    attributes?: optimizely.UserAttributes,
    options?: { sdkKey?: string; decideOptions?: OptimizelyDecideOption[] }
  ): Promise<Record<string, OptimizelyDecision>>;

  /**
   * Gets values for all flags for a given user.
   * @param userContext - The context for the user.
   * @param flagKeys - Optional list of specific flag keys to decide for.
   * @param options - Optional: { sdkKey: string, decideOptions: OptimizelyDecideOption[] }.
   * @returns A promise resolving to a map of flag keys to OptimizelyDecision.
   */
  decideAll?(
    userContext: OptimizelyUserContext,
    flagKeys?: string[],
    options?: { sdkKey?: string; decideOptions?: OptimizelyDecideOption[] }
  ): Promise<Record<string, OptimizelyDecision>>;

  /**
   * Forces a specific variation for debugging or testing (optional).
   * @param flagKey - The flag or experiment key.
   * @param userId - The user ID.
   * @param variationKey - The variation key to force.
   * @param options - Optional: { sdkKey: string }.
   * @returns A promise resolving on completion.
   */
  setForcedVariation?(
    flagKey: string,
    userId: string,
    variationKey: string | null,
    options?: { sdkKey?: string }
  ): Promise<void>;

  /**
   * Gets the forced variation for a user (optional).
   * @param flagKey - The flag or experiment key.
   * @param userId - The user ID.
   * @param options - Optional: { sdkKey?: string }.
   * @returns A promise resolving to the forced variation key or null.
   */
  getForcedVariation?(
    flagKey: string,
    userId: string,
    options?: { sdkKey?: string }
  ): Promise<string | null>;
} 