# API Examples

Real-world implementation examples for common use cases.

## Available Examples

1. **[E-commerce Integration](./ecommerce.md)** - Product recommendations, checkout flows
2. **[SaaS Feature Gating](./saas-features.md)** - Plan-based features, trial management
3. **[Mobile App Configuration](./mobile-app.md)** - Remote config, gradual rollouts
4. **[A/B Testing](./ab-testing.md)** - Conversion optimization, multivariate tests
5. **[Progressive Rollouts](./progressive-rollout.md)** - Safe feature deployment
6. **[Personalization](./personalization.md)** - User segment targeting

## Quick Examples

### Feature Toggle
```javascript
// Simple on/off feature flag
const isEnabled = await client.decide('new_feature', userId)
  .then(decision => decision.enabled);

if (isEnabled) {
  renderNewFeature();
} else {
  renderOldFeature();
}
```

### Percentage Rollout
```javascript
// Gradually roll out to users
const decision = await client.decide('gradual_feature', userId, {
  rollout_group: Math.floor(Date.now() / 86400000) // Day-based cohort
});

if (decision.enabled) {
  const percentage = decision.variables.rollout_percentage || 0;
  console.log(`Feature rolled out to ${percentage}% of users`);
}
```

### User Targeting
```javascript
// Target specific user segments
const decision = await client.decide('premium_feature', userId, {
  plan: user.subscription.plan,
  account_age_days: user.getDaysSinceSignup(),
  monthly_revenue: user.getMonthlyRevenue(),
  country: user.country
});

if (decision.enabled) {
  showPremiumFeature(decision.variables);
}
```

### Multivariate Test
```javascript
// Test multiple variations
const decision = await client.decide('homepage_redesign', userId);

switch(decision.variationKey) {
  case 'control':
    render('layouts/original.html');
    break;
  case 'variant_a':
    render('layouts/modern.html', {
      hero_style: decision.variables.hero_style,
      cta_text: decision.variables.cta_text
    });
    break;
  case 'variant_b':
    render('layouts/minimal.html', {
      color_scheme: decision.variables.color_scheme
    });
    break;
  default:
    render('layouts/original.html');
}
```

### Configuration Management
```javascript
// Use feature flags for configuration
const config = await client.decide('app_config', userId);

const settings = {
  api_endpoint: config.variables.api_endpoint || 'https://api.example.com',
  timeout_ms: config.variables.timeout_ms || 5000,
  retry_count: config.variables.retry_count || 3,
  cache_ttl: config.variables.cache_ttl || 300,
  features: {
    analytics: config.variables.enable_analytics || false,
    offline_mode: config.variables.enable_offline || false,
    beta_features: config.variables.enable_beta || false
  }
};
```

