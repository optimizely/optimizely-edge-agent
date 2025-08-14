# Documentation Deprecation Tracker

This file tracks existing documentation that becomes redundant as new source-of-truth documentation is created.

## Purpose
- **Track replacement candidates** for future cleanup review
- **Maintain audit trail** of what new docs replace what old docs
- **Enable safe cleanup** after new documentation is complete and validated

## Status Legend
- 🆕 **NEW**: New documentation created
- 📝 **DRAFT**: In progress  
- ✅ **REPLACED**: Old documentation fully superseded
- ⚠️ **PARTIAL**: Old documentation partially superseded
- 🔗 **REFERENCE**: Old documentation still has reference value

---

## Deprecation Tracking

### API Documentation Replacements

| New Documentation | Status | Replaces/Supersedes | Deprecation Safety | Notes |
|-------------------|--------|--------------------|--------------------|-------|
| `/docs-sot/api/README.md` | 🆕 **CREATED** | `/documentation/edge-agent-v2-api-endpoint-reference.md` | ⚠️ **PARTIAL** | New doc has better structure, old has some content |
| `/docs-sot/api/data-management/datafile.md` | 🆕 **CREATED** | `/05-22-2025_docs/datafile-api.md` | ✅ **SAFE TO DEPRECATE** | Old file is invalid conversation log |
| `/docs-sot/api/data-management/flagkeys.md` | 🆕 **CREATED** | `/05-22-2025_docs/flagKeys-api.md` | ✅ **SAFE TO DEPRECATE** | Old file is invalid conversation log |
| `/docs-sot/api/decisions/` | 📝 **PLANNED** | `/documentation/edge-agent-v2-interaction-guide.md` | ⚠️ **PARTIAL** | Old doc has good interaction patterns |
| `/docs-sot/api/decisions/` | 📝 **PLANNED** | `/05-22-2025_docs/decide-methods-config.md` | ✅ **SAFE TO DEPRECATE** | Old file is invalid conversation log |

### Architecture Documentation Replacements

| New Documentation | Status | Replaces/Supersedes | Deprecation Safety | Notes |
|-------------------|--------|--------------------|--------------------|-------|
| `/docs-sot/architecture/` | 📝 **PLANNED** | `/docs-revised/01-v2-implementation-reference-summary.md` | 🔗 **KEEP FOR REFERENCE** | Good architectural analysis |
| `/docs-sot/architecture/` | 📝 **PLANNED** | `/documentation/architecture-v1-v2-comparison.md` | 🔗 **KEEP FOR REFERENCE** | Historical comparison value |

### CDN Platform Documentation Replacements  

| New Documentation | Status | Replaces/Supersedes | Deprecation Safety | Notes |
|-------------------|--------|--------------------|--------------------|-------|
| `/docs-sot/cdn-adapters/` | 📝 **PLANNED** | `/src-v2/docs/cdn-adapters.md` | 🔗 **KEEP INTERNAL** | High quality, keep for internal reference |

### Migration Documentation Replacements

| New Documentation | Status | Replaces/Supersedes | Deprecation Safety | Notes |
|-------------------|--------|--------------------|--------------------|-------|
| `/docs-sot/migration/` | 📝 **PLANNED** | `/documentation/migration-considerations.md` | 🔗 **KEEP FOR REFERENCE** | Excellent technical analysis |
| `/docs-sot/migration/` | 📝 **PLANNED** | `/documentation/v1-v2-parity-tracker.md` | 🔗 **KEEP FOR REFERENCE** | Detailed gap tracking |
| `/docs-sot/migration/` | 📝 **PLANNED** | `/documentation/functional-parity-verification.md` | 🔗 **KEEP FOR REFERENCE** | Comprehensive comparison |

### Quick Start Documentation Replacements

| New Documentation | Status | Replaces/Supersedes | Deprecation Safety | Notes |
|-------------------|--------|--------------------|--------------------|-------|
| `/docs-sot/quick-start/` | 📝 **PLANNED** | Various scattered setup guides | ⚠️ **REVIEW NEEDED** | Multiple sources to consolidate |

---

## Invalid Documentation (Safe for Immediate Deprecation)

These files contain conversation logs instead of proper documentation:

