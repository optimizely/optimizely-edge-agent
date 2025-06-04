# Forced Variations via Headers - Implementation Plan

## MISSION FOR AI AGENT
You are tasked with implementing forced variations support via headers, query parameters, and request body in the Optimizely Edge Agent. This functionality allows clients to pass forced decisions directly in requests without using the API endpoints. You MUST follow the existing code patterns exactly - do not create new utilities or deviate from the established patterns.

## VALIDATION REQUIREMENT
Before starting, confirm that:
- The investigation statement "forced variations via headers are missing" is accurate
- The existing API endpoints for forced variations work correctly
- The `x-optimizely-forced-decisions` header is defined but not processed

## FILES TO MODIFY

### Required Files (MUST MODIFY):
1. `src-v2/services/implementations/ConfigurationService.ts` - Add forced decisions parsing
2. `src-v2/services/implementations/ApiRouter.ts` - Integrate forced decisions into decision making

### Files Already Correct (DO NOT MODIFY):
- `src-v2/services/interfaces/IConfigurationService.ts` - Already has `forcedDecisions?: Record<string, any> | null;`
- `src-v2/services/implementations/DecisionService.ts` - Already supports `forcedDecisions` in user context

## IMPLEMENTATION STEPS

### STEP 1: Update ConfigurationService.ts - Header Extraction

**Location:** `src-v2/services/implementations/ConfigurationService.ts`
**Method:** `extractHeaderValues`
**Insert Location:** After line 448 (right after the attributes parsing block)

```typescript
		// Forced Decisions
		try {
			const forcedDecisionsHeader = this.getHeader(request, 'x-optimizely-forced-decisions', requestId);
			if (forcedDecisionsHeader) {
				const parsedForcedDecisions = JSON.parse(forcedDecisionsHeader);
				if (typeof parsedForcedDecisions === 'object' && parsedForcedDecisions !== null) {
					values.forcedDecisions = parsedForcedDecisions;
					this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] FORCED DECISIONS FOUND - Parsed and set`);
					if (setSource) this.setMetadataSourceField('forcedDecisions', 'header');
				}
			}
		} catch (e) {
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Failed to parse forced decisions header: ${e}`);
		}
```

**Verification:** Check that the code follows the exact same pattern as the attributes parsing block above it.

### STEP 2: Update ConfigurationService.ts - Query Parameter Extraction

**Location:** `src-v2/services/implementations/ConfigurationService.ts`
**Method:** `extractQueryValues`
**Insert Location:** After line 686 (right after the attributes parsing block in query values)

```typescript
		// Forced Decisions
		try {
			const forcedDecisionsParam = getParamCaseInsensitive('forced_decisions');
			if (forcedDecisionsParam) {
				const parsedForcedDecisions = JSON.parse(forcedDecisionsParam);
				if (typeof parsedForcedDecisions === 'object' && parsedForcedDecisions !== null) {
					values.forcedDecisions = parsedForcedDecisions;
					if (setSource) this.setMetadataSourceField('forcedDecisions', 'query');
				}
			}
		} catch (e) {
			this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Failed to parse forced decisions from query params: ${e}`);
		}
```

**Verification:** Check that this follows the exact same pattern as the attributes query parsing.

### STEP 3: Update ConfigurationService.ts - Request Body Extraction

**Location:** `src-v2/services/implementations/ConfigurationService.ts`
**Method:** `extractBodyValues`
**Insert Location:** After line 810 (right after the attributes parsing block in body values)

```typescript
			// Forced Decisions
			const forcedDecisionsValue = getBodyPropCaseInsensitive('forced_decisions');
			if (forcedDecisionsValue !== undefined && typeof forcedDecisionsValue === 'object' && forcedDecisionsValue !== null) {
				values.forcedDecisions = forcedDecisionsValue;
				if (setSource) this.setMetadataSourceField('forcedDecisions', 'body');
			}
```

**Verification:** Check that this follows the exact same pattern as the attributes body parsing.

### STEP 4: Update ApiRouter.ts - Integrate Forced Decisions

**Location:** `src-v2/services/implementations/ApiRouter.ts`
**Method:** `handleDecideRequest`
**Modification Location:** Around line 2240-2250 (before the decision service call)

**FIND this existing code:**
```typescript
        const decision = await this.decisionService.getDecision(
          finalUserId,
          flagKey,
          attributes,
          options
        );
