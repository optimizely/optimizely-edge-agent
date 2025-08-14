# Decision Options API

Get available decision options for the decision endpoints.

## Overview

The `/api/decide-options` endpoint provides:
- **Available decision options** for all SDKs
- **SDK-specific usage examples**
- **Option descriptions** and effects
- **Version compatibility** information

## Authentication

**Required Headers:**
```http
X-Optimizely-Enable-FEX: true
X-Optimizely-SDK-Key: your-sdk-key
```

## GET /api/decide-options

Retrieve all available decision options.

### Response Format

**Success Response (200):**
```json
{
  "sdkVersions": {
    "javascript": {
      "latestVersion": "4.9.4",
      "options": [
        {
          "key": "INCLUDE_REASONS",
          "description": "Include decision reasons in the response",
          "usage": "OptimizelyDecideOption.INCLUDE_REASONS"
        },
        {
          "key": "EXCLUDE_VARIABLES",
          "description": "Exclude variables data from the response",
          "usage": "OptimizelyDecideOption.EXCLUDE_VARIABLES"
        },
        {
          "key": "ENABLED_FLAGS_ONLY",
          "description": "Only return flags that are enabled for the user",
          "usage": "OptimizelyDecideOption.ENABLED_FLAGS_ONLY"
        },
        {
          "key": "IGNORE_USER_PROFILE_SERVICE",
          "description": "Ignore the user profile service when making decisions",
          "usage": "OptimizelyDecideOption.IGNORE_USER_PROFILE_SERVICE"
        },
        {
          "key": "DISABLE_DECISION_EVENT",
          "description": "Disable tracking decision events",
          "usage": "OptimizelyDecideOption.DISABLE_DECISION_EVENT"
        }
      ]
    },
    "react": {
      "latestVersion": "2.9.4",
      "options": [/* same structure */]
    },
    "node": {
      "latestVersion": "4.9.4",
      "options": [/* same structure */]
    }
  },
  "apiUsage": {
    "example": {
      "request": {
        "method": "POST",
        "url": "/api/decide",
        "body": {
          "sdkKey": "SDK_KEY",
          "flagKey": "my_flag",
          "userId": "user123",
          "decideOptions": ["INCLUDE_REASONS", "ENABLED_FLAGS_ONLY"]
        }
      }
    }
  }
}
```

## POST /api/decide-options

Same as GET - returns available options. POST support allows for consistent API patterns.

## Decision Options Reference

### INCLUDE_REASONS
**Purpose**: Include detailed decision-making logic in response

**Use Cases**:
- Debugging targeting rules
- QA testing variations
- Understanding bucketing logic

**Example Response with INCLUDE_REASONS**:
```json
{
  "enabled": true,
  "variationKey": "treatment",
  "reasons": [
    "Evaluating feature flag \"premium_features\".",
    "Starting to evaluate audience \"2468910975\" with conditions \"[\"and\", [\"or\", [\"or\", {\"name\": \"country\", \"type\": \"custom_attribute\", \"match\":\"exact\", \"value\": \"US\"}]]]\".",
    "Audience \"2468910975\" evaluated to true.",
    "User \"user123\" is in variation \"treatment\" of experiment \"premium_features_experiment\"."
  ]
}
```

### EXCLUDE_VARIABLES
**Purpose**: Omit variable values from decision response

**Use Cases**:
- Reduce response payload size
- When only enabled/disabled state needed
- Performance optimization

**Example Response with EXCLUDE_VARIABLES**:
```json
{
  "enabled": true,
  "variationKey": "treatment",
  "flagKey": "checkout_flow",
  "variables": {}  // Empty when excluded
}
```

### ENABLED_FLAGS_ONLY
**Purpose**: Filter response to only include enabled flags

**Use Cases**:
- Simplify client-side logic
- Reduce response processing
- Focus on active features

**Effect on decide-all**:
```json
// Without ENABLED_FLAGS_ONLY: All flags returned
{
  "feature_a": { "enabled": true, ... },
  "feature_b": { "enabled": false, ... },
  "feature_c": { "enabled": true, ... }
}

// With ENABLED_FLAGS_ONLY: Only enabled flags
{
  "feature_a": { "enabled": true, ... },
  "feature_c": { "enabled": true, ... }
}
```

### IGNORE_USER_PROFILE_SERVICE
**Purpose**: Skip sticky bucketing for this request

**Use Cases**:
- Testing different variations
- Bot/crawler traffic
- One-time decisions

**Behavior**:
- Ignores stored user profile
- Makes fresh bucketing decision
- Doesn't update user profile

### DISABLE_DECISION_EVENT
**Purpose**: Prevent sending decision events to Optimizely

**Use Cases**:
- Bot/crawler requests
- Internal testing
- Pre-flight checks
- Cost optimization

**Effect**:
- Decision made normally
- No event sent to Optimizely
- No impact on results/metrics

## Usage Examples

### Get Available Options
```bash
curl -X GET "https://your-deployment/api/decide-options" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key"
```

### Using Options in Decisions

