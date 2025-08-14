# Documentation Migration Plan to Source of Truth

## Overview

This plan consolidates all valuable Optimizely Edge Agent v2 documentation from scattered locations into the centralized `/docs-sot/` structure, creating a single authoritative source.

## Current Documentation Landscape

### Excellent Content to Migrate
**Source**: `/src-v2/docs/` (Internal documentation - high quality)
- `README.md` → Architecture overview and testing guides
- `cdn-adapters.md` → CDN platform guides  
- `metrics.md` → Monitoring and observability

### Good Content to Refactor
**Source**: `/documentation/` and `/docs-revised/`
- Migration analysis (comprehensive v1-v2 comparison)
- Architecture comparisons
- API interaction guides

### Content to Replace
**Source**: `/05-22-2025_docs/` (Invalid conversation logs)
- Replace with proper API documentation extracted from implementation

## Migration Strategy

### Phase 1: Foundation Setup ✅ COMPLETE
- [x] Create `/docs-sot/` directory structure
- [x] Establish documentation standards
- [x] Define organizational principles

### Phase 2: High-Quality Content Migration (Week 1)

#### Extract from `/src-v2/docs/` (Exemplary Quality)
```bash
# CDN Adapters Documentation
cp /src-v2/docs/cdn-adapters.md /docs-sot/cdn-adapters/overview.md

# Metrics Documentation  
cp /src-v2/docs/metrics.md /docs-sot/metrics/overview.md

# Testing and Development Guide
# Extract relevant sections from /src-v2/docs/README.md
```

**Actions**:
1. **Migrate CDN adapter documentation** → `/docs-sot/cdn-adapters/`
2. **Migrate metrics documentation** → `/docs-sot/metrics/`
3. **Extract development setup** from README → `/docs-sot/development/`

#### Create API Documentation from Implementation
```bash
# Source: /src-v2/services/implementations/ApiRouter.ts
# Target: /docs-sot/api/
```

**Actions**:
1. **Extract all 15+ endpoints** from ApiRouter.ts implementation
2. **Document authentication requirements** from actual code
3. **Create endpoint reference** with parameters from ConfigurationService.ts
4. **Add practical examples** for each endpoint

### Phase 3: Architecture and Migration Content (Week 2)

#### Consolidate Migration Documentation
**Sources**: 
- `/documentation/migration-considerations.md` (excellent technical analysis)
- `/documentation/v1-v2-parity-tracker.md` (comprehensive gap analysis)  
- `/documentation/functional-parity-verification.md` (detailed comparison)

**Target**: `/docs-sot/migration/`

**Actions**:
1. **Combine migration analyses** into comprehensive migration guide
2. **Extract practical migration steps** into step-by-step procedures
3. **Create migration validation checklist**

#### Consolidate Architecture Documentation
**Sources**:
- `/docs-revised/01-v2-implementation-reference-summary.md` (good architectural overview)
- Various architecture analysis documents

**Target**: `/docs-sot/architecture/`

**Actions**:
1. **Extract architectural patterns** and consolidate
2. **Add implementation references** to actual `/src-v2/` code
3. **Create service interaction guides**

### Phase 4: User-Facing Documentation (Week 3)

#### Create Quick Start Guides
**Target**: `/docs-sot/quick-start/`

**Content**:
- Platform-specific setup (Cloudflare, Vercel, Fastly)
- Basic configuration examples
- First API call tutorials
- Verification procedures

#### Create Configuration Documentation
**Source**: Extract from ConfigurationService.ts implementation  
**Target**: `/docs-sot/configuration/`

**Content**:
- Environment variables reference
- Parameter precedence rules (Headers > Query > Body)
- Platform-specific configuration
- Advanced configuration scenarios

#### Create Examples Repository
**Target**: `/docs-sot/examples/`

**Content**:
- Working code examples for each CDN platform
- Common use case implementations
- Integration patterns
- Testing examples

### Phase 5: Support Documentation (Week 4)

#### Create Troubleshooting Guide
**Target**: `/docs-sot/troubleshooting/`

**Content**:
- Common error scenarios and solutions
- Migration troubleshooting
- Performance optimization
- Security considerations

#### Create Security Documentation
**Target**: `/docs-sot/security/`

**Content**:
- Authentication mechanisms
- Admin token management
- Security best practices
- Vulnerability prevention

## Content Migration Matrix

| Source Location | Content Quality | Target Location | Action |
|----------------|-----------------|-----------------|---------|
| `/src-v2/docs/README.md` | Excellent | `/docs-sot/development/` | Extract & adapt |
| `/src-v2/docs/cdn-adapters.md` | Excellent | `/docs-sot/cdn-adapters/overview.md` | Direct migration |
| `/src-v2/docs/metrics.md` | Excellent | `/docs-sot/metrics/overview.md` | Direct migration |
| `/documentation/migration-considerations.md` | Excellent | `/docs-sot/migration/overview.md` | Consolidate |
| `/documentation/v1-v2-parity-tracker.md` | Good | `/docs-sot/migration/parity-status.md` | Refactor |
| `/docs-revised/01-v2-implementation-reference-summary.md` | Good | `/docs-sot/architecture/overview.md` | Extract & enhance |
| `/documentation/edge-agent-v2-interaction-guide.md` | Good | `/docs-sot/api/interaction-guide.md` | Expand & update |
| `/05-22-2025_docs/*` | Invalid | Replace with proper docs | Create from implementation |

## Legacy Documentation Handling

### Preserve for Reference
- Keep original locations intact for historical reference
- Add deprecation notices pointing to new source of truth
- Maintain during transition period only

### Archive Strategy
```bash
# Create archive of old scattered documentation
mkdir -p archive-legacy-docs/
mv documentation/ archive-legacy-docs/
mv docs-revised/ archive-legacy-docs/
mv 05-22-2025_docs/ archive-legacy-docs/
# Keep /src-v2/docs/ for internal reference
```

## Validation and Quality Assurance

### Content Validation Process
1. **Implementation verification**: All examples tested against `/src-v2/`
2. **Link integrity**: All internal cross-references verified
3. **User testing**: Key workflows validated with actual users
4. **Technical review**: Implementation team validates technical accuracy

### Success Criteria
- [ ] Complete API coverage (15+ endpoints documented)
- [ ] All excellent content migrated without quality loss
- [ ] User workflows validated end-to-end
- [ ] Migration guidance enables successful v1-v2 transitions
- [ ] Documentation standards consistently applied

## Timeline Summary

| Week | Focus | Deliverables |
|------|-------|--------------|
| **Week 1** | High-quality content migration | CDN adapters, metrics, API reference |
| **Week 2** | Architecture & migration guides | Consolidated migration documentation |
| **Week 3** | User-facing documentation | Quick start, configuration, examples |
| **Week 4** | Support & finalization | Troubleshooting, security, final validation |

## Post-Migration Maintenance

### Ongoing Responsibilities
- **Link integrity**: Monthly validation of all cross-references
- **Implementation alignment**: Quarterly accuracy audits
- **Community feedback**: Regular incorporation of user suggestions
- **Version updates**: Documentation updates with each release

### Success Metrics
- **User adoption**: Increased usage of documentation
- **Support reduction**: Fewer documentation-related support requests
- **Community contributions**: Active community documentation improvements
- **Migration success**: Higher v1-v2 migration completion rates

---

**This migration creates a professional, centralized documentation experience that matches the quality of the v2 implementation.**