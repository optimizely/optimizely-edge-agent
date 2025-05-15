# Edge Agent Configuration Settings: Validation Guide

## Introduction

This document provides guidance for validating the parity between legacy and new Optimizely Edge Agent implementations, with a focus on configuration settings. It outlines testing strategies to ensure that all configuration parameters behave consistently across both implementations, regardless of whether they are provided via headers, query parameters, or JSON body.

## Validation Principles

1. **Multi-source Testing**: Each configuration setting must be tested through all supported input methods (headers, query parameters, JSON body).
2. **Precedence Verification**: When the same setting is provided through multiple sources, confirm the correct precedence order (headers > query parameters > JSON body).
3. **Cross-format Compatibility**: Ensure settings function identically regardless of format differences (e.g., string "true" vs. boolean true).
4. **Legacy Prefix Support**: Verify that legacy prefixes (`x-optly-*`) work identically to standard prefixes (`X-Optimizely-*`).
5. **Case Insensitivity**: Confirm that header names are processed in a case-insensitive manner.

## Testing Methodology

### 1. Individual Setting Validation

For each configuration setting, perform these validation steps:

1. **Isolated Testing**: Test each setting individually through each supported input method.
2. **Value Types**: Test with different value types where applicable (strings, numbers, booleans, objects).
3. **Edge Cases**: Test with edge case values (empty strings, null, undefined, malformed JSON).
4. **Response Inspection**: Examine responses to confirm settings were applied correctly.
5. **Logging Verification**: Check logs to confirm parsing and application of settings.

### 2. Precedence Testing

For settings supported across multiple input methods:

1. **Conflicting Values Test**: Provide different values for the same setting across different sources.
2. **Expected Precedence**: Verify that headers take precedence over query parameters, which take precedence over JSON body.
3. **Mixed Case Headers**: Test with mixed-case header names to verify case insensitivity.
4. **Legacy vs. Standard Headers**: Test both `x-optly-*` and `X-Optimizely-*` header formats with conflicting values.

### 3. Complex Object Validation

For settings that accept complex objects (attributes, forcedDecisions, etc.):

1. **Object Structure**: Test with simple and complex nested structures.
2. **Array Handling**: Verify array processing in relevant settings.
3. **Serialization/Deserialization**: Confirm proper handling of serialized JSON in headers.
4. **Malformed Objects**: Test with intentionally malformed JSON to verify error handling.

## Configuration Settings Validation Checklist

Below is a comprehensive checklist for validating each configuration setting:

| Setting | Headers Test | Query Params Test | JSON Body Test | Precedence Test | Legacy Prefix Test | Complex Value Test |
|---------|--------------|-------------------|----------------|-----------------|-------------------|-------------------|
| sdkKey | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | N/A |
| overrideCache | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| overrideVisitorId | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| attributes | ⬜ | N/A | ⬜ | ⬜ | ⬜ | ⬜ |
| eventTags | ⬜ | N/A | ⬜ | ⬜ | ⬜ | ⬜ |
| datafileAccessToken | ⬜ | N/A | N/A | N/A | ⬜ | N/A |
| enableOptimizelyHeader | ⬜ | N/A | N/A | N/A | ⬜ | N/A |
| decideOptions | ⬜ | N/A | N/A | N/A | ⬜ | ⬜ |
| visitorId | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | N/A |
| trimmedDecisions | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| enableFlagsFromKV | ⬜ | N/A | ⬜ | ⬜ | ⬜ | N/A |
| eventKey | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | N/A |
| datafileFromKV | ⬜ | N/A | ⬜ | ⬜ | ⬜ | N/A |
| enableRespMetadataHeader | ⬜ | N/A | N/A | N/A | ⬜ | N/A |
| setResponseCookies | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| setResponseHeaders | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| setRequestHeaders | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| setRequestCookies | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| serverMode | N/A | ⬜ | N/A | N/A | N/A | N/A |
| flagKeys | N/A | ⬜ | ⬜ | ⬜ | N/A | ⬜ |
| enableResponseMetadata | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| decideAll | N/A | ⬜ | ⬜ | ⬜ | N/A | ⬜ |
| disableDecisionEvent | N/A | ⬜ | ⬜ | ⬜ | N/A | ⬜ |
| enabledFlagsOnly | N/A | ⬜ | ⬜ | ⬜ | N/A | ⬜ |
| includeReasons | N/A | ⬜ | ⬜ | ⬜ | N/A | ⬜ |
| ignoreUserProfileService | N/A | ⬜ | ⬜ | ⬜ | N/A | ⬜ |
| excludeVariables | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| forcedDecisions | N/A | N/A | ⬜ | N/A | N/A | ⬜ |

## Test Case Templates

### Basic Configuration Test (Header)

```bash
curl -X POST https://edge-agent-endpoint/decide \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY" \
  -H "X-Optimizely-Visitor-Id: test_user" \
  -H "X-Optimizely-PARAMETER_NAME: PARAMETER_VALUE" \
  -d '{"flagKey": "test-flag"}'
```

### Basic Configuration Test (Query Parameter)