```

**REPLACE with this code:**
```typescript
        // Extract forced decisions from configuration and prepare user context
        const config = this.configService.getConfig();
        let userContextForcedDecisions: Record<string, { variationKey: string }> = {};
        
        if (config.forcedDecisions) {
          // Convert configuration forced decisions to the format expected by DecisionService
          if (Array.isArray(config.forcedDecisions)) {
            // Array format: [{ flagKey: "flag1", variationKey: "var1" }, ...]
            for (const decision of config.forcedDecisions) {
              if (decision.flagKey && decision.variationKey) {
                userContextForcedDecisions[decision.flagKey] = { variationKey: decision.variationKey };
              }
            }
          } else if (typeof config.forcedDecisions === 'object') {
            // Object format: { "flag1": { "variationKey": "var1" }, ... }
            for (const [flagKey, decision] of Object.entries(config.forcedDecisions)) {
              if (decision && typeof decision === 'object' && (decision as any).variationKey) {
                userContextForcedDecisions[flagKey] = { variationKey: (decision as any).variationKey };
              }
            }
          }
          
          if (Object.keys(userContextForcedDecisions).length > 0) {
            this.logger.debug(`${this.logPrefix} [REQUEST:${requestId}] Processed forced decisions from config:`, {
              flagCount: Object.keys(userContextForcedDecisions).length,
              flags: Object.keys(userContextForcedDecisions)
            });
          }
        }
        
        // Create extended user context with forced decisions
        const extendedUserContext: any = {
          userId: finalUserId,
          attributes,
          forcedDecisions: userContextForcedDecisions
        };
        
        const decision = await this.decisionService.decide(
          flagKey,
          extendedUserContext,
          options
        );
```

**Verification:** Ensure the decision service call changes from `getDecision()` to `decide()` with the extended user context.

### STEP 5: Apply Same Changes to DecideAll Method

**Location:** `src-v2/services/implementations/ApiRouter.ts`
**Method:** `handleDecideAllRequest`
**Action:** Apply similar forced decisions extraction logic before the batch decision calls

**Find the existing decision service calls in handleDecideAllRequest and apply the same forced decisions extraction pattern.**

## SUPPORTED INPUT FORMATS

### 1. Header Format
```bash
X-Optimizely-Forced-Decisions: {"feature_1":{"variationKey":"on","ruleKey":"exp_123"},"feature_2":{"variationKey":"off"}}
```

### 2. Query Parameter Format
```bash
GET /api/decide?flagKey=feature_1&forced_decisions={"feature_1":{"variationKey":"on"}}
```

### 3. Request Body Format
```json
{
  "flagKey": "feature_1",
  "userId": "user123",
  "forcedDecisions": {
    "feature_1": {"variationKey": "on"},
    "feature_2": {"variationKey": "off"}
  }
}
```

### 4. Array Format (Alternative)
```json
{
  "flagKey": "feature_1",
  "userId": "user123",
  "forcedDecisions": [
    {"flagKey": "feature_1", "variationKey": "on", "ruleKey": "exp_123"},
    {"flagKey": "feature_2", "variationKey": "off"}
  ]
}
```

## PRECEDENCE ORDER
Header > Query Parameter > Request Body (same as all other parameters)

## TESTING CHECKLIST

After implementation, verify:

- [ ] Headers are parsed correctly and applied to decisions
- [ ] Query parameters work as fallback when headers not present
- [ ] Request body works as final fallback
- [ ] Precedence order is respected (header > query > body)
- [ ] Invalid JSON in headers/params logs warning but doesn't crash
- [ ] Normal decisions work when no forced decisions provided
- [ ] Multiple forced decisions can be applied in batch requests
- [ ] Logging shows forced decisions being extracted and applied
- [ ] Existing API endpoints for forced variations still work unchanged

## ERROR HANDLING REQUIREMENTS

- JSON parsing errors must be caught and logged as debug messages
- Invalid forced decision formats should be ignored, not crash the request
- Forced decisions that cannot be applied should log warnings but allow normal decisions
- All forced decision processing should be non-blocking to normal decision flow

## INTEGRATION NOTES

- The existing DecisionService.decide() method already supports forcedDecisions in user context
- No new utilities or parsers need to be created
- Follow the exact same logging, metadata tracking, and error handling patterns as attributes
- Use the same case-insensitive parameter lookup helpers already implemented

## COMPLETION VERIFICATION

Implementation is complete when:
1. All code changes follow existing patterns exactly
2. Forced decisions can be passed via headers, query params, and body
3. Precedence order is respected
4. Error handling is robust and non-blocking
5. Logging clearly shows forced decisions being processed
6. All existing functionality continues to work unchanged

## DANGER ZONES

DO NOT:
- Create new parsing utilities (use existing patterns)
- Modify the DecisionService forced decision logic (already works)
- Change existing API endpoint behavior
- Break existing precedence patterns for other parameters
- Add complex validation beyond basic type checking

The implementation should be minimal, follow existing patterns exactly, and integrate seamlessly with the current architecture.