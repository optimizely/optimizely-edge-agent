import type { CDNAdapter } from '../cdn';
import type { Decision } from '../events';

type CoreLogicState = {
  cdnAdapter?: CDNAdapter;
  reqResponseObjectType: string;
  allDecisions?: Decision[];
  serializedDecisions?: string;
  cdnExperimentSettings?: {
    cdnExperimentURL?: string;
    cdnResponseURL?: string;
    cacheKey?: string;
    forwardRequestToOrigin?: boolean;
    cacheRequestToOrigin?: boolean;
    isControlVariation?: boolean;
  };
  cdnExperimentURL?: string;
  cdnResponseURL?: string;
  forwardRequestToOrigin?: boolean;
  cacheKey?: string;
  isDecideOperation?: boolean;
  isPostMethod?: boolean;
  isGetMethod?: boolean;
  forwardToOrigin?: boolean;
  activeFlags?: string[];
  savedCookieDecisions?: Decision[];
  validCookiedDecisions?: Decision[];
  invalidCookieDecisions?: Decision[];
  datafileOperation: boolean;
  configOperation: boolean;
  request?: Request;
}

export type { CoreLogicState };