#### Debug Mode
```javascript
// Get detailed reasoning for QA
const debugDecision = await fetch('/api/decide', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Optimizely-Enable-FEX': 'true',
    'X-Optimizely-SDK-Key': SDK_KEY
  },
  body: JSON.stringify({
    flagKey: 'complex_targeting_flag',
    userId: 'qa_tester_001',
    decideOptions: ['INCLUDE_REASONS']
  })
});
```

#### Performance Mode
```javascript
// Minimal payload for high-frequency calls
const lightDecision = await fetch('/api/decide', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Optimizely-Enable-FEX': 'true',
    'X-Optimizely-SDK-Key': SDK_KEY
  },
  body: JSON.stringify({
    flagKey: 'simple_toggle',
    userId: userId,
    decideOptions: ['EXCLUDE_VARIABLES', 'DISABLE_DECISION_EVENT']
  })
});
```

#### Enabled Features Only
```javascript
// Get only active features for UI rendering
const activeFeatures = await fetch('/api/decide-all', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Optimizely-Enable-FEX': 'true',
    'X-Optimizely-SDK-Key': SDK_KEY
  },
  body: JSON.stringify({
    userId: userId,
    decideOptions: ['ENABLED_FLAGS_ONLY', 'EXCLUDE_VARIABLES']
  })
});
```

## Combining Options

Options can be combined for specific behaviors:

### QA Testing Combo
```json
{
  "decideOptions": [
    "INCLUDE_REASONS",
    "IGNORE_USER_PROFILE_SERVICE",
    "DISABLE_DECISION_EVENT"
  ]
}
```
- Get detailed reasoning
- Fresh bucketing each time
- No impact on metrics

### Production Performance Combo
```json
{
  "decideOptions": [
    "EXCLUDE_VARIABLES",
    "ENABLED_FLAGS_ONLY"
  ]
}
```
- Minimal response size
- Only active features
- Full event tracking

### Bot Traffic Combo
```json
{
  "decideOptions": [
    "DISABLE_DECISION_EVENT",
    "IGNORE_USER_PROFILE_SERVICE"
  ]
}
```
- No metric pollution
- No profile storage
- Consistent handling

## SDK Integration

### JavaScript/React
```javascript
import { OptimizelyDecideOption } from '@optimizely/optimizely-sdk';

const decision = await optimizely.decide(
  'my_flag',
  [
    OptimizelyDecideOption.INCLUDE_REASONS,
    OptimizelyDecideOption.EXCLUDE_VARIABLES
  ]
);
```

### Node.js
```javascript
const { OptimizelyDecideOption } = require('@optimizely/optimizely-sdk');

const options = [
  OptimizelyDecideOption.ENABLED_FLAGS_ONLY
];

const allDecisions = userContext.decideAll(options);
```

## Performance Impact

| Option | Response Size | Processing Time | Use Case |
|--------|--------------|-----------------|----------|
| None | Baseline | Baseline | Standard usage |
| INCLUDE_REASONS | +50-200% | +5-10ms | Debugging only |
| EXCLUDE_VARIABLES | -20-80% | Minimal | High frequency |
| ENABLED_FLAGS_ONLY | -Variable | Minimal | UI rendering |
| IGNORE_USER_PROFILE_SERVICE | Same | -5-10ms | Testing |
| DISABLE_DECISION_EVENT | Same | -Network call | Bots/Testing |

## Best Practices

### 1. Use Options Purposefully
```javascript
// Bad: Always including all options
const decision = await decide(flag, user, [
  'INCLUDE_REASONS',
  'EXCLUDE_VARIABLES',
  'ENABLED_FLAGS_ONLY',
  'IGNORE_USER_PROFILE_SERVICE',
  'DISABLE_DECISION_EVENT'
]);

// Good: Options for specific purpose
const debugDecision = await decide(flag, user, ['INCLUDE_REASONS']);
const prodDecision = await decide(flag, user, ['EXCLUDE_VARIABLES']);
```

### 2. Environment-Based Options
```javascript
const getDecideOptions = (environment) => {
  switch(environment) {
    case 'development':
      return ['INCLUDE_REASONS', 'DISABLE_DECISION_EVENT'];
    case 'staging':
      return ['INCLUDE_REASONS'];
    case 'production':
      return ['EXCLUDE_VARIABLES'];
    default:
      return [];
  }
};
```

### 3. Cache Option Sets
```javascript
const OPTION_SETS = {
  debug: ['INCLUDE_REASONS', 'DISABLE_DECISION_EVENT'],
  performance: ['EXCLUDE_VARIABLES', 'ENABLED_FLAGS_ONLY'],
  bot: ['DISABLE_DECISION_EVENT', 'IGNORE_USER_PROFILE_SERVICE'],
  standard: []
};

function getOptions(mode = 'standard') {
  return OPTION_SETS[mode] || OPTION_SETS.standard;
}
```

## Related Endpoints

- **[Individual Decision](./decide.md)** - Using options with single flag
- **[Batch Decisions](./decide-for-keys.md)** - Using options with multiple flags
- **[All Decisions](./decide-all.md)** - Using options with all flags

---

**Implementation Source**: `/src-v2/services/implementations/ApiRouter.ts:1832-1940`  
**Last Updated**: 2025-05-28