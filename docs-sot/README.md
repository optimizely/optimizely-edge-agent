# Optimizely Edge Agent v2 Documentation

**Source of Truth** for all Optimizely Edge Agent v2 documentation. This directory contains the authoritative documentation for the TypeScript implementation.

## 📖 Documentation Structure

### For Developers
- [**API Reference**](./api/README.md) - Complete REST API documentation
- [**Architecture Guide**](./architecture/) - Technical implementation details  
- [**Development Guide**](./development/) - Setup, testing, and contribution guides
- [**Migration Guide**](./migration/) - v1 to v2 migration documentation

### For End Users
- [**Quick Start**](./quick-start/) - Get started guides for each CDN platform
- [**Configuration**](./configuration/) - Environment setup and configuration options
- [**Examples**](./examples/) - Working examples and use cases
- [**Troubleshooting**](./troubleshooting/) - Common issues and solutions

### Technical References
- [**CDN Adapters**](./cdn-adapters/) - Platform-specific implementation guides
- [**Metrics & Monitoring**](./metrics/) - Observability and performance tracking
- [**Security**](./security/) - Authentication, authorization, and security considerations

## 🎯 Documentation Standards

This documentation follows strict standards for accuracy, completeness, and maintainability:

### ✅ Requirements
- **Code-First Validation**: All examples tested against actual implementation
- **Implementation References**: Direct links to source code for technical claims
- **Practical Examples**: Working code snippets with realistic use cases
- **Version Tracking**: Clear versioning and update history
- **Cross-Platform Coverage**: Complete examples for Cloudflare, Vercel, and Fastly

### 📝 Format Standards
- **Markdown**: GitHub-flavored markdown for maximum compatibility
- **Consistent Structure**: Standardized sections across all documents
- **Clear Navigation**: Table of contents and cross-references
- **Searchable Content**: Descriptive headings and comprehensive indexing

## 🔄 Maintenance

**This is a living documentation set** that evolves with the v2 implementation:

- **Automated Validation**: CI/CD integration ensures examples remain current
- **Regular Reviews**: Quarterly accuracy validation against implementation
- **Community Contributions**: Clear guidelines for community documentation improvements
- **Legacy References**: Links to relevant v1 documentation where needed for migration context

## 🚀 Quick Navigation

| I want to... | Go to... |
|--------------|----------|
| **Get started quickly** | [Quick Start Guide](./quick-start/) |
| **Integrate the API** | [API Reference](./api/) |
| **Understand the architecture** | [Architecture Guide](./architecture/) |
| **Migrate from v1** | [Migration Guide](./migration/) |
| **Set up monitoring** | [Metrics Guide](./metrics/) |
| **Deploy to my CDN** | [CDN Adapter Guides](./cdn-adapters/) |
| **Troubleshoot issues** | [Troubleshooting Guide](./troubleshooting/) |

---

**Last Updated**: 2025-05-27  
**Version**: 2.0.0  
**Implementation Source**: `/src-v2/`