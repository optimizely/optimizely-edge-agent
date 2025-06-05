# Rex Tracker Light - Context Recovery Guide

This document provides instructions for quickly regaining context when starting or restarting work with Rex Tracker Light.

## 🚀 Quick Start Commands

### Primary Initialization Commands

**Option 1: Simple Initialization**
```
"Initialize Rex Tracker Light"
"Rex tracker init"
"Rex init"
```

**Option 2: Initialization with Context**
```
"Initialize Rex Tracker and continue with [specific plan/task]"
"Rex init - working on auth system"
"Rex init - task TASK003"
```

**Option 3: Full Path Initialization**
```
"Initialize Rex Tracker at /mnt/c/Users/LAH/Documents/__Development/rexearch-saas/saas-platform/rex-tracker-light"
```

## 📋 What Happens During Initialization

When you provide any initialization command, the AI will:

1. **Read Core Documentation**
   - `OPERATIONAL-RULES.md` - Core operating procedures
   - `SESSION-INIT.md` - Session startup protocol
   - `current/active-plan.json` - Current state
   - `current/context.json` - Project context

2. **Check System Status**
   ```bash
   node scripts/plan-manager.js status
   node scripts/plan-manager.js list-plans
   ```

3. **Provide Visual Status Report**
   ```
   🚀 Rex Tracker Light Initialized
   
   📊 Current State:
   - Active Plan: [plan-name or "None"]
   - Current Task: [task-id and progress]
   - Last Action: [last completed action]
   - Overall Progress: [X/Y tasks (N%)]
   
   Ready for instructions.
   ```

## 💬 Natural Language Commands After Initialization

### Information Requests
- **"What plans are available?"** → Lists all plans with progress
- **"Show current status"** → Displays detailed progress
- **"What's next?"** → Shows next task/action
- **"Show all tasks"** → Lists tasks with status icons

### Action Commands
- **"Start the next task"** → Begins next available task
- **"Continue working"** → Resumes from last action
- **"Switch to [plan-name]"** → Changes active plan
- **"Create a plan for [feature]"** → Starts plan creation

### Progress Updates
- **"Mark this action complete"** → Updates current action
- **"Complete this task"** → Finishes current task
- **"This is blocked because..."** → Marks task as blocked

## 🔄 Context Recovery Scenarios

### Scenario 1: Resuming Work
```
You: "Rex init - continue where we left off"
AI: [Checks state, shows current task/action, ready to resume]
```

### Scenario 2: Switching Context
```
You: "Rex init - switch to API gateway plan"
AI: [Initializes, switches plan, shows new context]
```

### Scenario 3: Fresh Start
```
You: "Rex init - let's create a new plan"
AI: [Initializes, ready for plan creation]
```

### Scenario 4: Status Check Only
```
You: "Rex status"
AI: [Quick init, shows comprehensive status]
```

## 📁 Key Context Files

The AI reads these files to recover context:

1. **State Files**
   - `current/active-plan.json` - Active plan and progress
   - `current/context.json` - Project preferences

2. **Plan Files**
   - `plans/*.json` - All implementation plans
   - Contains tasks, progress, notes

3. **Documentation**
   - `OPERATIONAL-RULES.md` - How to operate
   - `SESSION-INIT.md` - Startup checklist

## ⚡ Quick Recovery Tips

### For Fastest Context Recovery:
- Include hints: "Rex init - JWT middleware task"
- Reference task IDs: "Rex init - continue TASK003"
- Mention the plan: "Rex init - auth system plan"

### For Specific Operations:
- Status check: "Rex status"
- Plan list: "Show me all Rex plans"
- Jump to task: "Rex init - start TASK005"

### Manual Context Pointer:
If the AI seems confused:
```
"Read Rex Tracker context from CONTEXT-RECOVERY.md"
```

## 🎯 Important Notes

1. **Explicit Initialization**: The AI will NOT auto-initialize Rex Tracker unless you explicitly request it. This ensures it doesn't interfere when you're working on other tasks.

2. **Context Persistence**: All state is file-based, so full recovery is always possible even without additional hints.

3. **Flexible Commands**: The system accepts various phrasings - "initialize", "init", "start", "load" all work.

4. **Visual Feedback**: Expect emoji-rich, structured responses that make state clear at a glance.

---

Remember: Rex Tracker Light is designed for seamless context recovery. Even a simple "Rex init" provides complete state restoration from the filesystem.