| File | Issue | Replacement | Safety |
|------|-------|-------------|--------|
| `/05-22-2025_docs/datafile-api.md` | Conversation log | `/docs-sot/api/data-management/datafile.md` | ✅ **SAFE TO DELETE** |
| `/05-22-2025_docs/flagKeys-api.md` | Conversation log | `/docs-sot/api/data-management/flagkeys.md` | ✅ **SAFE TO DELETE** |
| `/05-22-2025_docs/decide-methods-config.md` | Conversation log | `/docs-sot/api/decisions/` (planned) | ✅ **SAFE TO DELETE** |

---

## High-Quality Documentation (Preserve for Reference)

These documents have significant value and should be preserved:

| File | Quality | Reason to Preserve | Action |
|------|---------|-------------------|--------|
| `/src-v2/docs/README.md` | Excellent | Perfect internal documentation template | Keep internal |
| `/src-v2/docs/cdn-adapters.md` | Excellent | 100% implementation accuracy | Keep internal |
| `/src-v2/docs/metrics.md` | Excellent | Comprehensive technical coverage | Keep internal |
| `/documentation/migration-considerations.md` | Excellent | Detailed technical migration analysis | Archive for reference |
| `/documentation/v1-v2-parity-tracker.md` | Excellent | Comprehensive gap tracking | Archive for reference |

---

## Detailed Coverage Analysis

### API Endpoints Documentation Status

| Endpoint | Old Documentation | New Documentation | Status |
|----------|------------------|-------------------|--------|
| `/api/datafile` | ❌ Conversation log | ✅ Complete implementation-based docs | **COVERED** |
| `/api/flagkeys` | ❌ Conversation log | ✅ Complete implementation-based docs | **COVERED** |
| `/api/decide` | ⚠️ Partial in interaction guide | 📝 **NEXT: In progress** | **IN PROGRESS** |
| `/api/decide-all` | ⚠️ Basic mention | 📝 **NEXT: Planned** | **PLANNED** |
| `/api/decide-for-keys` | ❌ Not documented | 📝 **NEXT: Planned** | **PLANNED** |
| `/api/decide-options` | ❌ Not documented | 📝 **NEXT: Planned** | **PLANNED** |
| `/api/sdk` | ❌ Not documented | 📝 **NEXT: Planned** | **PLANNED** |
| `/api/set-forced-variation` | ⚠️ **DEPRECATED** | ✅ Complete docs with migration guide | **DEPRECATED - MIGRATE TO /api/decide** |
| `/api/get-forced-variation` | ⚠️ **DEPRECATED** | ✅ Complete docs with migration guide | **DEPRECATED - MIGRATE TO /api/decide** |
| `/api/remove-forced-variation` | ⚠️ **DEPRECATED** | ✅ Complete docs with migration guide | **DEPRECATED - MIGRATE TO /api/decide** |
| `/api/remove-all-forced-decisions` | ⚠️ **DEPRECATED** | ✅ Complete docs with migration guide | **DEPRECATED - MIGRATE TO /api/decide** |
| `/api/debug` | ❌ Not documented | 📝 **NEXT: Planned** | **PLANNED** |
| `/api/admin/*` | ❌ Not documented | 📝 **NEXT: Planned** | **PLANNED** |

**Progress**: 2 of 13+ endpoints completed (15%)

---

## Future Cleanup Recommendations

### Phase 1: Safe Deletions (After New Docs Complete)
- ✅ **READY NOW**: Delete conversation log files in `/05-22-2025_docs/`
- Remove incomplete/partial documentation attempts

### Phase 2: Consolidation Review (After User Validation)
- Review scattered documentation directories for redundancy
- Consolidate overlapping content
- Archive historical analysis documents

### Phase 3: Long-term Organization (After 90 Days)
- Create archive directory for historical documentation
- Establish ongoing deprecation process
- Implement documentation lifecycle management

---

## Update Log

| Date | Action | Files Affected | Notes |
|------|--------|---------------|-------|
| 2025-05-27 | Created tracker | N/A | Initial deprecation tracking setup |
| 2025-05-27 | Added datafile docs | `/docs-sot/api/data-management/datafile.md` | Complete implementation-based API docs |
| 2025-05-27 | Added flagkeys docs | `/docs-sot/api/data-management/flagkeys.md` | Complete implementation-based API docs |
| 2025-06-07 | Deprecated forced variation endpoints | `/docs-sot/api/admin/forced-variations.md` | Added deprecation notices and migration guide |

---

**This tracker will be updated as each new documentation section is created.**