# Customer Deployment Patterns for Optimizely Edge Agent

## Overview

This document explains how customers can deploy Optimizely Edge Agent in various scenarios and clarifies the Cloudflare same-zone restriction.

## Key Concept: Same-Zone Restriction

**The same-zone fetch restriction ONLY applies to Cloudflare-to-Cloudflare services in the same zone.**

✅ **These scenarios work perfectly:**
- Cloudflare Worker → AWS/External origin
- Cloudflare Worker → Customer's Kubernetes cluster
- Cloudflare Worker → Any non-Cloudflare hosting

❌ **This scenario requires special handling:**
- Cloudflare Worker → Another Cloudflare Worker/Pages (same zone)

## Common Customer Deployment Patterns

### Pattern 1: Cloudflare Worker + External Origin (Most Common)

```
┌─────────────────────┐         ┌─────────────────────┐
│  Cloudflare Worker  │   ───>  │   AWS/Kubernetes    │
│  (Edge Agent)       │  fetch  │  (Customer Site)    │
│  customer.com/*     │   OK!   │  origin.customer.com│
└─────────────────────┘         └─────────────────────┘
```

**Configuration:**
```javascript
// This works perfectly - no restrictions!
{
  "cdnVariationSettings": {
    "cdnExperimentURL": "https://customer.com/*",
    "cdnResponseURL": "https://origin.customer.com/page-variation-a"
  }
}
```

### Pattern 2: Cloudflare Worker + Cloudflare Pages (Same Customer)

If the customer uses both Cloudflare Workers and Pages:

**Option A: Use Custom Domains**
```toml
# Worker on api.customer.com (custom domain)
# Pages on www.customer.com (custom domain)
# ✅ These can fetch from each other
```

**Option B: Use Service Bindings**
```toml
[[services]]
binding = "PAGES_SERVICE"
service = "customer-pages"
```

### Pattern 3: Multi-CDN Setup

Some customers use multiple CDNs:

```
┌─────────────────────┐         ┌─────────────────────┐
│  Cloudflare Worker  │   ───>  │   Fastly/Akamai    │
│  (Edge Agent)       │  fetch  │  (Content CDN)      │
│  api.customer.com   │   OK!   │  cdn.customer.com   │
└─────────────────────┘         └─────────────────────┘
```

## Implementation Examples

### Example 1: E-commerce Site on AWS

**Customer Setup:**
- Main site: AWS ECS/Fargate
- Edge optimization: Cloudflare Workers
- Domain: shop.example.com

**Edge Agent Configuration:**
```javascript
const cdnVariationSettings = {
  // Worker handles this URL
  "cdnExperimentURL": "https://shop.example.com/products/*",
  
  // Fetches from AWS origin - works perfectly!
  "cdnResponseURL": "https://origin-aws.example.com/products/variation-b",
  
  "forwardRequestToOrigin": "false",
  "cacheRequestToOrigin": "true"
};
```

### Example 2: SaaS Platform on Kubernetes

**Customer Setup:**
- Application: Kubernetes on GKE
- Edge logic: Cloudflare Workers
- Domain: app.saas.com

**Edge Agent Configuration:**
```javascript
const cdnVariationSettings = {
  // Worker intercepts these paths
  "cdnExperimentURL": "https://app.saas.com/dashboard",
  
  // Fetches from K8s cluster - no issues!
  "cdnResponseURL": "https://k8s-ingress.saas.com/dashboard/new-ui",
  
  "forwardRequestToOrigin": "false",
  "cacheRequestToOrigin": "true"
};
```

### Example 3: Media Site with Cloudflare Pages

**Customer Setup:**
- Static content: Cloudflare Pages
- API/Edge logic: Cloudflare Workers
- Domain: media.example.com

**Solution: Use Custom Domains**
```toml
# wrangler.toml for Worker
[[routes]]
pattern = "api.media.example.com/*"
custom_domain = true

# Pages custom domain
# pages.media.example.com
```

**Edge Agent Configuration:**
```javascript
const cdnVariationSettings = {
  "cdnExperimentURL": "https://api.media.example.com/*",
  
  // Custom domain allows this fetch!
  "cdnResponseURL": "https://pages.media.example.com/article/variation",
  
  "forwardRequestToOrigin": "false"
};
```

## Best Practices for Customers

### 1. External Origins (Most Common)
- No special configuration needed
- Works with any hosting provider
- Full flexibility in content management

### 2. Cloudflare-Only Stack
- Use Custom Domains for different services
- Consider Service Bindings for tighter integration
- Plan subdomain structure carefully

### 3. Hybrid Approach
- Use Cloudflare Workers for edge logic
- Keep content on existing infrastructure
- Gradual migration path available

## FAQ

**Q: Can Edge Agent fetch from my AWS-hosted site?**
A: Yes! There are no restrictions on fetching from external origins.

**Q: We use Cloudflare for everything. Will we have issues?**
A: Only if you're trying to fetch between Workers/Pages on the same zone. Use Custom Domains or Service Bindings to solve this.

**Q: Can we test locally before deploying?**
A: Yes! Use the `?force-edge-mode=true` parameter for local testing.

**Q: What about CORS?**
A: Configure CORS on your origin server to allow requests from your Worker domain.

## Migration Guide

### From Traditional CDN to Edge Agent

1. **Keep your origin as-is** (AWS, GCP, on-premise)
2. **Deploy Edge Agent** to Cloudflare Workers
3. **Configure routing** in Optimizely
4. **Test with subset** of traffic
5. **Gradual rollout** based on results

### From Cloudflare Pages to Edge Agent

1. **Set up Custom Domains** for Pages
2. **Deploy Edge Agent** with Custom Domain
3. **Update cdnVariationSettings** to use new domains
4. **Test thoroughly** before full rollout

## Support

For deployment assistance:
- Review this guide
- Check Cloudflare Workers documentation
- Contact Optimizely support for Edge Agent specific questions