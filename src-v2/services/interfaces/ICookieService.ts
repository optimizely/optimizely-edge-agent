import { Cookie } from '../../utils/CookieUtils';
import { IRequestAdapter } from '../../adapters/interfaces/IRequestAdapter';
import { OptimizelyDecision } from './IDecisionService';

/**
 * @interface ICookieService
 * @description Defines the contract for cookie management operations.
 */
export interface ICookieService {
  /**
   * Extracts decisions from cookies in the request.
   * @param requestAdapter - The request adapter.
   * @returns A record of flag keys to decision objects or null if no decisions found.
   */
  getDecisionsFromCookies(requestAdapter: IRequestAdapter): Record<string, OptimizelyDecision> | null;
  
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
  ): Cookie;
  
  /**
   * Extracts visitor ID from cookies in the request.
   * @param requestAdapter - The request adapter.
   * @returns The visitor ID string or null if not found.
   */
  getVisitorIdFromCookies(requestAdapter: IRequestAdapter): string | null;
  
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
  ): Cookie;
  
  /**
   * Creates Set-Cookie headers from a list of cookies.
   * @param cookies - The list of cookies to convert to headers.
   * @returns An array of Set-Cookie header values.
   */
  createSetCookieHeaders(cookies: Cookie[]): string[];
  
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
  };
} 