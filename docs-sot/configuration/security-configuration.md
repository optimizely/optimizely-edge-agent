# Security Configuration

## Overview

Security is paramount when deploying the Optimizely Edge Agent in production environments. This document covers all security-related configuration options, best practices, and implementation guidelines to ensure your Edge Agent deployment is secure and compliant.

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Security Layer Architecture                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Request ──▶ Rate Limiting ──▶ Authentication ──▶ Authorization ──▶ Processing │
│                   │                  │                 │                        │
│                   ▼                  ▼                 ▼                        │
│              IP Filtering      Token/API Key    Role-Based              │
│              DDoS Protection    Validation      Permissions             │
│                                                                          │
│  Security Controls:                                                      │
│  ┌─────────────────┬─────────────────────┬─────────────────────┐      │
│  │  Network Layer  │  Application Layer  │    Data Layer       │      │
│  ├─────────────────┼─────────────────────┼─────────────────────┤      │
│  │ • Firewall      │ • Authentication    │ • Encryption        │      │
│  │ • Rate Limits   │ • CORS             │ • Key Management    │      │
│  │ • IP Allowlist  │ • Input Validation │ • Data Sanitization │      │
│  └─────────────────┴─────────────────────┴─────────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Authentication

### API Key Authentication

```typescript
// From: /src-v2/services/implementations/ApiRouter.ts
interface ApiKeyAuthConfig {
  // Enable API key authentication
  enabled: boolean;                    // Default: false
  
  // Key configuration
  headerName: string;                  // Default: 'X-API-Key'
  queryParamName: string;             // Default: 'api_key'
  cookieName?: string;                // Optional: cookie-based auth
  
  // Key validation
  keyFormat: RegExp;                  // Default: /^[a-zA-Z0-9]{32,64}$/
  keyRotationDays: number;            // Default: 90
  
  // Key storage
  storageBackend: 'kv' | 'env' | 'custom';
  keyPrefix: string;                  // Default: 'api_key:'
}

// Implementation example
class ApiKeyAuthenticator {
  async authenticate(request: IRequestAdapter): Promise<boolean> {
    // Extract API key from multiple sources
    const apiKey = 
      request.getHeader(this.config.headerName) ||
      request.getQueryParam(this.config.queryParamName) ||
      this.extractFromCookie(request);
    
    if (!apiKey) {
      return false;
    }
    
    // Validate format
    if (!this.config.keyFormat.test(apiKey)) {
      this.logger.warn('Invalid API key format');
      return false;
    }
    
    // Check key validity
    const keyData = await this.storage.get(`${this.config.keyPrefix}${apiKey}`);
    if (!keyData) {
      return false;
    }
    
    // Check expiration
    if (keyData.expiresAt < Date.now()) {
      await this.storage.delete(`${this.config.keyPrefix}${apiKey}`);
      return false;
    }
    
    return true;
  }
}
```

### Bearer Token Authentication

```typescript
interface BearerTokenConfig {
  enabled: boolean;                    // Default: false
  
  // Token configuration
  tokenType: 'JWT' | 'opaque';       // Default: 'JWT'
  issuer?: string;                    // JWT issuer
  audience?: string;                  // JWT audience
  
  // Validation
  publicKey?: string;                 // For JWT validation
  introspectionEndpoint?: string;     // For opaque tokens
  
  // Token handling
  extractFrom: ('header' | 'cookie' | 'query')[];
  headerFormat: string;               // Default: 'Bearer {token}'
  
  // Caching
  cacheValidatedTokens: boolean;      // Default: true
  tokenCacheTTL: number;             // Default: 300 (5 minutes)
}

// JWT validation example
import { verify } from 'jsonwebtoken';

class JWTAuthenticator {
  async authenticate(token: string): Promise<AuthResult> {
    try {
      const decoded = verify(token, this.config.publicKey, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ['RS256']
      });
      
      return {
        authenticated: true,
        userId: decoded.sub,
        permissions: decoded.permissions || []
      };
    } catch (error) {
      this.logger.error('JWT validation failed', error);
      return { authenticated: false };
    }
  }
}
```

### Custom Authentication

