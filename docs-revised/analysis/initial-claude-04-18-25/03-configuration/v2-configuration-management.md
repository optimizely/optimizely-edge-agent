# Configuration Management in v2

_Last Updated: 2025-04-18_

## Overview

The v2 Optimizely Edge Agent implements configuration management through a dedicated `ConfigurationService` that provides a strongly typed, validated, and abstracted approach to handling configuration. This service-oriented design significantly improves upon v1's implementation by introducing proper interfaces, comprehensive validation, and clearer separation of concerns.

## Architecture

The v2 configuration system follows a service-oriented architecture with clear interface definition:

```typescript
// Interface definition
interface IConfigurationService {
  initialize(request: IRequestAdapter): Promise<OptimizelyConfigOptions>;
  getConfig(): OptimizelyConfigOptions;
  getSettings(): ServiceConfigSettings;
  getMetadata(): ConfigMetadata;
  updateConfig(newConfig: Partial<OptimizelyConfigOptions>): OptimizelyConfigOptions;
  getValue<T>(key: keyof OptimizelyConfigOptions): T | undefined;
  setValue<T>(key: keyof OptimizelyConfigOptions, value: T): void;
  getDecideOptions(): string[];
  hasDecideOption(option: string): boolean;
  validate(): ValidationResult;
  validateValue<T>(key: keyof OptimizelyConfigOptions, value: T): ValidationIssue | null;
  fixValidationIssues(issues: ValidationIssue[]): number;
  getValidationRules(): ValidationRule[];
}

// Implementation follows the interface contract
export class ConfigurationService implements IConfigurationService {
  // Implementation details...
}
```

This approach enables:
1. **Dependency Inversion**: Services depend on the interface, not the implementation
2. **Testability**: The service can be easily mocked for testing
3. **Extensibility**: Alternative implementations can be created without changing consumers

## Configuration Source Priority

Like v1, the v2 implementation retains the cascading priority model:

1. **HTTP Headers** (highest priority)
2. **URL Query Parameters** (intermediate priority)
3. **Request Body** (for POST/PUT requests)
4. **Default Values** (lowest priority)

This is implemented with improved type safety and validation:

```typescript
async initialize(request: IRequestAdapter): Promise<OptimizelyConfigOptions> {
  // Reset config for new request
  this.config = {};
  this.metadata = this.initializeConfigMetadata();
  
  // Initialize in priority order
  await this.initializeFromHeaders(request);
  await this.initializeFromQueryParams(request);
  await this.initializeFromBody(request);
  
  // Apply defaults and validate
  this.applyDefaults();
  this.updateMetadata();
  const validationResult = this.validate();
  
  // Log validation issues
  if (validationResult.hasErrors) {
    this.logger.warn(`Configuration has ${validationResult.issues.filter(i => i.severity === ValidationSeverity.ERROR).length} error(s)`);
    // Log details...
  }
  
  return this.config;
}
```

## Type Safety and Validation

A major improvement in v2 is the comprehensive type safety and validation system:

### Strongly Typed Configuration

```typescript
// Explicit type definition for configuration
interface OptimizelyConfigOptions {
  sdkKey?: string;
  flagKey?: string;
  flagKeys?: string[];
  userId?: string;
  visitorId?: string;
  attributes?: Record<string, any>;
  eventKey?: string;
  eventTags?: Record<string, any>;
  forcedDecisions?: Record<string, any>;
  // ...and many more typed properties
}
```

### Validation Rules

The v2 implementation introduces formal validation rules with severity levels:

```typescript
getValidationRules(): ValidationRule[] {
  return [
    {
      field: 'sdkKey',
      validator: (value) => {
        if (typeof value !== 'string') {
          return {
            type: ValidationIssueType.TYPE_ERROR,
            message: 'SDK Key must be a string',
            severity: ValidationSeverity.ERROR,
            field: 'sdkKey',
            value
          };
        }
        if (value.length < 3) {
          return {
            type: ValidationIssueType.CONSTRAINT_VIOLATION,
            message: 'SDK Key is too short (min: 3 characters)',
            severity: ValidationSeverity.ERROR,
            field: 'sdkKey',
            value
          };
        }
        return null;
      },
      required: true
    },
    // Many more validation rules...
  ];
}
```

### Validation Execution

Validation is performed systematically with detailed error reporting:

```typescript
validate(): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    hasErrors: false,
    hasWarnings: false,
    issues: []
  };
  
  // Apply all validation rules
  for (const rule of this.getValidationRules()) {
    const value = this.config[rule.field];
    
    // Check required fields
    if (rule.required && (value === undefined || value === null)) {
      result.issues.push({
        type: ValidationIssueType.MISSING_REQUIRED_FIELD,
        message: `Required field '${rule.field}' is missing`,
        severity: ValidationSeverity.ERROR,
        field: rule.field,
        value: value
      });
      continue;
    }
    
    // Skip validation for undefined optional fields
    if (value === undefined && !rule.required) {
      continue;
    }
    
    // Apply the validator
    const validationIssue = rule.validator(value);
    if (validationIssue) {
      result.issues.push(validationIssue);
    }
  }
  
  // Update validation summary
  result.hasErrors = result.issues.some(i => i.severity === ValidationSeverity.ERROR);
  result.hasWarnings = result.issues.some(i => i.severity === ValidationSeverity.WARNING);
  result.isValid = !result.hasErrors;
  
  return result;
}
```

