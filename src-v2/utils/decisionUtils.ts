/**
 * Serializes a subset of decision objects based on provided criteria.
 *
 * @param {Array} decisionsArray - Array of decision objects from Optimizely.
 * @param {boolean} excludeVariables - Whether to exclude variables from the serialized decisions.
 * @param {boolean} includeReasons - Whether to include reasons in the serialized decisions.
 * @param {boolean} enabledFlagsOnly - If true, only decisions where the flag is enabled are included.
 * @param {boolean} trimmedDecisions - If true, the userContext is not included in the response JSON
 * @param {string} httpMethod - Request HTTP method
 * @returns {Array} - Array of serialized decision objects.
 */
export function getSerializedArray(
  decisionsArray: any[],
  excludeVariables: boolean,
  includeReasons: boolean,
  enabledFlagsOnly: boolean,
  trimmedDecisions: boolean,
  httpMethod: string,
): any[] {
  if (!Array.isArray(decisionsArray)) {
    throw new Error('Invalid input: decisionsArray must be an array.');
  }

  const result = decisionsArray
    .filter((decision) => {
      return (
        (!enabledFlagsOnly || decision.enabled) && // Filter based on flag enabled status
        (httpMethod === 'POST' ||
          (httpMethod === 'GET' && decision.variationKey && !decision.ruleKey?.includes('-rollout-')))
      );
    })
    .map((decision) => {
      let decisionObject: any = {
        flagKey: decision.flagKey,
        variationKey: decision.variationKey,
        ruleKey: decision.ruleKey,
        enabled: decision.enabled,
      };

      if (!excludeVariables) {
        decisionObject.variables = decision.variables;
      }

      if (includeReasons) {
        decisionObject.reasons = decision.reasons;
      }

      return decisionObject;
    });

  return result;
} 