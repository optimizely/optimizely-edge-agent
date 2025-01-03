/**
 * Type for CDN variation settings
 */
type CDNVariationSettings = {
  cdnExperimentURL?: string;
  cdnResponseURL?: string;
  cacheKey?: string;
  forwardRequestToOrigin?: boolean;
  cacheRequestToOrigin?: boolean;
  isControlVariation?: boolean;
}

export type { CDNVariationSettings };
