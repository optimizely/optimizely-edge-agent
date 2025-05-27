# Optimizely Edge Agent Documentation Audit - Starter Instructions

## Your Mission
You are tasked with conducting a comprehensive documentation audit of the Optimizely Edge Agent to create a definitive "source of truth" that accurately reflects the v2 implementation and resolves v1-v2 migration documentation challenges.

## MANDATORY: Read These Documents First (In Order)

### 1. Main Instructions (Read First - Primary Guide)
**File**: `optimizely-edge-agent-documentation-audit-instructions.md`
**Purpose**: Complete 6-phase audit methodology with detailed validation requirements
**Action**: Read thoroughly - this is your primary operational guide

### 2. Quick Reference (Read Second - Working Checklist) 
**File**: `optimizely-edge-agent-documentation-audit-quick-reference.md`
**Purpose**: Condensed phase-by-phase checklist with checkpoints and quality gates
**Action**: Use as your working checklist throughout execution

### 3. Preliminary Assessment (Read Third - Context & Hypotheses)
**File**: `optimizely-edge-agent-preliminary-assessment.md` 
**Purpose**: Initial findings, suspected issues, and specific hypotheses to validate
**Action**: Use as your starting point for investigation priorities

## CRITICAL: Execute Setup Command First

After reading the documents above, your first action must be:

```bash
cd /c:/Users/LAH/Documents/__Development/Optimizely/optimizely-edge-agent/optimizely-edge-agent/
mkdir -p documentation-audit-results
cd documentation-audit-results
mkdir -p {checkpoints,phase-1-discovery,phase-2-mapping,phase-3-validation,phase-4-reconciliation,phase-5-planning,phase-6-reporting,document-validation-reports,logs,backups,v1-v2-comparison}
echo "$(date '+%Y-%m-%d %H:%M:%S') [SETUP] [INFO] Starting Optimizely Edge Agent documentation audit" > logs/audit-progress-$(date +%Y%m%d).log
```

## Working Directory
All your work must be saved in: `/c:/Users/LAH/Documents/__Development/Optimizely/optimizely-edge-agent/optimizely-edge-agent/documentation-audit-results/`

## Key Project Context
- **Target Codebase**: `/src-v2/` (TypeScript, service-oriented architecture) 
- **Legacy Codebase**: `/src/` (JavaScript, monolithic design)
- **Primary Challenge**: V1-to-V2 migration has left documentation fragmented across multiple directories with potential v1/v2 conflicts

## Your Execution Path
1. **Read all three documents** above in order
2. **Execute the setup command** to create your working directory structure
3. **Begin Phase 1** as outlined in the main instructions
4. **Create checkpoints religiously** - your work must be recoverable
5. **Focus on v1-v2 migration validation** - this is the core challenge

## Success Criteria
- **100% documentation coverage** across all directories
- **Complete v1-v2 migration assessment** for every document  
- **Code-validated accuracy** for all technical claims
- **Actionable remediation plan** with effort estimates

## Emergency Contact
If you encounter critical issues or need clarification, document them in your checkpoint files and continue with clearly marked assumptions.

**Begin by reading the main instructions document, then proceed systematically through the 6-phase process.** 