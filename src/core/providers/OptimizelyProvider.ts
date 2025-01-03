import { Logger } from '../../utils/logging/Logger';
import { ICDNAdapter, IKVStore } from '../../types/cdn';
import { OptimizelyConfig, OptimizelyUserContext } from '../../types/optimizely';
import * as optimizely from '@optimizely/optimizely-sdk';

// Get singleton instances
const logger = Logger.getInstance({});

interface OptimizelyEventDispatcher {
  dispatchEvent: (event: unknown) => Promise<void>;
}

interface UserProfileService {
  lookup: (visitorId: string) => Record<string, unknown>;
  save: (userProfile: Record<string, unknown>) => void;
}

export interface Decision {
  flagKey: string;
  variationKey: string;
  enabled?: boolean;
  variables?: Record<string, unknown>;
  ruleKey?: string;
  reasons?: string[];
}

export class OptimizelyProvider {
  private visitorId?: string;
  private optimizelyClient?: optimizely.Client;
  private optimizelyUserContext?: optimizely.OptimizelyUserContext;
  private cdnAdapter?: ICDNAdapter;
  private readonly httpMethod: string;
  private readonly kvStoreUserProfileEnabled: boolean;
  private readonly abstractContext: Record<string, unknown>;

  constructor(
    private readonly request: Request,
    private readonly env: Record<string, unknown>,
    private readonly ctx: {
      waitUntil: (promise: Promise<unknown>) => void;
      passThroughOnException: () => void;
    },
    private readonly requestConfig: {
      settings: {
        disableDecisionEvents?: boolean;
        decideOptions?: string[];
      };
    },
    private readonly abstractionHelper: {
      abstractRequest: {
        method: string;
      };
      abstractContext: Record<string, unknown>;
    },
    private readonly kvStoreUserProfile?: IKVStore
  ) {
    logger.debug('Initializing OptimizelyProvider');
    this.httpMethod = abstractionHelper.abstractRequest.method;
    this.kvStoreUserProfileEnabled = Boolean(kvStoreUserProfile);
    this.abstractContext = abstractionHelper.abstractContext;
  }

  /**
   * Sets the CDN adapter.
   */
  setCdnAdapter(adapter: ICDNAdapter): void {
    if (!adapter || typeof adapter !== 'object') {
      throw new TypeError('Invalid CDN adapter provided');
    }
    this.cdnAdapter = adapter;
  }

  /**
   * Gets the active feature flags.
   */
  async getActiveFlags(): Promise<string[]> {
    if (!this.optimizelyClient) {
      throw new Error('Optimizely Client is not initialized.');
    }

    const config = await this.optimizelyClient.getOptimizelyConfig();
    const result = Object.keys(config.featuresMap);
    logger.debug('Active feature flags retrieved [getActiveFlags]: ', result);
    return result;
  }

  /**
   * Builds the initialization parameters for the Optimizely client.
   */
  private buildInitParameters(
    datafile: string,
    datafileAccessToken?: string,
    defaultDecideOptions: string[] = [],
    visitorId?: string,
    globalUserProfile?: UserProfileService
  ): {
    datafile: string;
    datafileAccessToken?: string;
    defaultDecideOptions?: string[];
    eventDispatcher?: OptimizelyEventDispatcher;
    userProfileService?: UserProfileService;
  } {
    let userProfileService: UserProfileService | undefined;

    if (this.kvStoreUserProfileEnabled && globalUserProfile) {
      userProfileService = {
        lookup: (visitorId: string) => {
          const userProfile = globalUserProfile.lookup(visitorId);
          if (userProfile) {
            return userProfile;
          }
          throw new Error('User profile not found in cache');
        },
        save: (userProfile: Record<string, unknown>) => {
          globalUserProfile.save(userProfile);
        }
      };
    }

    const eventDispatcher = this.createEventDispatcher(defaultDecideOptions, this.ctx);

    return {
      datafile,
      datafileAccessToken,
      defaultDecideOptions,
      eventDispatcher,
      userProfileService
    };
  }

