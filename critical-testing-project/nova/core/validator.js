/**
 * NOVA Validator - Response validation engine
 */

class Validator {
  constructor(config) {
    this.config = config;
  }

  /**
   * Validate response against expectations
   */
  validate(response, expectations) {
    const errors = [];
    const warnings = [];
    
    // Validate status code
    if (expectations.status !== undefined) {
      if (response.status !== expectations.status) {
        errors.push(`Expected status ${expectations.status}, got ${response.status}`);
      }
    }
    
    // Validate status range
    if (expectations.statusRange) {
      const [min, max] = expectations.statusRange;
      if (response.status < min || response.status > max) {
        errors.push(`Expected status ${min}-${max}, got ${response.status}`);
      }
    }
    
    // Validate required headers
    if (expectations.requiredHeaders) {
      for (const header of expectations.requiredHeaders) {
        const headerValue = this.getHeader(response.headers, header);
        if (!headerValue) {
          errors.push(`Missing required header: ${header}`);
        }
      }
    }
    
    // Validate header values
    if (expectations.headers) {
      for (const [header, expected] of Object.entries(expectations.headers)) {
        const actual = this.getHeader(response.headers, header);
        if (!this.matchValue(actual, expected)) {
          errors.push(`Header ${header}: expected "${expected}", got "${actual}"`);
        }
      }
    }
    
    // Validate forbidden headers
    if (expectations.forbiddenHeaders) {
      for (const header of expectations.forbiddenHeaders) {
        const headerValue = this.getHeader(response.headers, header);
        if (headerValue) {
          errors.push(`Forbidden header present: ${header}`);
        }
      }
    }
    
    // Validate body schema
    if (expectations.bodySchema && response.json) {
      const schemaErrors = this.validateSchema(response.json, expectations.bodySchema);
      errors.push(...schemaErrors);
    }
    
    // Validate body contains
    if (expectations.bodyContains) {
      for (const text of expectations.bodyContains) {
        if (!response.body.includes(text)) {
          errors.push(`Body does not contain: "${text}"`);
        }
      }
    }
    
    // Validate body regex
    if (expectations.bodyMatches) {
      const regex = new RegExp(expectations.bodyMatches);
      if (!regex.test(response.body)) {
        errors.push(`Body does not match pattern: ${expectations.bodyMatches}`);
      }
    }
    
    // Validate JSON path
    if (expectations.jsonPath && response.json) {
      for (const [path, expected] of Object.entries(expectations.jsonPath)) {
        const actual = this.getJsonPath(response.json, path);
        if (!this.matchValue(actual, expected)) {
          errors.push(`JSON path ${path}: expected "${expected}", got "${actual}"`);
        }
      }
    }
    
    // Custom validation function
    if (expectations.custom) {
      try {
        const customResult = expectations.custom(response);
        if (customResult === false) {
          errors.push('Custom validation failed');
        } else if (typeof customResult === 'string') {
          errors.push(customResult);
        } else if (customResult && customResult.errors) {
          errors.push(...customResult.errors);
        }
        if (customResult && customResult.warnings) {
          warnings.push(...customResult.warnings);
        }
      } catch (error) {
        errors.push(`Custom validation error: ${error.message}`);
      }
    }
    
    return {
      passed: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get header value (case-insensitive)
   */
  getHeader(headers, name) {
    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }
    return null;
  }

  /**
   * Match actual value against expected (supports regex, functions)
   */
  matchValue(actual, expected) {
    if (expected instanceof RegExp) {
      return expected.test(String(actual));
    }
    
    if (typeof expected === 'function') {
      return expected(actual);
    }
    
    if (expected === '*') {
      return actual !== undefined && actual !== null;
    }
    
    return actual === expected;
  }

  /**
   * Validate object against simple schema
   */
  validateSchema(obj, schema, path = '') {
    const errors = [];
    
    // Check type
    if (schema.type) {
      const actualType = Array.isArray(obj) ? 'array' : typeof obj;
      if (actualType !== schema.type) {
        errors.push(`${path || 'root'}: expected type ${schema.type}, got ${actualType}`);
        return errors;
      }
    }
    
    // Check required properties
    if (schema.required && schema.type === 'object') {
      for (const prop of schema.required) {
        if (!(prop in obj)) {
          errors.push(`${path || 'root'}: missing required property "${prop}"`);
        }
      }
    }
    
    // Check properties
    if (schema.properties && schema.type === 'object') {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (prop in obj) {
          const propPath = path ? `${path}.${prop}` : prop;
          errors.push(...this.validateSchema(obj[prop], propSchema, propPath));
        }
      }
    }
    
    // Check array items
    if (schema.items && schema.type === 'array') {
      obj.forEach((item, index) => {
        const itemPath = `${path || 'root'}[${index}]`;
        errors.push(...this.validateSchema(item, schema.items, itemPath));
      });
    }
    
    // Check enum values
    if (schema.enum) {
      if (!schema.enum.includes(obj)) {
        errors.push(`${path || 'root'}: value "${obj}" not in allowed values: ${schema.enum.join(', ')}`);
      }
    }
    
    // Check pattern
    if (schema.pattern && typeof obj === 'string') {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(obj)) {
        errors.push(`${path || 'root'}: value does not match pattern ${schema.pattern}`);
      }
    }
    
    return errors;
  }

  /**
   * Get value from JSON using simple path notation
   */
  getJsonPath(obj, path) {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      // Handle array indices
      const match = part.match(/^(.+)\[(\d+)\]$/);
      if (match) {
        current = current[match[1]];
        if (Array.isArray(current)) {
          current = current[parseInt(match[2], 10)];
        }
      } else {
        current = current[part];
      }
      
      if (current === undefined) {
        return undefined;
      }
    }
    
    return current;
  }

  /**
   * Validate Edge Mode specific requirements
   */
  validateEdgeMode(response) {
    const errors = [];
    
    // Check for loop detection headers
    if (response.headers['x-optimizely-loop-detected']) {
      errors.push('Loop detected in Edge Mode');
    }
    
    // Validate cache headers if caching is expected
    const cacheControl = this.getHeader(response.headers, 'cache-control');
    if (cacheControl && cacheControl.includes('no-cache')) {
      // This might be intentional, so just warn
      // warnings.push('Response has no-cache directive');
    }
    
    // Validate Set-Cookie format
    const setCookie = response.headers['set-cookie'] || response.headers['Set-Cookie'];
    if (setCookie) {
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      for (const cookie of cookies) {
        if (cookie.includes('\n') || cookie.includes('\r')) {
          errors.push('Invalid Set-Cookie header contains newlines');
        }
      }
    }
    
    return errors;
  }

  /**
   * Validate Agent Mode specific requirements
   */
  validateAgentMode(response) {
    const errors = [];
    
    // Check for valid JSON response
    if (!response.json && response.body) {
      try {
        JSON.parse(response.body);
      } catch (e) {
        errors.push('Response body is not valid JSON');
      }
    }
    
    // Validate decision structure
    if (response.json) {
      if (response.json.flagKey && !response.json.variationKey) {
        errors.push('Decision missing variationKey');
      }
    }
    
    return errors;
  }
}

module.exports = { Validator };