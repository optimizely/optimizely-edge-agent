export type BaseSettings = {
  cdnProvider: string;
  optlyClientEngine: string;
  optlyClientEngineVersion: string;
  sdkKeyHeader: string;
  sdkKeyQueryParameter: string;
  urlIgnoreQueryParameters: boolean;
  enableOptimizelyHeader: string;
  workerOperationHeader: string;
  optimizelyEventsEndpoint: string;
  validExperimentationEndpoints: string[];
  kv_namespace: string;
  kv_key_optly_flagKeys: string;
  kv_key_optly_sdk_datafile: string;
  kv_key_optly_js_sdk: string;
  kv_key_optly_variation_changes: string;
  kv_cloudfront_dyanmodb_table: string;
  kv_cloudfront_dyanmodb_options: Record<string, unknown>;
  kv_user_profile_enabled: boolean;
  kv_namespace_user_profile: string;
  logLevel: string;
};