```typescript
interface CustomAuthConfig {
  // Custom auth handler
  handler: AuthHandler;
  
  // Cache authenticated requests
  cacheAuthentication: boolean;       // Default: true
  cacheTTL: number;                  // Default: 300
  
  // Multi-factor support
  requireMFA: boolean;               // Default: false
  mfaMethods: ('totp' | 'sms' | 'email')[];
}

// Custom auth handler interface
interface AuthHandler {
  authenticate(request: IRequestAdapter): Promise<AuthResult>;
  validateMFA?(request: IRequestAdapter, method: string): Promise<boolean>;
}
```

## Authorization

### Role-Based Access Control (RBAC)

```typescript
interface RBACConfig {
  enabled: boolean;                   // Default: false
  
  // Role definitions
  roles: Record<string, Role>;
  
  // Default role
  defaultRole: string;               // Default: 'viewer'
  
  // Permission checking
  enforcePermissions: boolean;       // Default: true
  permissionDeniedMessage: string;
}

interface Role {
  name: string;
  permissions: Permission[];
  inherits?: string[];               // Inherit from other roles
}

interface Permission {
  resource: string;                  // e.g., 'decide', 'datafile'
  actions: string[];                 // e.g., ['read', 'write']
  conditions?: Record<string, any>;  // Optional conditions
}

// Example configuration
const rbacConfig: RBACConfig = {
  enabled: true,
  roles: {
    admin: {
      name: 'admin',
      permissions: [
        { resource: '*', actions: ['*'] }
      ]
    },
    developer: {
      name: 'developer',
      permissions: [
        { resource: 'decide', actions: ['read'] },
        { resource: 'datafile', actions: ['read'] },
        { resource: 'flags', actions: ['read'] }
      ]
    },
    viewer: {
      name: 'viewer',
      permissions: [
        { resource: 'health', actions: ['read'] }
      ]
    }
  }
};
```

### SDK Key Security

```typescript
interface SDKKeySecurityConfig {
  // Validation
  validateSDKKey: boolean;            // Default: true
  allowedSDKKeys: string[];          // Whitelist specific keys
  
  // Key format
  keyPattern: RegExp;                // Default: /^[A-Za-z0-9]{20,}$/
  
  // Environment binding
  enforceEnvironment: boolean;        // Default: true
  environmentMapping: Record<string, string[]>;
  
  // Usage limits
  rateLimitPerKey: boolean;          // Default: true
  keyQuotas: Record<string, number>; // Requests per hour
}

// SDK key validation
class SDKKeyValidator {
  validate(sdkKey: string, environment: string): ValidationResult {
    // Check format
    if (!this.config.keyPattern.test(sdkKey)) {
      return { valid: false, reason: 'Invalid SDK key format' };
    }
    
    // Check whitelist
    if (this.config.allowedSDKKeys.length > 0 && 
        !this.config.allowedSDKKeys.includes(sdkKey)) {
      return { valid: false, reason: 'SDK key not allowed' };
    }
    
    // Check environment binding
    if (this.config.enforceEnvironment) {
      const allowedEnvs = this.config.environmentMapping[sdkKey];
      if (allowedEnvs && !allowedEnvs.includes(environment)) {
        return { valid: false, reason: 'SDK key not valid for environment' };
      }
    }
    
    return { valid: true };
  }
}
```

## Network Security

### Rate Limiting

