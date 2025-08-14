# Documentation Standards for Optimizely Edge Agent v2

## Overview

This document defines the standards, conventions, and best practices for all documentation in the Optimizely Edge Agent v2 documentation source of truth (`/docs-sot/`).

## Core Principles

### 1. **Code-First Accuracy**
- **All examples must be tested** against the actual v2 implementation
- **Direct source code references** required for technical claims
- **Implementation validation** before publication
- **Regular accuracy audits** to prevent documentation drift

### 2. **User-Centric Organization**
- **Task-oriented structure** (what users want to accomplish)
- **Progressive complexity** (simple to advanced)
- **Multiple audience support** (developers vs end users)
- **Clear entry points** for different use cases

### 3. **Professional Quality**
- **Consistent formatting** across all documents
- **Comprehensive examples** with realistic scenarios
- **Clear maintenance tracking** with version and update history
- **Cross-reference integrity** with working links

## Directory Structure Standards

### Required Structure
```
docs-sot/
├── README.md                    # Navigation hub
├── _DOCUMENTATION_STANDARDS.md # This file
├── api/                        # REST API documentation
├── architecture/               # Technical implementation
├── development/                # Developer setup & contribution
├── migration/                  # v1 to v2 migration
├── quick-start/               # Getting started guides
├── configuration/             # Setup and config
├── examples/                  # Working code examples
├── troubleshooting/           # Problem resolution
├── cdn-adapters/              # Platform-specific guides
├── metrics/                   # Monitoring and observability
└── security/                  # Authentication and security
```

### Directory Purpose Guidelines

| Directory | Purpose | Audience | Content Type |
|-----------|---------|----------|---------------|
| `api/` | REST API reference | Developers | Technical reference |
| `architecture/` | Implementation details | Developers | Technical deep-dive |
| `development/` | Setup, testing, contributing | Developers | Procedures |
| `migration/` | v1 to v2 transition | Both | Migration guides |
| `quick-start/` | Getting started | Both | Tutorials |
| `configuration/` | Environment setup | Both | Configuration guides |
| `examples/` | Working code samples | Both | Code examples |
| `troubleshooting/` | Problem resolution | Both | Solution guides |
| `cdn-adapters/` | Platform implementation | Developers | Platform guides |
| `metrics/` | Monitoring setup | DevOps/Developers | Observability guides |
| `security/` | Auth & security | Both | Security guides |

## Document Format Standards

### Required File Structure
```markdown
# Document Title

Brief description of what this document covers and who should read it.

## Prerequisites
- List any required knowledge or setup
- Link to prerequisite documents

## Overview
High-level explanation of the topic

## [Content Sections]
Main content organized by user tasks or logical progression

## Examples
Working code examples with realistic scenarios

## Troubleshooting
Common issues and solutions specific to this topic

## Related Documentation
- Links to related documents in this documentation set
- External references where appropriate

---
**Last Updated**: YYYY-MM-DD  
**Version**: X.Y.Z  
**Implementation Source**: `/src-v2/path/to/relevant/code`
```

### Markdown Conventions

#### Headings
- **H1 (`#`)**: Document title only
- **H2 (`##`)**: Major sections
- **H3 (`###`)**: Subsections
- **H4 (`####`)**: Detailed breakdowns (avoid deeper nesting)

#### Code Examples
```typescript
// Always include realistic, tested examples
// Use proper language tags for syntax highlighting
// Include comments explaining key concepts
const example = "Real code that actually works";
```

#### Links
- **Internal links**: Relative paths within `/docs-sot/`
- **Code references**: Direct links to `/src-v2/` implementation
- **External links**: Full URLs with descriptive text

#### Admonitions
```markdown
> **⚠️ Important**: Critical information that could cause issues if missed
> **💡 Tip**: Helpful suggestions for better implementation
> **🔗 Reference**: Links to related concepts or deeper information
```

## Content Quality Standards

### Technical Accuracy
- **Implementation validation**: All code examples tested against `/src-v2/`
- **Version consistency**: Documentation matches current implementation
- **Error handling**: Examples include proper error scenarios
- **Best practices**: Recommendations follow established patterns

### User Experience
- **Clear objectives**: Each document states what users will accomplish
- **Logical progression**: Information flows from simple to complex
- **Practical examples**: Real-world scenarios, not toy examples
- **Troubleshooting**: Common issues addressed proactively

### Maintenance Standards
- **Update tracking**: Clear versioning and change history
- **Review process**: Regular validation against implementation
- **Link integrity**: All internal and external links verified
- **Community feedback**: Process for incorporating user feedback

## Specialized Document Types

### API Reference Documents
**Required Sections**:
- Endpoint description and purpose
- HTTP methods and paths
- Authentication requirements
- Request parameters (headers, query, body)
- Response format and examples
- Error codes and handling
- Code examples for common scenarios

### Architecture Documents
**Required Sections**:
- Component overview and responsibilities
- Interface definitions and contracts
- Data flow and interaction patterns
- Configuration and customization points
- Performance and scalability considerations
- Extension and integration guidance

### Quick Start Guides
**Required Sections**:
- Prerequisites and assumptions
- Step-by-step setup instructions
- Verification steps to confirm success
- Next steps and advanced topics
- Common pitfalls and solutions

## Review and Validation Process

### Pre-Publication Checklist
- [ ] All code examples tested against current implementation
- [ ] Links verified (internal and external)
- [ ] Format consistency checked
- [ ] Technical accuracy validated by implementation team
- [ ] User experience tested with target audience

### Regular Maintenance
- **Monthly**: Link integrity verification
- **Quarterly**: Implementation alignment audit
- **Per Release**: Update for new features or breaking changes
- **Annually**: Comprehensive structure and organization review

## Tools and Automation

### Recommended Tools
- **Markdown linting**: Consistent formatting
- **Link checking**: Automated link validation
- **Code testing**: Examples validated in CI/CD
- **Spell checking**: Professional presentation

### Integration Points
- **CI/CD pipeline**: Automated validation on changes
- **Implementation updates**: Documentation review triggered by code changes
- **Community contributions**: Clear guidelines for external contributions

## Success Metrics

### Quality Indicators
- **User feedback**: Positive sentiment on documentation usefulness
- **Implementation success**: Users successfully complete documented procedures
- **Support reduction**: Fewer support requests for documented topics
- **Community adoption**: Active use and contribution to documentation

### Maintenance Health
- **Accuracy rate**: Percentage of examples that work as documented
- **Link health**: Percentage of working internal and external links
- **Update frequency**: Regular maintenance activity
- **Review coverage**: Percentage of documents reviewed quarterly

---

**These standards ensure documentation quality that matches the excellence of the v2 implementation.**