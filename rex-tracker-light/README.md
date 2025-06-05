# Rex Tracker Light

A lightweight, file-based implementation tracking system for managing prescriptive development plans with AI agents and engineers.

## Purpose

Rex Tracker Light provides a structured approach to software development that:
- **Eliminates ambiguity** by defining exact implementation details upfront
- **Prevents scope creep** through prescriptive task definitions
- **Maintains context** across sessions and different AI agents
- **Tracks progress** with atomic action decomposition
- **Ensures consistency** through predefined patterns and constraints

## Core Principles

1. **Prescriptive Over Descriptive**: Tasks contain exact code patterns, not just descriptions
2. **Atomic Decomposition**: Every task breaks down into single-intent, verifiable actions
3. **Context Persistence**: All decisions and progress persist to the filesystem
4. **No Creative Freedom**: Implementation follows the plan exactly - no architectural decisions during execution
5. **Interoperability**: Any AI agent or engineer can continue where another left off

## 🚨 Critical Documents for AI Agents

**IMPORTANT**: If you're an AI agent working with Rex Tracker Light, you MUST read these documents first:

1. **[OPERATIONAL-RULES.md](./OPERATIONAL-RULES.md)** - Core rules for creating and executing plans
2. **[SESSION-INIT.md](./SESSION-INIT.md)** - Session initialization protocol
3. **[CONTEXT-RECOVERY.md](./CONTEXT-RECOVERY.md)** - How to quickly regain context
4. **[docs/execution-guide.md](./docs/execution-guide.md)** - Detailed execution instructions

These documents contain the prescriptive guidelines that govern how the system operates.

## 🚀 Quick Start for AI Assistants

When starting a new conversation with an AI assistant (Claude, ChatGPT, etc.), use this prompt:

```
You are helping with a project using Rex Tracker Light. 
Read ./rex-tracker-light/.ai-instructions for command recognition.
When I say "Rex init", initialize the system by reading OPERATIONAL-RULES.md.
```

Or simply: `"Read ./rex-tracker-light/.ai-instructions then Rex init"`

## Directory Structure

```
rex-tracker-light/
├── plans/                  # All implementation plans (JSON)
├── current/               # Current execution state
│   ├── active-plan.json   # Which plan is currently active
│   └── context.json       # Current working context
├── scripts/               # Utility scripts for plan management
├── templates/             # Templates for creating plans
└── docs/                  # Additional documentation
```

## Implementation Plan Schema

Every implementation plan MUST follow this schema:

```json
{
  "id": "string",              // Unique identifier (e.g., "auth-system-v2")
  "name": "string",            // Human-readable name
  "description": "string",     // Brief description of what this plan achieves
  "createdAt": "ISO 8601",     // Creation timestamp
  "updatedAt": "ISO 8601",     // Last modification timestamp
  "metadata": {
    "author": "string",        // Who created this plan
    "version": "string",       // Plan version (for iterations)
    "tags": ["string"],        // Categorization tags
    "priority": "string"       // HIGH, MEDIUM, LOW
  },
  "config": {
    "requiresApproval": ["string"],  // Which tasks need human approval
    "protectedFiles": ["string"],    // Files that need special handling
    "constraints": ["string"]        // Global constraints for this plan
  },
  "tasks": [
    {
      "id": "string",          // Unique task ID (e.g., "TASK001")
      "title": "string",       // Brief task title
      "description": "string", // Detailed task description
      "status": "string",      // PENDING, IN_PROGRESS, DONE, BLOCKED, FAILED
      "dependencies": ["string"], // Task IDs that must complete first
      
      "prescriptiveDetails": {
        "summary": "string",   // What this task accomplishes
        
        "requiredPackages": [  // Exact packages and versions
          {
            "name": "string",
            "version": "string",
            "installCommand": "string"
          }
        ],
        
        "targetFiles": [       // Files to create or modify
          {
            "path": "string",
            "action": "CREATE|MODIFY|DELETE",
            "description": "string"
          }
        ],
        
        "codePatterns": [      // Exact code to implement
          {
            "file": "string",
            "pattern": "string", // Actual code snippet
            "description": "string",
            "language": "string"
          }
        ],
        
        "apiSpecifications": [ // API endpoints/methods to implement
          {
            "method": "string",
            "path": "string",
            "description": "string",
            "requestBody": {},  // JSON Schema
            "responseBody": {}, // JSON Schema
            "headers": {}
          }
        ],
        
        "dataSchemas": [       // Data structures to implement
          {
            "name": "string",
            "schema": {},      // JSON Schema or TypeScript interface
            "description": "string"
          }
        ],
        
        "environmentVariables": [
          {
            "name": "string",
            "description": "string",
            "example": "string",
            "required": true
          }
        ],
        
        "constraints": [       // What NOT to do
          "Do NOT use library X",
          "Do NOT modify existing interface",
          "Do NOT add fields beyond specification"
        ],
        
        "testCases": [         // Tests that must pass
          {
            "description": "string",
            "type": "unit|integration|e2e",
            "expectedBehavior": "string"
          }
        ]
      },
      
      "atomicActions": [       // Breakdown of task into smallest steps
        {
          "id": "string",
          "description": "string",
          "completed": false,
          "completedAt": "ISO 8601",
          "notes": "string"
        }
      ],
      
      "verificationCriteria": [ // How to verify task completion
        "Package.json includes jsonwebtoken@9.0.2",
        "Auth middleware exports authMiddleware function",
        "Middleware returns 401 for missing token"
      ],
      
      "implementationNotes": [  // Notes added during implementation
        {
          "timestamp": "ISO 8601",
          "note": "string",
          "type": "info|warning|error|decision"
        }
      ],
      
      "estimatedTime": "string", // "2h", "30m", etc.
      "actualTime": "string",
      "completedAt": "ISO 8601"
    }
  ],
  
  "globalPatterns": {          // Patterns to use across all tasks
    "errorHandling": "string", // Standard error handling pattern
    "logging": "string",       // Standard logging pattern
    "naming": "string",        // Naming conventions
    "fileStructure": "string"  // How to organize files
  }
}
```

## Quick Start

### 1. Check Current State
```bash
# What plan is active?
cat current/active-plan.json

# What's the current context?
cat current/context.json
```

### 2. Find Available Plans
```bash
# List all plans
ls plans/

# View a specific plan
cat plans/auth-system-v2.json
```

### 3. Create a New Plan
Use the template in `templates/plan-template.json` and follow the schema above.

### 4. Execute a Plan
See [Execution Guide](./docs/execution-guide.md) for detailed instructions.

## Key Concepts

### Prescriptive Details
Every task must include enough detail that any developer or AI can implement it exactly the same way. This includes:
- Exact code patterns to follow
- Specific package versions
- Required API signatures
- Data schemas
- What NOT to do (constraints)

### Atomic Actions
Tasks break down into atomic actions - the smallest possible units of work:
- Install a specific package
- Create a file with specific content
- Add a single function
- Update one configuration value

### Context Persistence
All progress and decisions are saved to files:
- Current plan and task status
- Implementation notes
- Decisions made during execution
- Blockers and resolutions

## For AI Agents

When working with Rex Tracker Light:

1. **Always check current state first** - Don't assume, read the files
2. **Follow prescriptive details exactly** - No creative interpretation
3. **Update progress after each atomic action** - Maintain accurate state
4. **Document blockers immediately** - Don't try to work around plan constraints
5. **Never modify plan files directly** - Use the plan manager script

## For Engineers

1. **Plans are contracts** - Once approved, follow them exactly
2. **Atomic actions are checkpoints** - Mark each one as you complete it
3. **Add implementation notes** - Document any deviations or issues
4. **Request plan updates** - Don't improvise solutions

## Schema Validation

Before using a plan, validate it contains:
- [ ] All required top-level fields
- [ ] At least one task
- [ ] Prescriptive details for each task
- [ ] Atomic actions for each task
- [ ] Verification criteria for each task

## Next Steps

1. Read the [Execution Guide](./docs/execution-guide.md)
2. Review the [Plan Creation Guide](./docs/plan-creation-guide.md)
3. See example plans in `templates/`

---

**Remember**: The goal is predictable, consistent implementation through detailed planning, not creative problem-solving during execution.