```typescript
interface RateLimitingConfig {
  enabled: boolean;                   // Default: true
  
  // Global limits
  globalRequestsPerMinute: number;    // Default: 10000
  globalRequestsPerHour: number;      // Default: 100000
  
  // Per-client limits
  clientRequestsPerMinute: number;    // Default: 1000
  clientRequestsPerHour: number;      // Default: 10000
  
  // Identification
  identifyBy: 'ip' | 'apikey' | 'userid' | 'custom';
  
  // Burst handling
  burstSize: number;                 // Default: 50
  burstWindow: number;               // Default: 1000 (ms)
  
  // Response
  rateLimitHeaders: boolean;         // Default: true
  customErrorMessage?: string;
  
  // Whitelisting
  whitelist: string[];              // IPs/keys to bypass limits
}

// Rate limiter implementation
class RateLimiter {
  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    
    // Get current usage
    const usage = await this.storage.get(key) || {
      count: 0,
      resetAt: now + 60000
    };
    
    // Check if window expired
    if (now > usage.resetAt) {
      usage.count = 0;
      usage.resetAt = now + 60000;
    }
    
    // Check limit
    if (usage.count >= this.config.clientRequestsPerMinute) {
      return {
        allowed: false,
        limit: this.config.clientRequestsPerMinute,
        remaining: 0,
        resetAt: usage.resetAt
      };
    }
    
    // Increment and save
    usage.count++;
    await this.storage.put(key, usage, { expirationTtl: 60 });
    
    return {
      allowed: true,
      limit: this.config.clientRequestsPerMinute,
      remaining: this.config.clientRequestsPerMinute - usage.count,
      resetAt: usage.resetAt
    };
  }
}
```

### IP Filtering

```typescript
interface IPFilteringConfig {
  enabled: boolean;                   // Default: false
  
  // Whitelist/Blacklist
  mode: 'whitelist' | 'blacklist';  // Default: 'blacklist'
  
  // IP lists
  whitelist: string[];              // Allowed IPs/CIDR blocks
  blacklist: string[];              // Blocked IPs/CIDR blocks
  
  // Geo-blocking
  geoBlocking: {
    enabled: boolean;
    blockedCountries: string[];     // ISO country codes
    allowedCountries: string[];
  };
  
  // Cloud provider detection
  blockCloudProviders: boolean;      // Default: false
  cloudProviderASNs: number[];
}

// IP filter implementation
class IPFilter {
  async checkIP(request: IRequestAdapter): Promise<boolean> {
    const clientIP = this.getClientIP(request);
    
    // Check blacklist
    if (this.isInList(clientIP, this.config.blacklist)) {
      this.logger.warn('Blocked blacklisted IP', { ip: clientIP });
      return false;
    }
    
    // Check whitelist (if mode is whitelist)
    if (this.config.mode === 'whitelist' && 
        !this.isInList(clientIP, this.config.whitelist)) {
      this.logger.warn('Blocked non-whitelisted IP', { ip: clientIP });
      return false;
    }
    
    // Check geo-blocking
    if (this.config.geoBlocking.enabled) {
      const country = request.getHeader('cf-ipcountry') || 
                     await this.geoLookup(clientIP);
      
      if (this.config.geoBlocking.blockedCountries.includes(country)) {
        return false;
      }
    }
    
    return true;
  }
}
```

## Data Security

### Encryption Configuration

```typescript
interface EncryptionConfig {
  // Transport encryption
  enforceHTTPS: boolean;             // Default: true
  hstsMaxAge: number;               // Default: 31536000 (1 year)
  
  // Data encryption
  encryptSensitiveData: boolean;    // Default: true
  encryptionAlgorithm: string;      // Default: 'aes-256-gcm'
  
  // Key management
  keyRotationInterval: number;       // Default: 2592000000 (30 days)
  keyDerivationFunction: string;    // Default: 'pbkdf2'
  
  // Field-level encryption
  encryptedFields: string[];        // Fields to encrypt
}

// Encryption service
class EncryptionService {
  encrypt(data: any, fields: string[]): any {
    const encrypted = { ...data };
    
    for (const field of fields) {
      if (field in encrypted) {
        encrypted[field] = this.encryptValue(encrypted[field]);
      }
    }
    
    return encrypted;
  }
  
  private encryptValue(value: any): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.config.encryptionAlgorithm,
      this.currentKey,
      iv
    );
    
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final()
    ]);
    
    return `${iv.toString('base64')}:${encrypted.toString('base64')}`;
  }
}
```

### Input Validation

