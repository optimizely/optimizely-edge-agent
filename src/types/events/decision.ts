/**
 * Type representing a feature flag or experiment decision
 */
type Decision = {
  flagKey: string;
  variationKey: string;
  enabled?: boolean;
  variables?: Record<string, unknown>;
  ruleKey?: string;
  reasons?: string[];
}

type RequestMetadata = {
  visitorId?: {
    value: string;
    source: string;
  };
  flagKeys?: string[];
  decisions?: {
    valid?: number;
    invalid?: number;
    forced?: number;
  };
  datafile?: {
    revision?: string;
    origin?: string;
  };
}

export type { Decision, RequestMetadata };
