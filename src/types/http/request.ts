/**
 * Type representing a generic HTTP request that can be used across different platforms
 */
type HttpRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  cookies: Record<string, string>;
  ip?: string;
  userAgent?: string;
}

export type { HttpRequest };
