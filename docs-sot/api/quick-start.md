# Quick Start Guide

Get started with the Optimizely Edge Agent API in 5 minutes.

## Prerequisites

Before you begin, you'll need:
- **Optimizely SDK Key** - From your Optimizely project settings
- **Edge Agent URL** - Your deployment endpoint
- **Admin Token** (optional) - For administrative operations

## Step 1: Verify Edge Agent is Running

Check that the Edge Agent is accessible:

```bash
curl -X GET "https://your-deployment/api/sdk" \
  -H "X-Optimizely-Enable-FEX: true"
```

Expected response:
```json
{
  "name": "optimizely-edge-agent",
  "version": "unknown",
  "environment": "unknown",
  "cdnProvider": "unknown"
}
```

## Step 2: Make Your First Decision

Get a feature flag decision for a user:

```bash
curl -X POST "https://your-deployment/api/decide" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY" \
  -d '{
    "flagKey": "YOUR_FLAG_KEY",
    "userId": "test_user_123"
  }'
```

Expected response:
```json
{
  "enabled": true,
  "variationKey": "treatment",
  "flagKey": "YOUR_FLAG_KEY",
  "ruleKey": "targeting_rule_1",
  "variables": {
    "button_color": "#00FF00"
  },
  "reasons": []
}
```

## Step 3: Add User Attributes

Target specific users with attributes:

```bash
curl -X POST "https://your-deployment/api/decide" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY" \
  -d '{
    "flagKey": "premium_feature",
    "userId": "user_456",
    "attributes": {
      "plan": "premium",
      "country": "US",
      "beta_tester": true
    }
  }'
```

## Step 4: Get Multiple Decisions

Fetch decisions for multiple flags at once:

```bash
curl -X POST "https://your-deployment/api/decide-for-keys" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY" \
  -d '{
    "flagKeys": ["feature_a", "feature_b", "feature_c"],
    "userId": "user_789",
    "attributes": {
      "device": "mobile"
    }
  }'
```

## JavaScript Quick Start

### Basic Setup

```javascript
// config.js
const EDGE_AGENT_URL = 'https://your-deployment';
const SDK_KEY = 'YOUR_SDK_KEY';

// Create a simple client
class EdgeAgentClient {
  constructor(baseUrl, sdkKey) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      'X-Optimizely-Enable-FEX': 'true',
      'X-Optimizely-SDK-Key': sdkKey
    };
  }

  async decide(flagKey, userId, attributes = {}) {
    const response = await fetch(`${this.baseUrl}/api/decide`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ flagKey, userId, attributes })
    });

    if (!response.ok) {
      throw new Error(`Decision failed: ${response.status}`);
    }

    return response.json();
  }

  async decideAll(userId, attributes = {}) {
    const response = await fetch(`${this.baseUrl}/api/decide-all`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ userId, attributes })
    });

    if (!response.ok) {
      throw new Error(`Decide all failed: ${response.status}`);
    }

    return response.json();
  }
}

// Initialize client
const client = new EdgeAgentClient(EDGE_AGENT_URL, SDK_KEY);
```

### Using the Client

```javascript
// Get a single decision
async function checkFeature() {
  try {
    const decision = await client.decide(
      'new_checkout_flow',
      'user_123',
      { country: 'US', plan: 'premium' }
    );

    if (decision.enabled) {
      console.log('Feature is enabled!');
      console.log('Variation:', decision.variationKey);
      console.log('Variables:', decision.variables);
    } else {
      console.log('Feature is disabled');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Get all decisions
async function getAllFeatures() {
  try {
    const decisions = await client.decideAll(
      'user_123',
      { device: 'mobile' }
    );

    console.log('All decisions:', decisions);
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## React Quick Start

```jsx
// OptimizelyProvider.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';

const OptimizelyContext = createContext();

