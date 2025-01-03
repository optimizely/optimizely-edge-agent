import type { BaseSettings } from '../../types/config';

const DefaultSettings: BaseSettings = {
  cdnProvider: 'cloudflare',
  optlyClientEngine: 'javascript-sdk/cloudflare-agent',
  optlyClientEngineVersion: '1.0.0',
  sdkKeyHeader: 'X-Optimizely-SDK-Key',
  sdkKeyQueryParameter: 'sdkKey',
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
  kv_user_profile_enabled: false,
  kv_namespace_user_profile: 'OPTLY_HYBRID_AGENT_UPS_KV',
  logLevel: 'debug',
};

export default DefaultSettings;
