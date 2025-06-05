# Rex Tracker Light - Operational Rules & AI Assistant Guidelines

This document MUST be read at the start of every session to ensure consistent operation of the Rex Tracker Light system.

## 🎯 Core Operating Principles

### 1. **System Authority**
- Rex Tracker Light is the single source of truth for implementation plans
- All tasks, progress, and context are managed through the plan files
- The plan manager script is the ONLY way to modify plan state

### 2. **Prescriptive Implementation**
- Plans contain EXACT implementations, not general guidance
- No architectural decisions during execution
- Follow specifications precisely as written
- Stop at blockers - never improvise solutions

### 3. **Context Persistence**
- All state persists to filesystem
- Sessions can be resumed from any point
- Progress is tracked at the atomic action level
- Implementation notes document all decisions

## 📋 Plan Creation Rules

### Required Elements for Every Task:
```json
{
  "prescriptiveDetails": {
    "requiredPackages": [/* exact versions only */],
    "targetFiles": [/* absolute paths */],
    "codePatterns": [/* complete, working code */],
    "constraints": [/* what NOT to do */]
  },
  "atomicActions": [/* single-verb, verifiable steps */],
  "verificationCriteria": [/* measurable outcomes */]
}
```

### Task Decomposition Protocol:
1. **Single Intent**: One verb per action (Install, Create, Add, Define)
2. **Verifiable**: Must be able to confirm completion
3. **Ordered**: Respect dependencies
4. **Atomic**: No further breakdown possible

### Examples:
✅ GOOD: "Install package jsonwebtoken@9.0.2"
❌ BAD: "Set up authentication" (too broad)

## 🔄 Execution Protocol

### 1. **Check State First**
```bash
node scripts/plan-manager.js status
```

### 2. **Get Next Task**
```bash
node scripts/plan-manager.js next-task
```

### 3. **Execute Atomic Actions**
- Start task: `node scripts/plan-manager.js start-task TASK001`
- Complete each action in sequence
- Update after EACH action: `node scripts/plan-manager.js complete-action TASK001 ACTION001`

### 4. **Handle Blockers**
```bash
node scripts/plan-manager.js block-task TASK001 "Missing API key specification"
```

### 5. **Complete Task**
```bash
node scripts/plan-manager.js complete-task TASK001 "All criteria met"
```

## 💬 Natural Language Communication Protocol

### Requesting Information:

**"What plans are available?"**
- AI Action: `node scripts/plan-manager.js list-plans`
- Response Format:
  ```
  📋 Available Plans:
  
  1️⃣ auth-system-v2: Authentication System Implementation
     Tasks: 5/12 completed
     Created: 2025-01-29
  
  2️⃣ api-gateway: API Gateway Setup  
     Tasks: 0/8 completed
     Created: 2025-01-28
  ```

**"What's the current status?"**
- AI Action: `node scripts/plan-manager.js status`
- Response Format:
  ```
  📊 Current Status:
  
  ✅ Active Plan: auth-system-v2
  📍 Current Task: TASK003 - Implement JWT middleware
  🔄 Task Progress: 2/5 actions (40%)
  
  📈 Overall Progress:
  - Total Tasks: 12
  - Completed: 5 (42%)
  - In Progress: 1 (8%)
  - Pending: 6 (50%)
  ```

**"Show me all tasks in the current plan"**
- AI Action: Read plan file and format task list
- Response Format:
  ```
  📋 Tasks in auth-system-v2:
  
  ✅ TASK001: Install dependencies
  ✅ TASK002: Create auth directory structure
  🔄 TASK003: Implement JWT middleware (IN_PROGRESS)
  ⏳ TASK004: Create user authentication service
  ⏳ TASK005: Add password hashing
  🚫 TASK006: Implement rate limiting (BLOCKED - needs Redis config)
  ```

### Executing Actions:

**"Start working on the next task"**
- AI Actions:
  1. Get next task
  2. Show task details
  3. Start task
  4. Begin first atomic action

**"Continue with the current task"**
- AI Actions:
  1. Check current state
  2. Get next atomic action
  3. Execute and update

**"I need to create a new plan for [feature]"**
- AI Actions:
  1. Create plan structure
  2. Add tasks with prescriptive details
  3. Save plan
  4. Set as active

### Visual Feedback Standards:

#### Status Icons:
- ✅ Completed
- 🔄 In Progress  
- ⏳ Pending
- 🚫 Blocked
- ❌ Failed
- 📋 List/Plan
- 📊 Summary/Stats
- 🎯 Goal/Target
- ⚡ Action
- 📍 Current Position

#### Progress Display:
```
Progress: [████████░░░░░░░░] 53% (31/58 tasks)
```

#### Action Confirmations:
```
⚡ Action: Installing jsonwebtoken@9.0.2
✅ Success: Package installed

⚡ Action: Creating src/middleware/auth.ts
✅ Success: File created with auth middleware
```

## 🚨 Critical Rules

### Never:
- Skip atomic actions
- Combine multiple actions
- Make architectural decisions
- Modify plan files directly
- Work around blockers

### Always:
- Read current state first
- Update after each action
- Document deviations
- Complete tasks sequentially
- Request help for blockers

## 🔄 Session Resumption

When starting a new session:
1. Read this document
2. Check current state: `node scripts/plan-manager.js status`
3. Review active plan if any
4. Continue from last atomic action

## 📝 Multiple Plan Management

### Switching Plans:
```
User: "Switch to the api-gateway plan"
AI: 
⚡ Switching active plan...
✅ Now working on: api-gateway
📊 Status: 0/8 tasks completed
📍 Next task: TASK001 - Install API gateway dependencies
```

### Parallel Plan Tracking:
When asked about multiple plans, show consolidated view:
```
📊 All Plans Overview:

🔹 auth-system-v2 (ACTIVE)
   Progress: 5/12 tasks (42%)
   Status: Working on JWT middleware
   
🔹 api-gateway  
   Progress: 0/8 tasks (0%)
   Status: Not started
   
🔹 database-migration
   Progress: 3/3 tasks (100%)
   Status: ✅ Completed
```

## 🎯 Communication Patterns

### Task Updates:
```
📍 Current: TASK003 - Implement JWT middleware
⚡ Executing: ACTION002 - Create middleware function
✅ Completed: ACTION002
🔄 Next: ACTION003 - Add token validation
```

### Blocker Reporting:
```
🚫 BLOCKED: Cannot proceed with TASK006
❗ Reason: Redis configuration not specified in plan
📝 Required: Redis connection details (host, port, password)
⏸️ Task marked as BLOCKED pending input
```

### Completion Summary:
```
✅ Task Complete: TASK003 - Implement JWT middleware

📊 Summary:
- Actions completed: 5/5
- Time taken: 15 minutes
- Files modified: 3
- Tests passing: ✅

🔄 Moving to next task...
```

---

**Remember**: This system enforces predictable, consistent implementation through detailed planning. Your role is to execute plans exactly as specified while providing clear, visual feedback about progress and state.