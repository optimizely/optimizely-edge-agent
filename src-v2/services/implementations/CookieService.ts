import { ICookieService } from '../interfaces/ICookieService';
import { ILoggerAdapter } from '../../adapters/interfaces/ILoggerAdapter';
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { OptimizelyDecision } from '../interfaces/IDecisionService';
import { Cookie, 
         parseCookie, 
         createCookie, 
         serializeDecisions, 
         deserializeDecisions, 
         createDecisionsCookie as utilsCreateDecisionsCookie,
         createVisitorIdCookie as utilsCreateVisitorIdCookie } from '../../utils/CookieUtils';

/**
 * Service responsible for cookie management in the Optimizely Edge Agent.
 * Handles decision persistence, visitor ID tracking, and cookie format compatibility.
 */
export class CookieService implements ICookieService {
  private logger: ILoggerAdapter;
  private readonly logPrefix = '[v2][CookieService]';
  private readonly defaultDecisionsCookieName = 'optly_edge_decisions';
  private readonly defaultVisitorIdCookieName = 'optly_edge_visitor_id';
  private readonly defaultDecisionsCookieTTL = 600; // 10 minutes
  private readonly defaultVisitorIdCookieTTL = 86400 * 365; // 1 year
  private readonly defaultPath = '/';
  
  /**
   * Creates an instance of CookieService
   * @param logger - Logger adapter for logging
   */
  constructor(logger: ILoggerAdapter) {
    this.logger = logger;
  }
  
  /**
   * Extracts decisions from cookies in the request.
   * @param requestAdapter - The request adapter.
   * @returns A record of flag keys to decision objects or null if no decisions found.
   */
  getDecisionsFromCookies(requestAdapter: IRequestAdapter): Record<string, OptimizelyDecision> | null {
    const cookieHeader = requestAdapter.getHeader('cookie');
    if (!cookieHeader) {
      this.logger.debug(`${this.logPrefix} No cookie header found in request`);
      return null;
    }
    
    const cookies = parseCookie(cookieHeader);
    const serializedDecisions = cookies[this.defaultDecisionsCookieName];
    
    if (!serializedDecisions) {
      this.logger.debug(`${this.logPrefix} No decisions cookie found in request`);
      return null;
    }
    
    try {
      const decisions = deserializeDecisions(serializedDecisions);
      if (!decisions) {
        this.logger.debug(`${this.logPrefix} Failed to deserialize decisions cookie`);
        return null;
      }
      
      this.logger.debug(`${this.logPrefix} Successfully extracted decisions from cookie`);
      return decisions;
    } catch (error) {
      this.logger.error(`${this.logPrefix} Error deserializing decisions cookie:`, error);
      return null;
    }
  }
  
  /**
   * Creates a decision cookie for persistent bucketing.
   * @param decisions - The decision objects to store in the cookie.
   * @param options - Cookie configuration options.
   * @returns The generated cookie object.
   */
  createDecisionsCookie(
    decisions: Record<string, OptimizelyDecision>, 
    options?: { 
      cookieName?: string; 
      ttl?: number; 
      domain?: string; 
      secure?: boolean; 
      path?: string;
    }
  ): Cookie {
    const finalOptions = {
      cookieName: options?.cookieName || this.defaultDecisionsCookieName,
      ttl: options?.ttl ?? this.defaultDecisionsCookieTTL,
      domain: options?.domain,
      secure: options?.secure ?? false,
      path: options?.path || this.defaultPath
    };
    
    this.logger.debug(`${this.logPrefix} Creating decisions cookie with name ${finalOptions.cookieName}`);
    
    return utilsCreateDecisionsCookie(decisions, finalOptions);
  }
  
  /**
   * Extracts visitor ID from cookies in the request.
   * @param requestAdapter - The request adapter.
   * @returns The visitor ID string or null if not found.
   */
  getVisitorIdFromCookies(requestAdapter: IRequestAdapter): string | null {
    const cookieHeader = requestAdapter.getHeader('cookie');
    if (!cookieHeader) {
      return null;
    }
    
    const cookies = parseCookie(cookieHeader);
    const visitorId = cookies[this.defaultVisitorIdCookieName];
    
    if (visitorId) {
      this.logger.debug(`${this.logPrefix} Found visitor ID in cookie: ${visitorId}`);
    } else {
      this.logger.debug(`${this.logPrefix} No visitor ID cookie found`);
    }
    
    return visitorId || null;
  }
  