## Configuration Source Mapping

### HTTP Headers

The v2 implementation provides more robust header parsing:

```typescript
private async initializeFromHeaders(request: IRequestAdapter): Promise<void> {
  const headers = request.getHeaders();
  
  // Process headers to extract configuration values
  headers.forEach((value, key) => {
    // Handle both x-optly-* and X-Optimizely-* headers
    if (key.toLowerCase().startsWith('x-optly-') || key.toLowerCase().startsWith('x-optimizely-')) {
      // Convert header name to camelCase config key
      let configKey = '';
      
      if (key.toLowerCase().startsWith('x-optly-')) {
        // Handle x-optly- prefix (legacy)
        configKey = this.convertHeaderToCamelCase(key.replace(/^x-optly-/i, ''));
      } else {
        // Handle X-Optimizely- prefix (standard)
        configKey = this.convertHeaderToCamelCase(key.replace(/^x-optimizely-/i, ''));
        
        // Special case mappings
        configKey = this.mapSpecialHeaderKeys(configKey);
      }
      
      // Extract value
      const configValue = this.parseHeaderValue(value, key);
      
      // Store in config with source tracking
      this.setConfigValue(configKey as keyof OptimizelyConfigOptions, configValue, 'headers');
    }
  });
  
  // Handle special cases and direct mappings
  // ...
}
```

### Query Parameters

Query parameters are handled with improved type conversion:

```typescript
private async initializeFromQueryParams(request: IRequestAdapter): Promise<void> {
  const url = request.getUrl();
  const queryParams = url.searchParams;
  const prioritizeHeaders = this.settings.prioritizeHeadersOverQueryParams;
  
  // Map of query parameter names to config keys
  const queryParamMapping = this.getQueryParamMapping();
  
  // Process each query parameter with type detection
  for (const [paramName, configKey] of Object.entries(queryParamMapping)) {
    if (queryParams.has(paramName)) {
      const paramValue = queryParams.get(paramName);
      
      // Check if we should override the value from headers
      if (!prioritizeHeaders || this.config[configKey] === undefined) {
        // Handle different types appropriately
        if (['attributes', 'eventTags', 'forcedDecisions'].includes(configKey)) {
          try {
            const parsedValue = paramValue ? JSON.parse(paramValue) : null;
            if (parsedValue !== null) {
              this.setConfigValue(configKey as keyof OptimizelyConfigOptions, parsedValue, 'queryParams');
            }
          } catch (error) {
            this.logger.debug(`Failed to parse ${paramName} as JSON:`, error);
          }
        } else if (configKey === 'decideOptions' && paramValue) {
          // Handle decide options as comma-separated list
          const decideOptions = paramValue.split(',').map(s => s.trim());
          this.setConfigValue('decideOptions', decideOptions, 'queryParams');
        } else if (['true', 'false'].includes(paramValue?.toLowerCase() || '')) {
          // Handle boolean values
          const boolValue = paramValue?.toLowerCase() === 'true';
          this.setConfigValue(configKey as keyof OptimizelyConfigOptions, boolValue, 'queryParams');
        } else {
          // Handle regular values
          this.setConfigValue(configKey as keyof OptimizelyConfigOptions, paramValue, 'queryParams');
        }
      }
    }
  }
  
  // Special handling for multi-value parameters
  // ...
}
```

### Request Body

The body parsing is enhanced with content-type validation and error handling:

```typescript
private async initializeFromBody(request: IRequestAdapter): Promise<void> {
  // Only process body for POST/PUT methods
  const method = request.getMethod();
  if (!['POST', 'PUT'].includes(method)) {
    return;
  }
  
  // Check content type
  const contentType = request.getHeaders().get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return;
  }
  
  // Parse body safely
  try {
    const body = await request.getBodyAsJson();
    if (!body || typeof body !== 'object') {
      return;
    }
    
    // Process each property with source tracking
    Object.entries(body).forEach(([key, value]) => {
      // Normalize key to match our config schema
      const configKey = this.normalizeConfigKey(key);
      
      // Only set if not already set from higher priority sources
      if (this.config[configKey as keyof OptimizelyConfigOptions] === undefined) {
        this.setConfigValue(configKey as keyof OptimizelyConfigOptions, value, 'body');
      }
    });
    
    // Special handling for nested properties
    // ...
  } catch (error) {
    this.logger.error(`Error parsing request body:`, error);
  }
}
```

## Default Values

Default settings are applied explicitly after all sources are processed:

```typescript
private applyDefaults(): void {
  // Apply default values for unset properties
  const defaults: Partial<OptimizelyConfigOptions> = {
    trimmedDecisions: this.settings.defaultTrimmedDecisions,
    setResponseHeaders: this.settings.defaultSetResponseHeaders,
    setResponseCookies: this.settings.defaultSetResponseCookies,
    setRequestHeaders: this.settings.defaultSetRequestHeaders,
    setRequestCookies: this.settings.defaultSetRequestCookies,
    overrideCache: this.settings.defaultOverrideCache,
    overrideVisitorId: this.settings.defaultOverrideVisitorId,
    enableResponseMetadata: this.settings.defaultEnableResponseMetadata,
    datafileFromKV: this.settings.defaultDatafileFromKV,
    enableFlagsFromKV: this.settings.defaultEnableFlagsFromKV,
    // ... more defaults
  };
  
  // Only apply defaults for undefined properties
  Object.entries(defaults).forEach(([key, value]) => {
    if (this.config[key as keyof OptimizelyConfigOptions] === undefined) {
      this.setConfigValue(key as keyof OptimizelyConfigOptions, value, 'defaults');
    }
  });
  
  // Derive computed values
  if (this.config.userId && !this.config.visitorId) {
    this.setConfigValue('visitorId', this.config.userId, 'derived (from userId)');
  } else if (this.config.visitorId && !this.config.userId) {
    this.setConfigValue('userId', this.config.visitorId, 'derived (from visitorId)');
  }
  
  // Initialize empty arrays if undefined
  if (!this.config.flagKeys) {
    this.setConfigValue('flagKeys', [], 'defaults');
  }
  
  if (!this.config.decideOptions) {
    this.setConfigValue('decideOptions', [], 'defaults');
  }
  
  // ... additional derived values
}
```

## Metadata Tracking

The v2 implementation enhances metadata tracking with more detailed source information:

```typescript
private setConfigValue<T>(key: keyof OptimizelyConfigOptions, value: T, source: string): void {
  // Set the value
  this.config[key] = value;
  
  // Track the metadata if enabled
  if (this.metadata.configSources) {
    this.metadata.configSources[key] = source;
  }
  
  // Track special metadata for key values
  switch (key) {
    case 'sdkKey':
      this.metadata.sdkKeyFrom = source;
      break;
    case 'visitorId':
    case 'userId':
      this.metadata.visitorIdFrom = source;
      break;
    case 'attributes':
      this.metadata.attributesFrom = source;
      break;
    case 'eventTags':
      this.metadata.eventTagsFrom = source;
      break;
    case 'flagKeys':
      this.metadata.flagKeysFrom = source;
      break;
  }
  
  // Debug logging
  this.logger.debug(`Set config ${key} = ${JSON.stringify(value)} from ${source}`);
}
```

## Integration with RequestHandler

Unlike v1's tight coupling, v2 uses the ConfigurationService through its interface:

```typescript
// In RequestHandler.ts
private async getRequestConfig(requestAdapter: IRequestAdapter): Promise<Record<string, any>> {
  try {
    if (this.configurationService) {
      // Use the configuration service if available
      const config = await this.configurationService.initialize(requestAdapter);
      return config;
    } else {
      // Fallback implementation for backward compatibility
      // ...
    }
  } catch (error) {
    this.logger.error('Error getting request configuration', error);
    throw error;
  }
}
```

This loose coupling enables:
1. The RequestHandler to work without a ConfigurationService (fallback behavior)
2. Alternative ConfigurationService implementations to be used
3. Easier testing by mocking the ConfigurationService

## Comparison with v1

| Aspect | v1 Implementation | v2 Implementation |
|--------|-------------------|-------------------|
| **Architecture** | Class-based with tight coupling | Interface-based service with loose coupling |
| **Type Safety** | Minimal (JavaScript objects) | Strong (TypeScript interfaces) |
| **Validation** | Minimal parsing and error logging | Comprehensive validation rules with severity levels |
| **Error Handling** | Inconsistent, often silent failures | Structured issues with clear severity and reporting |
| **Metadata** | Basic tracking of sources | Comprehensive tracking with detailed sources |
| **Default Application** | Mixed with source processing | Clear separation after source processing |
| **Flexibility** | Hardcoded behavior | Interface-based with dependency injection |
| **Backward Compatibility** | N/A | Maintained through fallback patterns |

## Key Improvements in v2

1. **Interface-First Design**: Clear contract through IConfigurationService interface
2. **Enhanced Type Safety**: Strong typing with TypeScript interfaces
3. **Comprehensive Validation**: Formal validation rules with severity levels
4. **Clear Source Tracking**: Detailed metadata on configuration sources
5. **Improved Error Handling**: Structured validation issues with clear reporting
6. **Separation of Concerns**: Configuration processing separated from request handling
7. **Testability**: Easy to mock for unit testing
8. **Backward Compatibility**: Maintains functionality while improving architecture

The v2 configuration management system represents a significant architectural improvement while maintaining functional parity with the v1 implementation.