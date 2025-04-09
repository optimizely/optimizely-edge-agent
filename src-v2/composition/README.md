# CDN-Specific Composition Pattern

This directory contains separate composition files for each supported CDN provider. The pattern is designed to optimize bundle size by allowing each deployment target to only include the necessary code for its specific platform.

## Why Separate Composition Files?

- **Bundle Size Optimization**: Each edge platform (Cloudflare, Vercel, Fastly) only needs to include code specific to its environment
- **Reduced Dependencies**: Each bundle only contains the dependencies needed for its target platform
- **Smaller Deployments**: Critical for edge environments with strict size limitations (e.g., Cloudflare Workers' 1MB limit)
- **Better Tree-Shaking**: Build tools can more effectively eliminate unused code

## Composition Files

- `cloudflareComposition.ts`: Specific to Cloudflare Workers environments
- `vercelComposition.ts`: Specific to Vercel Edge Functions environments
- `fastlyComposition.ts`: Specific to Fastly Compute@Edge environments

## Entry Points

The main entry point files (`index.ts`, `vercel.ts`, `fastly.js`) import only from their specific composition file:

- `index.ts` → `cloudflareComposition.ts` (Cloudflare)
- `vercel.ts` → `vercelComposition.ts` (Vercel)
- `fastly.js` → `fastlyComposition.ts` (Fastly)

## Best Practices for Extensions

When adding new functionality:

1. Add shared interfaces/contracts to the respective interface files
2. Implement CDN-specific versions in each adapter implementation directory
3. Update the relevant composition file(s) as needed
4. Avoid cross-importing between composition files

## Build Configuration

For optimal bundle size reduction, your build process should be configured to:

1. Use a different entry point for each CDN target
2. Apply tree-shaking to eliminate unused code
3. Generate separate bundles for each target platform

Example build targets:
- `npm run build:cloudflare`
- `npm run build:vercel`
- `npm run build:fastly` 