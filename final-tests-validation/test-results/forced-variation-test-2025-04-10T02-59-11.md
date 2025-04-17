# Forced Variation Test Results

Test Date: Invalid Date

## Summary

- Edge Agent URL: `http://127.0.0.1:8787`
- SDK Key: `8mR1pGh8u2ztUP8GqjmQq`
- Feature Keys: `test-flag`, `homepage-test`, `product-test`
- Experiment Keys: `ab-test-1`, `feature-test-1`
- Test Variations: `control`, `treatment`, `variant-1`, `variant-2`
- Results: 0/5 tests passed (0%)

## Test Results

### Header-Based

#### Header-Based Forced Variations - ❌ FAIL

Verify that the Edge Agent respects forced variations via HTTP headers

**Details:**

```
{
  "testUser": {
    "userId": "test-user-932636",
    "attributes": {
      "browser": "Chrome",
      "location": "US"
    }
  },
  "responses": [
    {
      "featureKey": "test-flag",
      "forcedVariation": "control"
    },
    {
      "featureKey": "homepage-test",
      "forcedVariation": "control"
    },
    {
      "featureKey": "product-test",
      "forcedVariation": "control"
    },
    {
      "featureKey": "multiple",
      "forcedVariation": "multiple",
      "variationApplied": "multiple decisions"
    }
  ]
}
```

**Error:**

```
One or more requests failed
```

### JSON-Based

#### JSON-Based Forced Variations - ❌ FAIL

Verify that the Edge Agent respects forced variations via JSON payload

**Details:**

```
{
  "testUser": {
    "userId": "test-user-932636",
    "attributes": {
      "browser": "Chrome",
      "location": "US"
    }
  },
  "responses": [
    {
      "featureKey": "test-flag",
      "forcedVariation": "treatment"
    },
    {
      "featureKey": "homepage-test",
      "forcedVariation": "treatment"
    },
    {
      "featureKey": "product-test",
      "forcedVariation": "treatment"
    },
    {
      "featureKey": "multiple",
      "forcedVariation": "multiple",
      "variationApplied": "multiple decisions"
    }
  ]
}
```

**Error:**

```
One or more requests failed
```

### Query-Based

#### Query Parameter-Based Forced Variations - ❌ FAIL

Verify that the Edge Agent respects forced variations via query parameters

**Details:**

```
{
  "testUser": {
    "userId": "test-user-932636",
    "attributes": {
      "browser": "Chrome",
      "location": "US"
    }
  },
  "responses": [
    {
      "featureKey": "test-flag",
      "forcedVariation": "variant-1"
    },
    {
      "featureKey": "homepage-test",
      "forcedVariation": "variant-1"
    },
    {
      "featureKey": "product-test",
      "forcedVariation": "variant-1"
    },
    {
      "featureKey": "multiple",
      "forcedVariation": "multiple",
      "variationApplied": "multiple decisions"
    }
  ]
}
```

**Error:**

```
One or more requests failed
```

### Precedence

#### Forced Variation Precedence - ❌ FAIL

Verify that the Edge Agent applies correct precedence rules for forced variations

**Details:**

```
{
  "testUser": {
    "userId": "test-user-932636",
    "attributes": {
      "browser": "Chrome",
      "location": "US"
    }
  },
  "featureKey": "test-flag",
  "headerVariation": "control",
  "jsonVariation": "treatment",
  "queryVariation": "variant-1",
  "expectedVariation": "control",
  "precedenceCorrect": false
}
```

**Error:**

```
Request failed
```

### Error Handling

#### Invalid Forced Variation Handling - ❌ FAIL

Verify that the Edge Agent handles invalid forced variation inputs gracefully

**Details:**

```
{
  "testUser": {
    "userId": "test-user-932636",
    "attributes": {
      "browser": "Chrome",
      "location": "US"
    }
  },
  "featureKey": "test-flag",
  "tests": [
    {
      "name": "Invalid JSON in header",
      "success": false
    },
    {
      "name": "Missing required fields",
      "success": false
    },
    {
      "name": "Non-existent variation",
      "success": false
    }
  ]
}
```

**Error:**

```
One or more invalid inputs caused failures
```