  /**
   * Creates an event dispatcher for the Optimizely client.
   */
  private createEventDispatcher(
    decideOptions: string[],
    ctx: { waitUntil: (promise: Promise<unknown>) => void }
  ): OptimizelyEventDispatcher | undefined {
    if (this.requestConfig.settings.disableDecisionEvents) {
      return undefined;
    }

    return {
      dispatchEvent: async (optimizelyEvent: unknown): Promise<void> => {
        const eventPromise = fetch('https://logx.optimizely.com/v1/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(optimizelyEvent)
        });

        ctx.waitUntil(eventPromise);
      }
    };
  }

  /**
   * Builds the decision options for the Optimizely client.
   */
  private buildDecideOptions(decideOptions: string[]): optimizely.OptimizelyDecideOption[] {
    const optlyDecideOptions: Record<string, optimizely.OptimizelyDecideOption> = {
      DISABLE_DECISION_EVENT: optimizely.OptimizelyDecideOption.DISABLE_DECISION_EVENT,
      ENABLED_FLAGS_ONLY: optimizely.OptimizelyDecideOption.ENABLED_FLAGS_ONLY,
      IGNORE_USER_PROFILE_SERVICE: optimizely.OptimizelyDecideOption.IGNORE_USER_PROFILE_SERVICE,
      INCLUDE_REASONS: optimizely.OptimizelyDecideOption.INCLUDE_REASONS,
      EXCLUDE_VARIABLES: optimizely.OptimizelyDecideOption.EXCLUDE_VARIABLES
    };

    const result = decideOptions.map((option) => optlyDecideOptions[option]);
    logger.debug('Decide options built [buildDecideOptions]: ', result);
    return result;
  }

  /**
   * Makes a decision for the specified feature flag keys.
   */
  async decide(
    flagKeys: string[],
    flagsToForce?: Record<string, Decision>,
    forcedDecisionKeys: string[] = []
  ): Promise<Decision[]> {
    if (!this.optimizelyClient || !this.optimizelyUserContext) {
      throw new Error('Optimizely Client or User Context is not initialized.');
    }

    const decisions: Decision[] = [];
    const decideOptions = this.buildDecideOptions(
      this.requestConfig.settings.decideOptions || []
    );

    for (const flagKey of flagKeys) {
      try {
        // Check for forced decision
        if (flagsToForce?.[flagKey]) {
          decisions.push(flagsToForce[flagKey]);
          continue;
        }

        const decision = await this.optimizelyUserContext.decide(flagKey, {
          decideOptions
        });

        decisions.push({
          flagKey: decision.flagKey,
          variationKey: decision.variationKey,
          enabled: decision.enabled,
          variables: decision.variables,
          ruleKey: decision.ruleKey,
          reasons: decision.reasons
        });
      } catch (error) {
        logger.error(`Error deciding flag ${flagKey}: ${error}`);
      }
    }

    return decisions;
  }

  /**
   * Retrieves the user attributes.
   */
  async getAttributes(
    attributes: Record<string, unknown> = {},
    userAgent?: string
  ): Promise<Record<string, unknown>> {
    const enrichedAttributes = { ...attributes };

    if (userAgent) {
      enrichedAttributes.$opt_user_agent = userAgent;
    }

    return enrichedAttributes;
  }

  /**
   * Initializes the Optimizely client.
   */
  async initialize(datafile: string): Promise<void> {
    const initParams = this.buildInitParameters(
      datafile,
      undefined,
      this.requestConfig.settings.decideOptions,
      this.visitorId
    );

    this.optimizelyClient = optimizely.createInstance(initParams);
    logger.debug('Optimizely client initialized');
  }

  /**
   * Creates a user context with the specified visitor ID and attributes.
   */
  async createUserContext(visitorId: string, attributes: Record<string, unknown>): Promise<void> {
    if (!this.optimizelyClient) {
      throw new Error('Optimizely Client is not initialized.');
    }

    this.visitorId = visitorId;
    this.optimizelyUserContext = this.optimizelyClient.createUserContext(visitorId, attributes);
    logger.debug('User context created for visitor ID: ' + visitorId);
  }

  /**
   * Retrieves the Optimizely datafile.
   */
  async datafile(): Promise<string | undefined> {
    if (!this.optimizelyClient) {
      return undefined;
    }

    const config = await this.optimizelyClient.getOptimizelyConfig();
    return JSON.stringify(config);
  }
}
