/**
 * Type representing a generic HTTP response that can be used across different platforms
 */
type HttpResponse = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  cookies: Record<string, string>;
}

export type { HttpResponse };
