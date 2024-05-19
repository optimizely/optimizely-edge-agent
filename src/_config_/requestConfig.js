import Logger from '../_helpers_/logger';
import EventListeners from '../_event_listeners_/eventListeners';

/**
 * Manages the configuration settings for a request, including headers, query parameters, and body content.
 */
export default class RequestConfig {
	/**
	 * Constructs the RequestConfig object with initial settings based on the provided HTTP request.
	 * @param {Request} request - The HTTP request from which to derive initial configuration.
	 */
	constructor(request, env, ctx, cdnAdapter, abstractionHelper) {
		this.abstractionHelper = abstractionHelper;
		this.request = this.abstractionHelper.request;
		this.cdnAdapter = cdnAdapter;
		this.url = this.abstractionHelper.abstractRequest.getNewURL(this.abstractionHelper.request.url);
		this.method = this.abstractionHelper.abstractRequest.getHttpMethod();
		this.body = null;
		this.headers = this.abstractionHelper.headers;
		this.trimmedDecisions = undefined;
		this.isPostMethod = this.method === 'POST';
		this.headerCookiesString = this.abstractionHelper.abstractRequest.getHeader('Cookie') || '';

		// Configuration settings derived from environment and request
		this.settings = {
			cdnProvider: 'cloudflare', // Possible values: cloudflare, fastly, cloudfront, akamai
			responseJsonKeyName: 'decisions',
			enableResponseMetadata: true,
			flagsFromKV: false,
			datafileFromKV: false,
			trimmedDecisions: undefined,
			defaultTrimmedDecisions: true,
			defaultSetResponseCookies: true,
			defaultSetResponseHeaders: true,
			defaultSetRequestCookies: true,
			defaultSetRequestHeaders: true,
			defaultResponseHeadersAndCookies: true,
			decisionsKeyName: 'decisions',
			decisionsCookieName: 'optly_edge_decisions',
			visitorIdCookieName: 'optly_edge_visitor_id',
			decisionsHeaderName: 'optly-edge-decisions',
			visitorIdsHeaderName: 'optly-edge-visitor-id',
			sdkKeyHeader: 'X-Optimizely-SDK-Key',
			setResponseHeaders: 'X-Optimizely-Set-Response-Headers',
			setResponseCookies: 'X-Optimizely-Set-Response-Cookies',
			setRequestHeaders: 'X-Optimizely-Set-Request-Headers',
			setRequestCookies: 'X-Optimizely-Set-Request-Cookies',
			overrideVisitorIdHeader: 'X-Optimizely-Override-Visitor-Id',
			attributesHeader: 'X-Optimizely-Attributes-Header',
			eventTagsHeader: 'X-Optimizely-Event-Tags-Header',
			datafileAccessToken: 'X-Optimizely-Datafile-Access-Token',
			enableOptimizelyHeader: 'X-Optimizely-Enable-FEX',
			decideOptionsHeader: 'X-Optimizely-Decide-Options',
			visitorIdHeader: 'X-Optimizely-Visitor-Id',
			trimmedDecisionsHeader: 'X-Optimizely-Trimmed-Decisions',
			enableFlagsFromKV: 'X-Optimizely-Flags-KV',
			enableDatafileFromKV: 'X-Optimizely-Datafile-KV',
			enableRespMetadataHeader: 'X-Optimizely-Enable-Response-Metadata',
			kvFlagKeyName: 'optly_flagKeys',
			kvDatafileKeyName: 'optly_sdk_datafile',
			cookieExpirationInDays: 400,
		};
	}

	/**
	 * Initializes the request configuration based on headers, query parameters, and possibly the body for POST requests.
	 * Sets up various metadata properties based on the request configuration.
	 *
	 * @param {Request} request - The incoming HTTP request object.
	 * @returns {Promise<Request>} - The original request, potentially modified if body parsing occurs.
	 */
	async initialize(request) {
		// Define query parameters and initialize metadata from configurations.
		this.queryParameters = await this.defineQueryParameters();
		this.configMetadata = await this.initializeConfigMetadata();

		// Initialize values from request headers and query parameters.
		await this.initializeFromHeaders();
		await this.initializeFromQueryParams();

		// If the request method is POST, load the request body.
		if (this.isPostMethod) {
			await this.loadRequestBody(request);
		}

		// Set metadata properties if response metadata is enabled and values are available.
		if (this.sdkKey && this.settings.enableResponseMetadata) {
			this.configMetadata.sdkKey = this.sdkKey;
			this.configMetadata.sdkKeyFrom = this.sdkKeyFrom || 'initialization';
		}

		if (this.decideOptions && this.settings.enableResponseMetadata) {
			this.configMetadata.decideOptions = this.decideOptions;
		}

		if (this.eventTags && this.settings.enableResponseMetadata) {
			this.configMetadata.eventTags = this.eventTags;
		}

		if (this.attributes && this.settings.enableResponseMetadata) {
			this.configMetadata.attributes = this.attributes;
		}

		// Return the request for potential further processing.
		return request;
	}

