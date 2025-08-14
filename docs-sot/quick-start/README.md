# Quick Start Guide

Get up and running with Optimizely Edge Agent v2 in minutes.

## Choose Your Platform

| Platform | Setup Guide | Best For |
|----------|-------------|----------|
| **[Cloudflare Workers](./cloudflare.md)** | Workers deployment | Global edge distribution |
| **[Vercel Edge Functions](./vercel.md)** | Vercel platform | Next.js applications |
| **[Fastly Compute@Edge](./fastly.md)** | Fastly deployment | Enterprise edge computing |

## Prerequisites

- **Optimizely Project**: Active Feature Experimentation project
- **SDK Key**: Your project's SDK key from Optimizely
- **CDN Account**: Account on your chosen platform (Cloudflare/Vercel/Fastly)

## 5-Minute Setup (Universal)

### 1. Clone and Configure
```bash
git clone <repository-url>
cd optimizely-edge-agent
```

### 2. Environment Setup
```bash
# Set your SDK key
export OPTIMIZELY_SDK_KEY="your-sdk-key-here"

# Enable FEX processing
export OPTIMIZELY_ENABLE_FEX="true"
```

### 3. Platform Deployment
Choose your platform-specific guide:
- [Cloudflare Workers Setup](./cloudflare.md)
- [Vercel Edge Functions Setup](./vercel.md)  
- [Fastly Compute@Edge Setup](./fastly.md)

### 4. Test Your Deployment
```bash
# Make a test decision request
curl -X POST "https://your-deployment-url/api/decide" \
  -H "Content-Type: application/json" \
  -H "X-Optimizely-Enable-FEX: true" \
  -H "X-Optimizely-SDK-Key: your-sdk-key" \
  -d '{
    "userId": "test-user-123",
    "flagKey": "your-flag-key"
  }'
```

### 5. Verify Success
Expected response:
```json
{
  "enabled": true,
  "flagKey": "your-flag-key",
  "variationKey": "variation-name",
  "variables": { /* flag variables */ },
  "reasons": [ /* decision reasons */ ]
}
```

## Next Steps

### Learn the API
- **[API Reference](../api/)** - Complete endpoint documentation
- **[Common Use Cases](../examples/)** - Real-world examples
- **[Configuration Guide](../configuration/)** - Advanced setup options

### Optimize Your Setup
- **[Metrics & Monitoring](../metrics/)** - Track performance
- **[Security Setup](../security/)** - Secure your deployment
- **[Troubleshooting](../troubleshooting/)** - Solve common issues

### Migration from v1
- **[Migration Guide](../migration/)** - Complete v1 to v2 transition
- **[Breaking Changes](../migration/breaking-changes.md)** - What's different
- **[Migration Checklist](../migration/checklist.md)** - Step-by-step validation

## Support

- **[Troubleshooting Guide](../troubleshooting/)** - Common issues and solutions
- **[Community Forum](#)** - Get help from the community
- **[GitHub Issues](#)** - Report bugs and feature requests

---

**Ready to deploy?** Choose your platform guide above to get started!