```typescript
interface InputValidationConfig {
  // Enable validation
  enableValidation: boolean;         // Default: true
  
  // Validation rules
  maxStringLength: number;          // Default: 10000
  maxObjectDepth: number;          // Default: 10
  maxArrayLength: number;          // Default: 1000
  
  // Sanitization
  sanitizeHTML: boolean;           // Default: true
  stripNullBytes: boolean;         // Default: true
  
  // SQL injection prevention
  detectSQLInjection: boolean;      // Default: true
  sqlPatterns: RegExp[];
  
  // XSS prevention
  detectXSS: boolean;              // Default: true
  xssPatterns: RegExp[];
}

// Input validator
class InputValidator {
  validate(input: any, path: string = ''): ValidationResult {
    // Check depth
    if (this.getDepth(input) > this.config.maxObjectDepth) {
      return { valid: false, error: 'Object too deep' };
    }
    
    // Validate strings
    if (typeof input === 'string') {
      if (input.length > this.config.maxStringLength) {
        return { valid: false, error: 'String too long' };
      }
      
      // Check for SQL injection
      if (this.config.detectSQLInjection && this.hasSQLInjection(input)) {
        return { valid: false, error: 'Potential SQL injection' };
      }
      
      // Check for XSS
      if (this.config.detectXSS && this.hasXSS(input)) {
        return { valid: false, error: 'Potential XSS' };
      }
    }
    
    // Recursively validate objects/arrays
    if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        const result = this.validate(value, `${path}.${key}`);
        if (!result.valid) return result;
      }
    }
    
    return { valid: true };
  }
}
```

## Security Headers

### Response Security Headers

```typescript
interface SecurityHeadersConfig {
  // Enable security headers
  enabled: boolean;                  // Default: true
  
  // Specific headers
  headers: {
    // HSTS
    strictTransportSecurity?: string; // Default: 'max-age=31536000; includeSubDomains'
    
    // Content Security Policy
    contentSecurityPolicy?: string;   // Default: "default-src 'self'"
    
    // Other security headers
    xContentTypeOptions?: string;     // Default: 'nosniff'
    xFrameOptions?: string;          // Default: 'DENY'
    xXssProtection?: string;         // Default: '1; mode=block'
    referrerPolicy?: string;         // Default: 'strict-origin-when-cross-origin'
    
    // Permissions Policy
    permissionsPolicy?: string;      // Default: 'geolocation=(), camera=()'
  };
  
  // Custom headers
  customHeaders?: Record<string, string>;
}

// Security headers middleware
class SecurityHeadersMiddleware {
  apply(response: IResponseAdapter): void {
    if (!this.config.enabled) return;
    
    // Apply configured headers
    for (const [header, value] of Object.entries(this.config.headers)) {
      if (value) {
        response.setHeader(this.headerName(header), value);
      }
    }
    
    // Apply custom headers
    if (this.config.customHeaders) {
      for (const [header, value] of Object.entries(this.config.customHeaders)) {
        response.setHeader(header, value);
      }
    }
  }
  
  private headerName(key: string): string {
    // Convert camelCase to Header-Case
    return key.replace(/([A-Z])/g, '-$1')
              .replace(/^-/, '')
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join('-');
  }
}
```

## Secrets Management

### Secret Storage

```typescript
interface SecretManagementConfig {
  // Secret storage backend
  backend: 'env' | 'kv' | 'vault' | 'custom';
  
  // Encryption at rest
  encryptSecrets: boolean;          // Default: true
  
  // Access control
  secretAccessAudit: boolean;       // Default: true
  
  // Rotation
  autoRotation: boolean;            // Default: false
  rotationInterval: number;         // Default: 7776000000 (90 days)
  
  // Validation
  validateSecretFormat: boolean;    // Default: true
  secretPatterns: Record<string, RegExp>;
}

// Secret manager
class SecretManager {
  async getSecret(name: string): Promise<string | null> {
    // Audit access
    if (this.config.secretAccessAudit) {
      await this.auditAccess(name);
    }
    
    // Retrieve from backend
    const encrypted = await this.backend.get(name);
    if (!encrypted) return null;
    
    // Decrypt if needed
    if (this.config.encryptSecrets) {
      return this.decrypt(encrypted);
    }
    
    return encrypted;
  }
  
  async rotateSecret(name: string): Promise<void> {
    const newValue = this.generateSecret(name);
    
    // Validate format
    if (this.config.validateSecretFormat) {
      const pattern = this.config.secretPatterns[name];
      if (pattern && !pattern.test(newValue)) {
        throw new Error('Invalid secret format');
      }
    }
    
    // Store new value
    await this.setSecret(name, newValue);
    
    // Log rotation
    this.logger.info('Secret rotated', { name, timestamp: Date.now() });
  }
}
```