	/**
	 * Retrieves the JSON payload from a request, ensuring the request method is POST.
	 * This method clones the request for safe reading and handles errors in JSON parsing,
	 * returning null if the JSON is invalid or the method is not POST.
	 *
	 * @param {Request} request - The incoming HTTP request object.
	 * @returns {Promise<Object|null>} - A promise that resolves to the JSON object parsed from the request body, or null if the body isn't valid JSON or method is not POST.
	 */
	async getJsonPayload(request) {
		return this.cdnAdapter.getJsonPayload(request);
	}

	/**
	 * Defines the set of query parameters used for configuration.
	 * @returns {Object} A mapping of query parameter keys to their respective settings.
	 */
	async defineQueryParameters() {
		return {
			serverMode: 'serverMode',
			visitorId: 'visitorId',
			keys: 'keys',
			sdkKey: 'sdkKey',
			decideAll: 'decideAll',
			trimmedDecisions: 'trimmedDecisions',
			setRequestHeaders: 'setRequestHeaders',
			setResponseHeaders: 'setResponseHeaders',
			setRequestCookies: 'setRequestCookies',
			setResponseCookies: 'setResponseCookies',
			disableDecisionEvent: 'DISABLE_DECISION_EVENT',
			enabledFlagsOnly: 'ENABLED_FLAGS_ONLY',
			includeReasons: 'INCLUDE_REASONS',
			ignoreUserProfileService: 'IGNORE_USER_PROFILE_SERVICE',
			excludeVariables: 'EXCLUDE_VARIABLES',
			overrideVisitorId: 'overrideVisitorId',
			enableResponseMetadata: 'enableResponseMetadata',
			enableDatafileFromKV: 'enableDatafileFromKV',
			enableFlagsFromKV: 'enableFlagsFromKV',
		};
	}

	/**
	 * Initializes metadata configuration for logging and debugging purposes.
	 * @returns {Object} The initial metadata configuration object.
	 */
	async initializeConfigMetadata() {
		return {
			visitorId: '',
			visitorIdFrom: '',
			decideOptions: [],
			attributes: {},
			attributesFrom: '',
			eventTags: {},
			eventTagsFrom: '',
			sdkKey: '',
			sdkKeyFrom: '',
			datafileFrom: '',
			trimmedDecisions: true,
			decideAll: false,
			flagKeysDecided: [],
			flagKeysFrom: '',
			storedDecisionsFound: false,
			storedCookieDecisions: [],
			forcedDecisions: [],
			agentServerMode: false,
			pathName: '',
			cdnVariationSettings: {},
		};
	}

	/**
	 * Loads the request body and initializes configuration from it if the method is POST and content type is JSON.
	 */
	async loadRequestBody(request) {
		if (this.isPostMethod && this.getHeader('content-type')?.includes('application/json')) {
			if (request) {
				try {
					const jsonBody = await this.getJsonPayload(request);
					this.body = jsonBody;
					await this.initializeFromBody();
				} catch (error) {
					console.error('Failed to parse JSON body:', error);
					this.body = null;
				}
			} else {
				console.log('Request body is empty or contains only whitespace.');
				//  ToDo - handle cases where no body is provided?
				this.body = null;
			}
		}
	}

