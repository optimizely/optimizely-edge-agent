# Optimizely JavaScript (Node.js) SDK Reference

## Table of Contents
1. [SDK Overview](#sdk-overview)
2. [Installation](#installation)
3. [Initialization](#initialization)
   - [Using SDK Key](#using-sdk-key)
   - [Using Datafile](#using-datafile)
   - [Configuration Options](#configuration-options)
4. [Core Concepts](#core-concepts)
   - [User Context](#user-context)
   - [Feature Flags and Experiments](#feature-flags-and-experiments)
   - [Events](#events)
5. [OptimizelyUserContext](#optimizelyusercontext)
   - [Methods](#user-context-methods)
   - [Properties](#user-context-properties)
6. [Decision Methods](#decision-methods)
   - [Decide](#decide)
   - [DecideAll](#decideall)
   - [DecideForKeys](#decideforkeys)
   - [Decision Options](#decision-options)
7. [OptimizelyDecision Object](#optimizelydecision-object)
8. [OptimizelyConfig API](#optimizelyconfig-api)
9. [Real-Time Segments](#real-time-segments)
10. [Resource Management](#resource-management)

## SDK Overview

The Optimizely JavaScript (Node.js) SDK allows you to implement feature flags, A/B tests, and feature experiments in Node.js applications. The SDK handles flag evaluations based on user attributes and audience targeting, while also tracking events to measure impact.

**Minimum versions for key features:**
- OptimizelyUserContext: v3.7+
- Forced decision methods: v3.10.0+
- Real-Time Segments: v5.0.0+

## Installation

```bash
npm install @optimizely/optimizely-sdk
```

## Initialization

The SDK can be initialized using either an SDK key (recommended) or a datafile.

### Using SDK Key

```javascript
const { createInstance } = require('@optimizely/optimizely-sdk');

const optimizely = createInstance({
  sdkKey: '<YOUR_SDK_KEY>'
});

// Check if initialization was successful
if (optimizely) {
  optimizely.onReady().then(({ success, reason }) => {
    if (success) {
      // SDK is ready to use
    } else {
      console.log(`Initialization failed: ${reason}`);
    }
  });
} else {
  // Handle initialization error
}
```

### Using Datafile

```javascript
const { createInstance } = require('@optimizely/optimizely-sdk');
const fetch = require('node-fetch');

// Fetch datafile from CDN
const sdkKey = '<YOUR_SDK_KEY>';
const DATAFILE_URL = `https://cdn.optimizely.com/datafiles/${sdkKey}.json`;

async function initializeWithDatafile() {
  const response = await fetch(DATAFILE_URL);
  const datafile = await response.json();
  
  const optimizely = createInstance({
    datafile
  });
  
  return optimizely;
}
```

### Configuration Options

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| sdkKey | string | Key associated with environment | Either sdkKey or datafile |
| datafile | string | JSON string of project config | Either sdkKey or datafile |
| eventDispatcher | object | Custom event dispatcher | Optional |
| logger | object | Custom logger implementation | Optional |
| errorHandler | object | Custom error handler | Optional |
| userProfileService | object | Service for user profile persistence | Optional |
| datafileOptions | object | Datafile management configuration | Optional |
| defaultDecideOptions | Array | Default options for all decide calls | Optional |
| ODPManager | object | Real-Time Segments configuration | Optional |

Datafile Options:
- `autoUpdate`: (boolean) Enable automatic updates when sdkKey provided (default: true)
- `updateInterval`: (number) Interval in milliseconds for updates (default: 300000)
- `urlTemplate`: (string) Custom URL template for datafile requests
- `datafileAccessToken`: (string) Token for authenticated datafile endpoints

## Core Concepts

### User Context

A user context represents an end-user and contains their ID and attributes:

```javascript
const userContext = optimizely.createUserContext('user123', {
  logged_in: true,
  country: 'US',
  age: 28
});
```

### Feature Flags and Experiments

Feature flags control feature visibility and variables. Experiments test variations:

```javascript
// Check if feature is enabled
const decision = userContext.decide('product_sort');
if (decision.enabled) {
  // Feature is enabled for this user
  const sortMethod = decision.variables.sort_method;
  // Use the sort method
}
```

### Events

Track custom events for measuring impact:

```javascript
// Track a conversion event
userContext.trackEvent('purchased', {
  revenue: 125.50,
  items: 3
});
```

## OptimizelyUserContext

The `OptimizelyUserContext` object is created using `optimizely.createUserContext()` and provides methods for feature flag decisions and event tracking.

### User Context Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| setAttribute | Set a user attribute | key (string), value (any) | void |
| getAttributes | Get all user attributes | None | Object |
| decide | Get decision for a single flag | key (string), options (Array) | OptimizelyDecision |
| decideForKeys | Get decisions for multiple flags | keys (string[]), options (Array) | Object<string, OptimizelyDecision> |
| decideAll | Get decisions for all flags | options (Array) | Object<string, OptimizelyDecision> |
| trackEvent | Track a conversion event | eventName (string), eventTags (Object) | void |
| setForcedDecision | Force a variation for context | context (Object), decision (Object) | boolean |
| getForcedDecision | Get forced decision for context | context (Object) | Object |
| removeForcedDecision | Remove forced decision | context (Object) | boolean |
| removeAllForcedDecisions | Remove all forced decisions | None | boolean |
| fetchQualifiedSegments | Fetch user segments | options (Array), callback | Promise |
| isQualifiedFor | Check segment qualification | segment (string) | boolean |

### User Context Properties

| Property | Type | Description |
|----------|------|-------------|
| userId | string | User identifier |
| attributes | Object | User attributes map |
| qualifiedSegments | Array | Real-Time Segments the user belongs to |

## Decision Methods

### Decide

Evaluates which flag variation a user falls into:

```javascript
const decision = userContext.decide('product_sort');

// Access decision properties
const variationKey = decision.variationKey;  // Variation assigned
const enabled = decision.enabled;            // Flag enabled state
const variables = decision.variables;        // All flag variables
const reasons = decision.reasons;            // Decision reasons (if requested)
```

### DecideAll

Returns decisions for all active flags:

```javascript
const allDecisions = userContext.decideAll();
// Access specific flag decision
const productSortDecision = allDecisions['product_sort'];
```

### DecideForKeys

Returns decisions for specific flags:

```javascript
const specificDecisions = userContext.decideForKeys(['product_sort', 'checkout_flow']);
```

### Decision Options

Control decision behavior with `OptimizelyDecideOption` enums:

```javascript
const { OptimizelyDecideOption } = require('@optimizely/optimizely-sdk');

const decision = userContext.decide('product_sort', [
  OptimizelyDecideOption.INCLUDE_REASONS,
  OptimizelyDecideOption.DISABLE_DECISION_EVENT
]);
```

Available options:
- `DISABLE_DECISION_EVENT`: Prevents impression events (no Results page impact)
- `ENABLED_FLAGS_ONLY`: Return only enabled flags (decideAll/decideForKeys only)
- `IGNORE_USER_PROFILE_SERVICE`: Skip user profile service lookup/save
- `INCLUDE_REASONS`: Include decision reasons in response
- `EXCLUDE_VARIABLES`: Skip variable values in response (for large variables)

## OptimizelyDecision Object

The decision object returned by decide methods:

| Property | Type | Description |
|----------|------|-------------|
| variationKey | string | The assigned variation (null on error) |
| enabled | boolean | Flag enabled state |
| variables | Object | Map of all variable values |
| ruleKey | string | Key of the rule that decided this flag |
| flagKey | string | Key of the evaluated flag |
| userContext | Object | User context for this decision |
| reasons | Array<string> | Decision reasons (when INCLUDE_REASONS option used) |

## OptimizelyConfig API

Access static project configuration data:

```javascript
const config = optimizely.getOptimizelyConfig();

// Access project information
console.log(`Revision: ${config.revision}`);
console.log(`Environment: ${config.environmentKey}`);

// Access features (flags)
const flagData = config.featuresMap['product_sort'];
console.log(`Flag ID: ${flagData.id}`);

// Access experiments
flagData.experimentRules.forEach(experiment => {
  console.log(`Experiment: ${experiment.key}`);
  
  // Access variations
  Object.keys(experiment.variationsMap).forEach(variationKey => {
    const variation = experiment.variationsMap[variationKey];
    console.log(`Variation: ${variationKey}`);
    
    // Access variables
    Object.keys(variation.variablesMap).forEach(variableKey => {
      const variable = variation.variablesMap[variableKey];
      console.log(`Variable ${variableKey}: ${variable.value}`);
    });
  });
});

// Get raw datafile
const datafileJson = config.getDatafile();
```

## Real-Time Segments

Available in SDK v5.0.0+, allows for audience segmentation:

```javascript
// Fetch segments for the user
userContext.fetchQualifiedSegments([], (error, segments) => {
  if (!error) {
    console.log(`User is in segments: ${segments.join(', ')}`);
    
    // Check specific segment
    if (userContext.isQualifiedFor('high_value_customer')) {
      // User is in the high value segment
    }
  }
});
```

## Resource Management

Always close the Optimizely client when no longer needed to prevent memory leaks:

```javascript
// When shutting down or no longer needing the client
optimizely.close();
```