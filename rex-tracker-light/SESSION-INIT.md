# Rex Tracker Light - Session Initialization Checklist

## 🚀 Start of Session Protocol

When beginning any Rex Tracker Light session, execute these steps in order:

### 1. Read Core Documents
```bash
# Read operational rules
cat OPERATIONAL-RULES.md

# Check current context
cat current/context.json

# Check active plan status
cat current/active-plan.json
```

### 2. System Status Check
```bash
# Get current status
node scripts/plan-manager.js status

# List available plans
node scripts/plan-manager.js list-plans
```

### 3. Context Recovery (if resuming)
If there's an active plan:
- Review the current task
- Check last completed action
- Read implementation notes
- Identify next action

### 4. Communication Setup
Inform user of current state using visual format:
```
🚀 Rex Tracker Light Initialized

📊 Current State:
- Active Plan: [plan-name or "None"]
- Current Task: [task-id or "None"]
- Last Activity: [timestamp]
- Overall Progress: [X/Y tasks]

Ready for instructions.
```

## 📋 Quick Reference Commands

### Information Commands
- `status` - Current state
- `list-plans` - All available plans
- `next-task` - Get next available task
- `next-action` - Get next action in current task

### Action Commands
- `set-active <planId>` - Switch active plan
- `start-task <taskId>` - Begin work on task
- `complete-action <taskId> <actionId>` - Mark action done
- `complete-task <taskId>` - Mark task done
- `block-task <taskId> <reason>` - Mark as blocked

### Management Commands
- `create-plan <id> <name>` - Create new plan
- `add-note <taskId> <note>` - Add implementation note

## 🔄 State Persistence Files

Key files that maintain system state:
- `current/active-plan.json` - Active plan and progress
- `current/context.json` - Project context
- `plans/*.json` - All implementation plans

## ⚡ Quick Start Examples

**Starting fresh:**
```
User: "Create a plan for user authentication"
AI: Creates plan with prescriptive details
```

**Resuming work:**
```
User: "Continue where we left off"
AI: Checks state, shows current task, resumes from last action
```

**Switching context:**
```
User: "Switch to the API gateway plan"
AI: Changes active plan, shows new context
```

---

This document ensures consistent session initialization and context recovery.