### Error Handling Pattern
```javascript
class FeatureManager {
  constructor(client) {
    this.client = client;
    this.cache = new Map();
    this.defaults = {
      checkout_flow: { enabled: false, variation: 'legacy' },
      search_algorithm: { enabled: true, variation: 'v1' },
      recommendations: { enabled: false, variation: null }
    };
  }

  async getFeature(flagKey, userId, attributes = {}) {
    const cacheKey = `${flagKey}:${userId}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    try {
      // Get decision with timeout
      const decision = await Promise.race([
        this.client.decide(flagKey, userId, attributes),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 1000)
        )
      ]);
      
      // Cache successful decisions
      this.cache.set(cacheKey, decision);
      
      // Clear cache after TTL
      setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);
      
      return decision;
    } catch (error) {
      console.error(`Feature decision failed for ${flagKey}:`, error);
      
      // Return default configuration
      return this.defaults[flagKey] || {
        enabled: false,
        variationKey: null,
        variables: {}
      };
    }
  }

  async preloadFeatures(userId, flagKeys) {
    // Batch load multiple features
    const decisions = await this.client.decideForKeys(
      flagKeys,
      userId,
      { preload: true }
    );
    
    // Cache all decisions
    Object.entries(decisions).forEach(([flagKey, decision]) => {
      const cacheKey = `${flagKey}:${userId}`;
      this.cache.set(cacheKey, decision);
    });
    
    return decisions;
  }
}
```

## Integration Patterns

### 1. React Hook
```jsx
function useOptimizely(flagKey, attributes = {}) {
  const [decision, setDecision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const userId = useUserId(); // Your user ID hook
  
  useEffect(() => {
    let cancelled = false;
    
    async function fetchDecision() {
      try {
        setLoading(true);
        const result = await client.decide(flagKey, userId, attributes);
        
        if (!cancelled) {
          setDecision(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setDecision({ enabled: false });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    
    fetchDecision();
    
    return () => { cancelled = true; };
  }, [flagKey, userId, ...Object.values(attributes)]);
  
  return { decision, loading, error };
}
```

### 2. Express Middleware
```javascript
function optimizelyMiddleware(client) {
  return async (req, res, next) => {
    // Get user ID from session or cookie
    const userId = req.session?.userId || req.cookies?.visitor_id || 'anonymous';
    
    // Collect user attributes
    const attributes = {
      ip_country: req.headers['cf-ipcountry'],
      user_agent: req.headers['user-agent'],
      referrer: req.headers['referer'],
      ...req.user?.attributes
    };
    
    // Make decisions available to routes
    req.optimizely = {
      async decide(flagKey, additionalAttributes = {}) {
        return client.decide(flagKey, userId, {
          ...attributes,
          ...additionalAttributes
        });
      },
      
      async decideAll() {
        return client.decideAll(userId, attributes);
      },
      
      userId,
      attributes
    };
    
    next();
  };
}

// Usage in routes
app.get('/checkout', async (req, res) => {
  const decision = await req.optimizely.decide('new_checkout_flow');
  
  if (decision.enabled) {
    res.render('checkout-new', { config: decision.variables });
  } else {
    res.render('checkout-legacy');
  }
});
```

### 3. GraphQL Resolver
```javascript
const resolvers = {
  Query: {
    featureFlag: async (_, { flagKey, userId, attributes }, context) => {
      const decision = await context.optimizely.decide(
        flagKey,
        userId || context.userId,
        attributes
      );
      
      return {
        key: flagKey,
        enabled: decision.enabled,
        variation: decision.variationKey,
        variables: JSON.stringify(decision.variables)
      };
    },
    
    allFeatureFlags: async (_, { userId, attributes }, context) => {
      const result = await context.optimizely.decideAll(
        userId || context.userId,
        attributes
      );
      
      return result.decisions.map(decision => ({
        key: decision.flagKey,
        enabled: decision.enabled,
        variation: decision.variationKey,
        variables: JSON.stringify(decision.variables)
      }));
    }
  },
  
  User: {
    features: async (user, _, context) => {
      const result = await context.optimizely.decideAll(
        user.id,
        user.attributes
      );
      
      return result.decisions;
    }
  }
};
```

## Performance Optimization

### Batch Loading
```javascript
// Load all features at once for initial page load
async function initializeFeatures(userId) {
  const start = performance.now();
  
  const { decisions } = await client.decideAll(userId, {
    source: 'initial_load'
  });
  
  const features = decisions.reduce((acc, decision) => {
    acc[decision.flagKey] = decision;
    return acc;
  }, {});
  
  console.log(`Loaded ${decisions.length} features in ${
    performance.now() - start
  }ms`);
  
  return features;
}
```

### Lazy Loading
```javascript
// Load features only when needed
class LazyFeatureLoader {
  constructor(client, userId) {
    this.client = client;
    this.userId = userId;
    this.loaded = new Map();
    this.loading = new Map();
  }
  
  async get(flagKey) {
    // Return if already loaded
    if (this.loaded.has(flagKey)) {
      return this.loaded.get(flagKey);
    }
    
    // Wait if currently loading
    if (this.loading.has(flagKey)) {
      return this.loading.get(flagKey);
    }
    
    // Start loading
    const promise = this.client.decide(flagKey, this.userId)
      .then(decision => {
        this.loaded.set(flagKey, decision);
        this.loading.delete(flagKey);
        return decision;
      })
      .catch(error => {
        this.loading.delete(flagKey);
        throw error;
      });
    
    this.loading.set(flagKey, promise);
    return promise;
  }
}
```

## Testing Patterns

### Mock Client for Tests
```javascript
class MockOptimizelyClient {
  constructor(decisions = {}) {
    this.decisions = decisions;
  }
  
  async decide(flagKey, userId, attributes) {
    const decision = this.decisions[flagKey] || {
      enabled: false,
      variationKey: null,
      flagKey,
      variables: {}
    };
    
    return Promise.resolve(decision);
  }
  
  setDecision(flagKey, decision) {
    this.decisions[flagKey] = decision;
  }
}

// Use in tests
describe('Checkout Flow', () => {
  let mockClient;
  
  beforeEach(() => {
    mockClient = new MockOptimizelyClient({
      new_checkout_flow: {
        enabled: true,
        variationKey: 'treatment',
        variables: { steps: 3 }
      }
    });
  });
  
  it('should render new checkout when enabled', async () => {
    const decision = await mockClient.decide('new_checkout_flow', 'test_user');
    expect(decision.enabled).toBe(true);
    expect(decision.variables.steps).toBe(3);
  });
});
```

## Common Pitfalls and Solutions

### 1. Not Handling Network Failures
```javascript
// Bad
const decision = await client.decide(flagKey, userId);
if (decision.enabled) { /* ... */ }

// Good
try {
  const decision = await client.decide(flagKey, userId);
  if (decision.enabled) { /* ... */ }
} catch (error) {
  // Fall back to default behavior
  console.error('Feature flag error:', error);
  useDefaultBehavior();
}
```

### 2. Missing User Context
```javascript
// Bad - anonymous decisions may not be consistent
const decision = await client.decide(flagKey, null);

// Good - use consistent user ID
const userId = getUserId() || generateAnonymousId();
const decision = await client.decide(flagKey, userId);
```

### 3. Ignoring Variable Values
```javascript
// Bad - only checking enabled state
if (decision.enabled) {
  showFeature();
}

// Good - using variable configuration
if (decision.enabled) {
  showFeature({
    color: decision.variables.button_color || '#default',
    text: decision.variables.cta_text || 'Click here',
    size: decision.variables.button_size || 'medium'
  });
}
```

---

**Last Updated**: 2025-05-28