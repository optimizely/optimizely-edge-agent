// defaultSettings.js
const defaultSettings = {
    useIttyRouter: true,
    cdnProvider: "cloudflare", // Default to Cloudflare - Possible values: cloudflare, fastly, cloudfront, akamai,
    sdkKeyHeader: "X-Optimizely-SDK-Key",
    urlIgnoreQueryParameters: true,
    enableOptimizelyHeader: 'X-Optimizely-Enable-FEX',
    workerOperationHeader: 'X-Optimizely-Worker-Operation',
    optimizelyEventsEndpoint: "https://logx.optimizely.com/v1/events",
    validExperimentationEndpoints: ["https://apidev.expedge.com", "https://apidev.expedge.com/chart"],
    kv_namespace: 'OPTLY_HYBRID_AGENT_KV',
    kv_key_optly_flagKeys: 'optly_flagKeys',
    kv_key_optly_sdk_datafile: 'optly_sdk_datafile',
    kv_key_optly_js_sdk: 'optly_js_sdk',
    kv_key_optly_variation_changes: 'optly_variation_changes',
};

export default defaultSettings; 