## Audit and Compliance

### Audit Logging

```typescript
interface AuditConfig {
  // Enable audit logging
  enabled: boolean;                  // Default: true
  
  // What to log
  logRequests: boolean;             // Default: true
  logResponses: boolean;            // Default: false
  logAuthAttempts: boolean;         // Default: true
  logConfigChanges: boolean;        // Default: true
  
  // PII handling
  maskPII: boolean;                // Default: true
  piiFields: string[];             // Fields containing PII
  
  // Storage
  storageBackend: 'local' | 'remote' | 'siem';
  retentionDays: number;           // Default: 90
}

// Audit logger
class AuditLogger {
  async logRequest(request: IRequestAdapter, response: IResponseAdapter): Promise<void> {
    const entry: AuditEntry = {
      timestamp: Date.now(),
      requestId: request.id,
      method: request.method,
      path: request.path,
      clientIP: this.getClientIP(request),
      userAgent: request.getHeader('user-agent'),
      statusCode: response.status,
      duration: response.duration,
      userId: request.userId,
      action: this.determineAction(request),
      result: response.status < 400 ? 'success' : 'failure'
    };
    
    // Mask PII if configured
    if (this.config.maskPII) {
      entry.requestBody = this.maskPIIFields(request.body);
    }
    
    await this.storage.write(entry);
  }
}
```

### Compliance Configuration

```typescript
interface ComplianceConfig {
  // GDPR compliance
  gdpr: {
    enabled: boolean;
    dataRetentionDays: number;
    allowDataExport: boolean;
    allowDataDeletion: boolean;
  };
  
  // CCPA compliance
  ccpa: {
    enabled: boolean;
    doNotSellHeader: string;        // Default: 'Sec-GPC'
    optOutCookie: string;          // Default: 'ccpa_opt_out'
  };
  
  // SOC2 compliance
  soc2: {
    enabled: boolean;
    enforceEncryption: boolean;
    auditAllAccess: boolean;
  };
}
```

## Security Monitoring

### Threat Detection

```typescript
interface ThreatDetectionConfig {
  // Enable threat detection
  enabled: boolean;                  // Default: true
  
  // Detection rules
  rules: ThreatRule[];
  
  // Actions
  blockThreats: boolean;            // Default: true
  alertThreats: boolean;            // Default: true
  
  // Thresholds
  suspiciousRequestThreshold: number; // Default: 10 per minute
  bruteForceThreshold: number;       // Default: 5 failed auths
}

interface ThreatRule {
  name: string;
  pattern: RegExp | string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'block' | 'alert' | 'log';
}
```

## Best Practices

### 1. Defense in Depth

```typescript
// Layer multiple security controls
const securityConfig = {
  // Network layer
  rateLimit: { enabled: true },
  ipFilter: { enabled: true },
  
  // Application layer
  auth: { enabled: true },
  inputValidation: { enabled: true },
  
  // Data layer
  encryption: { enabled: true },
  secretManagement: { enabled: true }
};
```

### 2. Principle of Least Privilege

```typescript
// Grant minimal necessary permissions
const rbacConfig = {
  defaultRole: 'viewer',  // Minimal by default
  roles: {
    viewer: {
      permissions: [
        { resource: 'health', actions: ['read'] }
      ]
    }
  }
};
```

### 3. Regular Security Audits

```typescript
// Automated security checks
class SecurityAuditor {
  async runAudit(): Promise<AuditReport> {
    const checks = [
      this.checkWeakPasswords(),
      this.checkExpiredKeys(),
      this.checkUnusedPermissions(),
      this.checkVulnerabilities()
    ];
    
    const results = await Promise.all(checks);
    return this.generateReport(results);
  }
}
```

## See Also

- [Authentication Guide](/docs-sot/security/authentication.md)
- [Encryption Guide](/docs-sot/security/encryption.md)
- [Compliance Guide](/docs-sot/security/compliance.md)
- [Security Checklist](/docs-sot/security/checklist.md)