  /**
   * Creates a visitor ID cookie.
   * @param visitorId - The visitor ID to store in the cookie.
   * @param options - Cookie configuration options.
   * @returns The generated cookie object.
   */
  createVisitorIdCookie(
    visitorId: string,
    options?: { 
      cookieName?: string; 
      ttl?: number; 
      domain?: string; 
      secure?: boolean; 
      path?: string;
    }
  ): Cookie {
    const finalOptions = {
      cookieName: options?.cookieName || this.defaultVisitorIdCookieName,
      ttl: options?.ttl ?? this.defaultVisitorIdCookieTTL,
      domain: options?.domain,
      secure: options?.secure ?? false,
      path: options?.path || this.defaultPath
    };
    
    this.logger.debug(`${this.logPrefix} Creating visitor ID cookie for ${visitorId}`);
    
    return utilsCreateVisitorIdCookie(visitorId, finalOptions);
  }
  
  /**
   * Creates Set-Cookie headers from a list of cookies.
   * @param cookies - The list of cookies to convert to headers.
   * @returns An array of Set-Cookie header values.
   */
  createSetCookieHeaders(cookies: Cookie[]): string[] {
    return cookies.map(cookie => {
      const cookieString = createCookie(cookie.name, cookie.value, cookie.opts);
      this.logger.debug(`${this.logPrefix} Created Set-Cookie header: ${cookie.name}=... (value hidden)`);
      return cookieString;
    });
  }
  
  /**
   * Applies all cookie options from the configuration.
   * @param options - Base cookie options.
   * @param config - Configuration containing cookie settings.
   * @returns Updated cookie options with config applied.
   */
  applyCookieOptionsFromConfig(
    options: { 
      cookieName?: string; 
      ttl?: number; 
      domain?: string; 
      secure?: boolean; 
      path?: string;
    },
    config: Record<string, any>
  ): { 
    cookieName: string; 
    ttl: number; 
    domain?: string; 
    secure: boolean; 
    path: string;
  } {
    // Start with default options
    const result = {
      cookieName: options?.cookieName || this.defaultDecisionsCookieName,
      ttl: options?.ttl ?? this.defaultDecisionsCookieTTL,
      domain: options?.domain,
      secure: options?.secure ?? false,
      path: options?.path || this.defaultPath
    };
    
    // Override with config values if present
    if (config) {
      // Apply cookie name if it's for decisions or visitor ID
      if (result.cookieName === this.defaultDecisionsCookieName && config.decisionsCookieName) {
        result.cookieName = config.decisionsCookieName;
      } else if (result.cookieName === this.defaultVisitorIdCookieName && config.visitorIdCookieName) {
        result.cookieName = config.visitorIdCookieName;
      }
      
      // Apply TTL based on cookie type
      if (result.cookieName === this.defaultDecisionsCookieName && config.decisionsCookieTTL !== undefined) {
        result.ttl = config.decisionsCookieTTL;
      } else if (result.cookieName === this.defaultVisitorIdCookieName && config.visitorIdCookieTTL !== undefined) {
        result.ttl = config.visitorIdCookieTTL;
      } else if (config.decisionsCookieTTL !== undefined) {
        // For any other cookie name, check if it's explicitly set in options
        // In that case, we respect the TTL based on what was likely intended
        result.ttl = config.decisionsCookieTTL;
      }
      
      // Apply domain if provided
      if (config.cookieDomain !== undefined) {
        result.domain = config.cookieDomain;
      }
      
      // Apply secure flag if provided
      if (config.secureCookies !== undefined) {
        result.secure = !!config.secureCookies;
      }
      
      // Path is usually '/' but can be overridden
      if (config.cookiePath !== undefined) {
        result.path = config.cookiePath;
      }
    }
    
    return result;
  }
} 