	/**
	 * Initializes configuration settings from HTTP headers.
	 */
	async initializeFromHeaders() {
		this.sdkKey = this.getHeader(this.settings.sdkKeyHeader);
		this.overrideVisitorId = this.parseBoolean(this.getHeader(this.settings.overrideVisitorIdHeader));
		if (this.sdkKey && this.settings.enableResponseMetadata) this.configMetadata.sdkKeyFrom = 'Headers';
		this.attributes = this.parseJson(this.getHeader(this.settings.attributesHeader));
		if (this.attributes && this.settings.enableResponseMetadata) this.configMetadata.attributesFrom = 'body';
		this.eventTags = this.parseJson(this.getHeader(this.settings.eventTagsHeader));
		if (this.eventTags && this.settings.enableResponseMetadata) this.configMetadata.eventTagsFrom = 'headers';
		this.datafileAccessToken = this.getHeader(this.settings.datafileAccessToken);
		this.optimizelyEnabled = this.parseBoolean(this.getHeader(this.settings.enableOptimizelyHeader));
		this.decideOptions = this.parseJson(this.getHeader(this.settings.decideOptionsHeader));
		this.enableOptimizelyHeader = this.parseJson(this.getHeader(this.settings.enableOptimizelyHeader));
		this.enableResponseMetadata = this.parseBoolean(this.getHeader(this.settings.enableRespMetadataHeader));
		this.excludeVariables = this.decideOptions && this.decideOptions?.includes('EXCLUDE_VARIABLES');
		this.enabledFlagsOnly = this.decideOptions && this.decideOptions?.includes('ENABLED_FLAGS_ONLY');
		this.visitorId = this.getHeader(this.settings.visitorIdHeader);
		//this.trimmedDecisions = this.parseBoolean(this.getHeader(this.settings.trimmedDecisionsHeader)) || this.settings.defaultTrimmedDecisions;
		const trimmedDecisionsHeader = this.getHeader(this.settings.trimmedDecisionsHeader);
		if (trimmedDecisionsHeader === 'false') {
			this.trimmedDecisions = false;
		} else if (trimmedDecisionsHeader === 'true') {
			this.trimmedDecisions = true;
		} else {
			this.trimmedDecisions = undefined;
		}
		this.enableFlagsFromKV = this.parseBoolean(this.getHeader(this.settings.enableFlagsFromKV));
		this.datafileFromKV = this.parseBoolean(this.getHeader(this.settings.enableDatafileFromKV));
		this.enableRespMetadataHeader = this.parseBoolean(this.getHeader(this.settings.enableRespMetadataHeader));
		this.setResponseCookies = this.parseBoolean(this.getHeader(this.settings.setResponseCookies));
		this.setResponseHeaders = this.parseBoolean(this.getHeader(this.settings.setResponseHeaders));
		this.setRequestHeaders = this.parseBoolean(this.getHeader(this.settings.setRequestHeader));
		this.setRequestCookies = this.parseBoolean(this.getHeader(this.settings.setRequestCookies));
	}

	/**
	 * Initializes configuration settings from URL query parameters.
	 */
	async initializeFromQueryParams() {
		const qp = this.url.searchParams;
		this.overrideVisitorId = this.overrideVisitorId || qp.get(this.queryParameters.overrideVisitorId) === 'true' ? true : false || false;
		this.serverMode = qp.get(this.queryParameters.serverMode);
		this.visitorId = qp.get(this.queryParameters.visitorId) || this.visitorId; // Fallback to header value if present
		this.flagKeys = qp.getAll(this.queryParameters.keys);
		this.sdkKey = qp.get(this.queryParameters.sdkKey) || this.sdkKey; // Fallback to header value if present
		this.enableResponseMetadata = this.enableResponseMetadata || this.parseBoolean(qp.get(this.queryParameters.enableResponseMetadata));
		if (this.sdkKey && this.settings.enableResponseMetadata) this.configMetadata.sdkKeyFrom = 'Query Parameters';
		this.decideAll = this.parseBoolean(qp.get(this.queryParameters.decideAll));
		//this.trimmedDecisions = this.trimmedDecisions || this.parseBoolean(qp.get(this.queryParameters.trimmedDecisions)) || this.settings.defaultTrimmedDecisions;
		const trimmedDecisionsQueryParam = qp.get(this.queryParameters.trimmedDecisions);
		if (this.trimmedDecisions === undefined && trimmedDecisionsQueryParam === 'false') {
			this.trimmedDecisions = false;
		} else {
			if (this.trimmedDecisions === undefined && trimmedDecisionsQueryParam === 'true') {
				this.trimmedDecisions = true;
			} else if (trimmedDecisionsQueryParam === null) {
				if (this.trimmedDecisions === undefined) this.trimmedDecisions = this.settings.defaultTrimmedDecisions;
			}
		}

		this.disableDecisionEvent = this.parseBoolean(qp.get(this.queryParameters.disableDecisionEvent));
		this.enabledFlagsOnly = this.parseBoolean(qp.get(this.queryParameters.enabledFlagsOnly));
		this.includeReasons = this.parseBoolean(qp.get(this.queryParameters.includeReasons));
		this.ignoreUserProfileService = this.parseBoolean(qp.get(this.queryParameters.ignoreUserProfileService));
		this.excludeVariables = this.excludeVariables || this.parseBoolean(qp.get(this.queryParameters.excludeVariables));
		this.enabledFlagsOnly = this.enabledFlagsOnly || this.parseBoolean(qp.get(this.queryParameters.enabledFlagsOnly));

		if (!this.isPostMethod || this.isPostMethod === undefined) {
			this.setRequestHeaders =
				this.setRequestHeaders || this.parseBoolean(qp.get(this.queryParameters.setRequestHeader)) || this.settings.defaultSetRequestHeaders;
			this.setRequestCookies =
				this.setRequestCookies || this.parseBoolean(qp.get(this.queryParameters.setRequestCookies)) || this.settings.defaultSetRequestCookies;
		}
		this.setResponseHeaders =
			this.setResponseHeaders || this.parseBoolean(qp.get(this.queryParameters.setResponseHeaders)) || this.settings.defaultSetResponseHeaders;
		this.setResponseCookies =
			this.setResponseCookies || this.parseBoolean(qp.get(this.queryParameters.setResponseCookies)) || this.settings.defaultSetResponseCookies;
	}

