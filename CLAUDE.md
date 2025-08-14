- Never restart a node js server or wrangler dev server. Ask me if you need to restart any server as they are outside your context.

# Project Configuration

## Optimizely Test Credentials
- **SDK Key**: 8mR1pGh8u2ztUP8GqjmQq
- **Flag**: test-flag  
- **Admin Token**: dev-admin-token

These are the ONLY valid credentials to use for testing. Do not use any other SDK keys.

## Current Deployment Status (August 13, 2025)
- **Cloudflare Test Environment**: https://edge-agent-test.expedge.workers.dev
- **Status**: ✅ Fully functional with all v1 parameter support
- **Default Origin**: https://edgeagent.demo.optimizely.com

## Recent Fixes Applied
- All v1 configuration parameters now supported in v2
- Visitor ID override working across header/query/body
- Cookie handling fixed (no base64, proper merging)
- Fallback to default origin when Optimizely disabled
- Browser testing via query parameters enabled

## Test URLs
```bash
# Browser testing with query parameters
https://edge-agent-test.expedge.workers.dev/?enable_optimizely=true&override_visitor_id=true
```

## Next Priority: Vercel Adapter
- Investigate Vercel adapter implementation
- Check for similar parameter issues as found in Cloudflare
- Test Vercel KV storage integration
- Verify deployment process