```bash
curl -X POST "https://edge-agent-endpoint/decide?sdkKey=YOUR_SDK_KEY&visitorId=test_user&PARAMETER_NAME=PARAMETER_VALUE&flagKey=test-flag" \
  -d '{}'
```

### Basic Configuration Test (JSON Body)

```bash
curl -X POST https://edge-agent-endpoint/decide \
  -H "Content-Type: application/json" \
  -d '{
    "sdkKey": "YOUR_SDK_KEY",
    "visitorId": "test_user",
    "flagKey": "test-flag",
    "PARAMETER_NAME": PARAMETER_VALUE
  }'
```

### Precedence Test

```bash
curl -X POST "https://edge-agent-endpoint/decide?PARAMETER_NAME=query_value" \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY" \
  -H "X-Optimizely-Visitor-Id: test_user" \
  -H "X-Optimizely-PARAMETER_NAME: header_value" \
  -d '{
    "flagKey": "test-flag",
    "PARAMETER_NAME": "body_value"
  }'
```

### Legacy Header Test

```bash
curl -X POST https://edge-agent-endpoint/decide \
  -H "x-optly-sdk-key: YOUR_SDK_KEY" \
  -H "x-optly-visitor-id: test_user" \
  -H "x-optly-PARAMETER_NAME: PARAMETER_VALUE" \
  -d '{"flagKey": "test-flag"}'
```

## Special Configuration Cases

### 1. Complex Object Settings

For settings that accept complex objects (attributes, eventTags, forcedDecisions):

```bash
# Testing attributes in header
curl -X POST https://edge-agent-endpoint/decide \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY" \
  -H "X-Optimizely-Visitor-Id: test_user" \
  -H "X-Optimizely-Attributes: {\"country\":\"US\",\"device\":\"mobile\",\"nested\":{\"value\":123}}" \
  -d '{"flagKey": "test-flag"}'

# Testing attributes in body
curl -X POST https://edge-agent-endpoint/decide \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY" \
  -H "X-Optimizely-Visitor-Id: test_user" \
  -d '{
    "flagKey": "test-flag",
    "attributes": {
      "country": "US",
      "device": "mobile",
      "nested": {
        "value": 123
      }
    }
  }'
```

### 2. Boolean Settings

For settings that expect boolean values:

```bash
# Testing with string "true"
curl -X POST https://edge-agent-endpoint/decide \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY" \
  -H "X-Optimizely-Visitor-Id: test_user" \
  -H "X-Optimizely-Set-Response-Headers: true" \
  -d '{"flagKey": "test-flag"}'

# Testing with numeric 1
curl -X POST "https://edge-agent-endpoint/decide?setResponseHeaders=1" \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY" \
  -H "X-Optimizely-Visitor-Id: test_user" \
  -d '{"flagKey": "test-flag"}'

# Testing with boolean in body
curl -X POST https://edge-agent-endpoint/decide \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY" \
  -H "X-Optimizely-Visitor-Id: test_user" \
  -d '{
    "flagKey": "test-flag",
    "setResponseHeaders": true
  }'
```

### 3. Multi-valued Parameters

For parameters that can accept multiple values (like flagKeys):

```bash
# Testing multiple flag keys in query parameters
curl -X POST "https://edge-agent-endpoint/decide?sdkKey=YOUR_SDK_KEY&visitorId=test_user&flagKeys=flag1&flagKeys=flag2&flagKeys=flag3" \
  -d '{}'

# Testing multiple flag keys in JSON body
curl -X POST https://edge-agent-endpoint/decide \
  -H "X-Optimizely-SDK-Key: YOUR_SDK_KEY" \
  -H "X-Optimizely-Visitor-Id: test_user" \
  -d '{
    "flagKeys": ["flag1", "flag2", "flag3"]
  }'
```

## Validation Approach

1. **Automated Testing**: Develop automated test suite that covers all configuration settings.
2. **Parallel Testing**: Run identical requests against both legacy and new implementations.
3. **Response Comparison**: Compare responses to verify identical behavior.
4. **Documentation**: Document any observed differences with clear examples.
5. **Regression Prevention**: Add regression tests for any issues discovered.

## Expected Results

A properly functioning Edge Agent should:

1. **Correctly Parse** all configuration settings from all supported sources.
2. **Apply Proper Precedence** when the same setting comes from multiple sources.
3. **Handle Legacy Headers** identically to standard headers.
4. **Process Complex Objects** consistently, including nested structures.
5. **Work Consistently** across all deployment platforms.

## Documentation of Differences

During validation, document any observed differences between implementations in this format:

| Setting | Source | Legacy Behavior | New Behavior | Root Cause | Resolution Plan |
|---------|--------|----------------|-------------|------------|-----------------|
| [Setting name] | [Header/Query/Body] | [Describe] | [Describe] | [Analysis] | [Plan] |

## Conclusion

Thorough validation of configuration settings is essential to ensure parity between legacy and new Edge Agent implementations. Following this validation guide will help identify and address any discrepancies in how configuration settings are handled.