	/**
	 * Initializes configuration settings from the request body if available.
	 */
	async initializeFromBody() {
		if (this.body) {
			this.visitorId = this.visitorId || this.body.visitorId;
			this.overrideVisitorId = this.overrideVisitorId || this.body.overrideVisitorId || false;
			this.flagKeys = this.flagKeys.length > 0 ? this.flagKeys : this.body.flagKeys;
			this.sdkKey = this.sdkKey || this.body.sdkKey;
			if (this.sdkKey && this.settings.enableResponseMetadata) this.configMetadata.sdkKeyFrom = 'body';
			this.attributes = this.attributes || this.body.attributes;
			if (this.body.attributes && this.settings.enableResponseMetadata) this.configMetadata.attributesFrom = 'body';
			this.eventTags = this.eventTags || this.body.eventTags;
			if (this.body.eventTags && this.settings.enableResponseMetadata) this.configMetadata.eventTagsFrom = 'body';
			this.enableResponseMetadata = this.enableResponseMetadata || this.body.enableResponseMetadata;
			this.forcedDecisions = this.body.forcedDecisions;
			this.enableFlagsFromKV = this.enableFlagsFromKV || this.body.enableFlagsFromKV;
			this.datafileFromKV = this.datafileFromKV || this.body.datafileFromKV;
			this.decideAll = this.decideAll || this.body.decideAll;
			this.disableDecisionEvent = this.disableDecisionEvent || this.body.disableDecisionEvent;
			this.enabledFlagsOnly = this.enabledFlagsOnly || this.body.enabledFlagsOnly;
			this.includeReasons = this.includeReasons || this.body.includeReasons;
			this.ignoreUserProfileService = this.ignoreUserProfileService || this.body.ignoreUserProfileService;
			this.excludeVariables = this.excludeVariables || this.body.excludeVariables;
			// this.trimmedDecisions = this.trimmedDecisions || this.body.trimmedDecisions || this.settings.defaultTrimmedDecisions;
			if (this.trimmedDecisions === undefined && this.body.hasOwnProperty('trimmedDecisions')) {
				if (this.body.trimmedDecisions === false) {
					this.trimmedDecisions = false;
				} else {
					this.trimmedDecisions = true;
				}
			} else {
				if (this.trimmedDecisions === undefined) this.trimmedDecisions = this.trimmedDecisions || this.settings.defaultTrimmedDecisions;
			}

			this.setRequestHeaders = this.setRequestHeaders || this.body.setRequestHeaders || this.settings.defaultSetRequestHeaders;
			this.setResponseHeaders = this.setResponseHeaders || this.body.setResponseHeaders || this.settings.defaultSetResponseHeaders;
			this.setRequestCookies = this.setRequestCookies || this.body.setRequestCookies || this.settings.defaultSetRequestCookies;
			this.setResponseCookies = this.setResponseCookies || this.body.setResponseCookies || this.settings.defaultSetResponseCookies;
		}
	}

	/**
	 * Retrieves a header value by name.
	 * @param {string} name - The name of the header to retrieve.
	 * @returns {string|null} The value of the header or null if not found.
	 */
	getHeader(name, request = this.request) {
		return this.cdnAdapter.getRequestHeader(name, request);
	}

	/**
	 * Converts a string value to a boolean. Returns a default value if the input is null.
	 * @param {string} value - The string value to convert.
	 * @param {boolean} defaultValue - The default value to return if the input is null.
	 * @returns {boolean} The boolean value of the string, or the default value.
	 */
	parseBoolean(value, defaultValue = false) {
		if (value === null) return defaultValue;
		return value.toLowerCase() === 'true';
	}

	/**
	 * Attempts to parse a JSON string safely.
	 * @param {string} value - The JSON string to parse.
	 * @returns {Object|null} The parsed JSON object, or null if parsing fails.
	 */
	parseJson(value) {
		if (!value) return null;
		try {
			return JSON.parse(value);
		} catch (error) {
			console.error('Failed to parse JSON:', error);
			return error;
		}
	}
}
