import * as optlyHelper from '../../utils/helpers/optimizelyHelper';
import RequestConfig from '../../config/requestConfig';
import defaultSettings from '../../config/defaultSettings';
import { logger } from '../../utils/helpers/optimizelyHelper';
import { AbstractionHelper } from '../../utils/helpers/abstractionHelper';
import EventListeners from './events/eventListeners';
import { ICDNAdapter, IKVStore } from '../../types/cdn';
import { 
	CoreLogicDependencies, 
	CoreLogicState, 
	Decision, 
	CDNVariationSettings,
	RequestConfig as RequestConfigType
} from '../../types/core';

/**
 * The CoreLogic class is the core logic class for processing requests and managing Optimizely decisions.
 * CoreLogic is shared across all CDN Adapters. CoreLogic utilizes the AbstractionHelper to abstract the request and response objects.
 */
export class CoreLogic {
	private logger: CoreLogicDependencies['logger'];
	private env: CoreLogicDependencies['env'];
	private ctx: CoreLogicDependencies['ctx'];
	private kvStore?: IKVStore;
	private sdkKey: string;
	private abstractionHelper: any; // TODO: Add proper type when converted
	private optimizelyProvider: any; // TODO: Add proper type when converted
	private kvStoreUserProfile?: IKVStore;
	private eventListeners: typeof EventListeners;
	private state: CoreLogicState;

	constructor(dependencies: CoreLogicDependencies) {
		const { 
			optimizelyProvider,
			env,
			ctx,
			sdkKey,
			abstractionHelper,
			kvStore,
			kvStoreUserProfile,
			logger 
		} = dependencies;

		this.logger = logger;
		this.logger.info(`CoreLogic instance created for SDK Key: ${sdkKey}`);
		this.env = env;
		this.ctx = ctx;
		this.kvStore = kvStore;
		this.sdkKey = sdkKey;
		this.abstractionHelper = abstractionHelper;
		this.optimizelyProvider = optimizelyProvider;
		this.kvStoreUserProfile = kvStoreUserProfile;
		this.eventListeners = EventListeners.getInstance();

		// Initialize state
		this.state = {
			reqResponseObjectType: 'response',
			datafileOperation: false,
			configOperation: false
		};
	}

	/**
	 * Sets the CDN adapter for the instance.
	 */
	setCdnAdapter(cdnAdapter: ICDNAdapter): void {
		this.state.cdnAdapter = cdnAdapter;
	}

	/**
	 * Retrieves the current CDN adapter.
	 */
	getCdnAdapter(): ICDNAdapter | undefined {
		return this.state.cdnAdapter;
	}

	/**
	 * Deletes the userContext key from each decision object in the given array.
	 */
	private deleteAllUserContexts(decisions: Decision[]): void {
		decisions.forEach(decision => {
			delete decision.userContext;
		});
	}

	/**
	 * Maps an array of decisions to a new array of objects containing specific CDN settings.
	 * Each object includes the flagKey, variationKey, and nested CDN variables.
	 */
	private extractCdnSettings(decisions: Decision[]): Array<{
		flagKey: string;
		variationKey: string;
		cdnVariationSettings?: CDNVariationSettings;
	}> {
		return decisions
			.filter(decision => decision.variables?.cdnVariationSettings)
			.map(({ flagKey, variationKey, variables }) => ({
				flagKey,
				variationKey,
				cdnVariationSettings: variables.cdnVariationSettings
			}));
	}

	/**
	 * Filters a provided array of decision settings to find a specific CDN configuration
	 * based on flagKey and variationKey.
	 */
	private getConfigForDecision(
		decisions: Array<{
			flagKey: string;
			variationKey: string;
			cdnVariationSettings?: CDNVariationSettings;
		}>,
		flagKey: string,
		variationKey: string
	): CDNVariationSettings | undefined {
		const decision = decisions.find(
			d => d.flagKey === flagKey && d.variationKey === variationKey
		);
		return decision?.cdnVariationSettings;
	}

	/**
	 * Processes an array of decision objects by removing the userContext and extracting CDN settings.
	 */
	private processDecisions(decisions: Decision[]): Array<{
		flagKey: string;
		variationKey: string;
		cdnVariationSettings?: CDNVariationSettings;
	}> {
		this.deleteAllUserContexts(decisions);
		return this.extractCdnSettings(decisions);
	}

	/**
	 * Sets the class properties based on the CDN configuration found.
	 */
	private setCdnConfigProperties(
		cdnConfig: CDNVariationSettings,
		flagKey: string,
		variationKey: string
	): void {
		this.state.cdnExperimentSettings = cdnConfig;
		this.state.cdnExperimentURL = cdnConfig.cdnExperimentURL;
		this.state.cdnResponseURL = cdnConfig.cdnResponseURL;
		this.state.forwardRequestToOrigin = cdnConfig.forwardRequestToOrigin;
		this.state.cacheKey = cdnConfig.cacheKey === 'VARIATION_KEY' 
			? `${flagKey}_${variationKey}` 
			: cdnConfig.cacheKey;
	}

	/**
	 * Removes extra slashes from the URL.
	 */
	private removeExtraSlashes(url: string): string {
		return url.replace(/([^:]\/)\/+/g, '$1');
	}

	// ... More methods to be converted
}