export function OptimizelyProvider({ children, sdkKey, userId }) {
  const [client] = useState(() => new EdgeAgentClient(EDGE_AGENT_URL, sdkKey));
  const [decisions, setDecisions] = useState({});

  useEffect(() => {
    // Fetch all decisions on mount/user change
    client.decideAll(userId, {})
      .then(decisions => {
        setDecisions(decisions);
      })
      .catch(console.error);
  }, [client, userId]);

  return (
    <OptimizelyContext.Provider value={{ client, decisions }}>
      {children}
    </OptimizelyContext.Provider>
  );
}

// Custom hook
export function useFeatureFlag(flagKey) {
  const { decisions } = useContext(OptimizelyContext);
  const decision = decisions[flagKey] || { enabled: false };
  
  return {
    isEnabled: decision.enabled,
    variation: decision.variationKey,
    variables: decision.variables || {}
  };
}

// Usage in component
function CheckoutComponent() {
  const { isEnabled, variables } = useFeatureFlag('new_checkout_flow');

  if (!isEnabled) {
    return <OldCheckout />;
  }

  return (
    <NewCheckout 
      buttonColor={variables.button_color}
      steps={variables.checkout_steps}
    />
  );
}
```

## Common Patterns

### 1. Feature Toggle
```javascript
const showNewFeature = async (userId) => {
  const decision = await client.decide('new_feature', userId);
  return decision.enabled;
};
```

### 2. A/B Test
```javascript
const getVariation = async (userId) => {
  const decision = await client.decide('homepage_test', userId);
  
  switch(decision.variationKey) {
    case 'control':
      return 'original';
    case 'treatment_a':
      return 'variant_a';
    case 'treatment_b':
      return 'variant_b';
    default:
      return 'original';
  }
};
```

### 3. Progressive Rollout
```javascript
const checkAccess = async (userId, userAttributes) => {
  const decision = await client.decide(
    'premium_feature',
    userId,
    userAttributes
  );
  
  return {
    hasAccess: decision.enabled,
    tier: decision.variables.access_tier || 'basic'
  };
};
```

### 4. Debug Mode
```javascript
// You would need to modify the client to support decideOptions
const debugDecision = async (flagKey, userId) => {
  const response = await fetch(`${EDGE_AGENT_URL}/api/decide`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Optimizely-Enable-FEX': 'true',
      'X-Optimizely-SDK-Key': SDK_KEY
    },
    body: JSON.stringify({ 
      flagKey, 
      userId, 
      decideOptions: ['INCLUDE_REASONS'] 
    })
  });
  
  const decision = await response.json();
  console.log('Decision:', decision.enabled);
  console.log('Reasons:', decision.reasons);
  
  return decision;
};
```

## Error Handling

### Basic Error Handler
```javascript
async function safeDecide(flagKey, userId, defaultValue = false) {
  try {
    const decision = await client.decide(flagKey, userId);
    return decision.enabled;
  } catch (error) {
    console.error(`Failed to get decision for ${flagKey}:`, error);
    
    // Return default value on error
    return defaultValue;
  }
}
```

### Retry Logic
```javascript
async function decideWithRetry(flagKey, userId, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.decide(flagKey, userId);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 100)
      );
    }
  }
}
```

## Next Steps

1. **[Authentication Guide](./authentication.md)** - Set up proper authentication
2. **[Decision Endpoints](./decisions/)** - Explore all decision options
3. **[Data Management](./data-management/)** - Manage datafiles and flags
4. **[Debug Endpoint](./admin/debug.md)** - Troubleshoot issues
5. **[Best Practices](../best-practices/)** - Production recommendations

## Troubleshooting

### "The Optimizely Edge Agent is disabled"
Add the required header:
```javascript
headers['X-Optimizely-Enable-FEX'] = 'true';
```

### "SDK key is required"
Provide your SDK key:
```javascript
headers['X-Optimizely-SDK-Key'] = 'YOUR_SDK_KEY';
```

### "Flag key not found"
Ensure the flag exists in your datafile:
```bash
# Check available flags
curl -X GET "https://your-deployment/api/flagkeys" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY"
```

### Network Errors
Check Edge Agent is accessible:
```bash
# Test connectivity
curl -I "https://your-deployment/api/sdk" \
  -H "X-Optimizely-Enable-FEX: true"
```

---

**Last Updated**: 2025-05-28