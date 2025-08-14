/**
 * Polyfills for Edge runtime compatibility
 * The Optimizely SDK requires certain APIs that aren't available in Edge runtime
 */

// Polyfill for crypto.randomUUID if not available
if (typeof globalThis !== 'undefined' && !globalThis.crypto?.randomUUID) {
  const crypto = globalThis.crypto || {};
  
  // Simple UUID v4 generator
  crypto.randomUUID = function(): `${string}-${string}-${string}-${string}-${string}` {
    // Generate random values
    const getRandomValues = crypto.getRandomValues?.bind(crypto) || 
      ((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      });
    
    const arr = new Uint8Array(16);
    getRandomValues(arr);
    
    // Set version (4) and variant bits
    arr[6] = (arr[6] & 0x0f) | 0x40; // Version 4
    arr[8] = (arr[8] & 0x3f) | 0x80; // Variant 10
    
    // Format as UUID string
    const hex = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32)
    ].join('-') as `${string}-${string}-${string}-${string}-${string}`;
  };
  
  if (!globalThis.crypto) {
    (globalThis as any).crypto = crypto;
  } else {
    (globalThis.crypto as any).randomUUID = crypto.randomUUID;
  }
}

// Ensure global performance.now is available
if (typeof globalThis !== 'undefined' && !globalThis.performance?.now) {
  const performance = globalThis.performance || {};
  const startTime = Date.now();
  
  performance.now = function(): number {
    return Date.now() - startTime;
  };
  
  if (!globalThis.performance) {
    (globalThis as any).performance = performance;
  }
}

// Export to ensure module is loaded
export const edgePolyfillsLoaded = true;