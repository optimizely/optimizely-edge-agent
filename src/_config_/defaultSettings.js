/**
 * @module DefaultSettings
 * 
 * The DefaultSettings module contains default settings define default values required during the initialization of the edge worker.
 * 
 */

const defaultSettings = {
	cdnProvider: 'cloudflare', // Default to Cloudflare - Possible values: cloudflare, fastly, cloudfront, akamai,
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
	urlIgnoreQueryParameters: true,
	enableOptimizelyHeader: 'X-Optimizely-Enable-FEX',
	workerOperationHeader: 'X-Optimizely-Worker-Operation',
	optimizelyEventsEndpoint: 'https://logx.optimizely.com/v1/events',
	validExperimentationEndpoints: ['https://apidev.expedge.com', 'https://apidev.expedge.com/chart'],
	kv_namespace: 'OPTLY_HYBRID_AGENT_KV',
	kv_key_optly_flagKeys: 'optly_flagKeys',
	kv_key_optly_sdk_datafile: 'optly_sdk_datafile',
	kv_key_optly_js_sdk: 'optly_js_sdk',
	kv_key_optly_variation_changes: 'optly_variation_changes',
    kv_cloudfront_dyanmodb_table: 'OptlyHybridAgentKV',
    kv_cloudfront_dyanmodb_options: {},
	logLevel: 'debug',
};

export default defaultSettings;
