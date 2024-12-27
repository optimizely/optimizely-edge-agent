/**
 * @module DefaultSettings
 *
 * The DefaultSettings module contains default settings define default values required during the initialization of the edge worker.
 *
 */

const defaultSettings = {
	cdnProvider: 'cloudflare', // Default to Cloudflare - Possible values: cloudflare, fastly, cloudfront, akamai, vercel
	/* Possible values:
        javascript-sdk/vercel-edge-agent
        javascript-sdk/akamai-edgeworker-agent
        javascript-sdk/aws-lambda-at-edge-agent
        javascript-sdk/fastly-agent
        javascript-sdk/cloudflare-agent
    */
	optlyClientEngine: 'javascript-sdk/cloudflare-agent',
	optlyClientEngineVersion: '1.0.0',
	sdkKeyHeader: 'X-Optimizely-SDK-Key',
	sdkKeyQueryParameter: 'sdkKey',
	urlIgnoreQueryParameters: true,
	enableOptimizelyHeader: 'X-Optimizely-Enable-FEX',
	workerOperationHeader: 'X-Optimizely-Worker-Operation',
	optimizelyEventsEndpoint: 'https://logx.optimizely.com/v1/events',
	// Do not include trailing slashes "/" for valid experimentation endpoints
	// TODO - Should we implement KV Storage or use a dedicated flag with a variable containing the endpoints?
	validExperimentationEndpoints: ['https://apidev.expedge.com', 'https://apidev.expedge.com/chart'],
	kv_namespace: 'OPTLY_HYBRID_AGENT_KV',
	kv_key_optly_flagKeys: 'optly_flagKeys',
	kv_key_optly_sdk_datafile: 'optly_sdk_datafile',
	kv_key_optly_js_sdk: 'optly_js_sdk',
	kv_key_optly_variation_changes: 'optly_variation_changes',
	kv_cloudfront_dyanmodb_table: 'OptlyHybridAgentKV',
	kv_cloudfront_dyanmodb_options: {},
	kv_user_profile_enabled: false,
	kv_namespace_user_profile: 'OPTLY_HYBRID_AGENT_UPS_KV',
	// kv_key_optly_user_profile: 'optly_user_profile',
	logLevel: 'debug',
};

export default defaultSettings;

// const defaultSettings = {
// 	kv_namespace: 'OPTLY_HYBRID_AGENT_KV',
// 	kv_key_optly_flagKeys: 'optly_flagKeys',
// 	kv_key_optly_sdk_datafile: 'optly_sdk_datafile',
// 	kv_namespace_user_profile: 'OPTLY_HYBRID_AGENT_UPS_KV',
// };
