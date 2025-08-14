/**
 * Custom type definitions for tests
 */

// Import Cloudflare Worker types
/// <reference types="@cloudflare/workers-types" />

// Declare any additional required types here 
// that aren't covered by the existing type definitions

// Vercel types (simplified for testing)
declare interface VercelKVNamespace {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list?(options?: { prefix?: string, limit?: number, cursor?: string }): Promise<{ keys: { name: string }[], list_complete: boolean, cursor?: string }>;
}

// Fastly types (simplified for testing)
declare interface FastlyKVNamespace {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
} 