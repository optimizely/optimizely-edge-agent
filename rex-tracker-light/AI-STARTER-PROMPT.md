# AI Assistant Starter Prompts for Rex Tracker Light

## 🚀 Quick Start Prompts

### Option 1: Full Context (Recommended)
```
You are helping with a project using Rex Tracker Light, a prescriptive implementation tracking system. 
Read ./rex-tracker-light/.ai-instructions for command recognition and system details.
When I say "Rex init", initialize the system by reading OPERATIONAL-RULES.md.
The system tracks implementation plans with atomic actions and maintains state across sessions.
```

### Option 2: Minimal Setup
```
Read ./rex-tracker-light/.ai-instructions then Rex init
```

### Option 3: Direct Initialization
```
Initialize Rex Tracker Light at ./rex-tracker-light by reading OPERATIONAL-RULES.md and checking current state
```

## 💾 For AI Memory Features

If your AI assistant supports persistent memory/custom instructions, save this:

```
Project: Rex Tracker Light
Location: ./rex-tracker-light/
Commands:
- "Rex init" = Initialize by reading OPERATIONAL-RULES.md and checking state
- "Rex status" = Show current plan and task progress  
- "Rex plans" = List all available plans
- "Rex continue" = Resume from last atomic action
System: Prescriptive implementation tracking with atomic actions
```

## 🎯 Context Recovery

If the AI seems to have forgotten Rex Tracker context:
```
Refresh Rex Tracker context from ./rex-tracker-light/CONTEXT-RECOVERY.md
```

## 📋 First Commands After Setup

Once initialized, try these commands:
- `"What's our current status?"` - See active plans and progress
- `"Show available plans"` - List all implementation plans
- `"Create a plan for [feature]"` - Start a new implementation plan
- `"Continue working"` - Resume from where you left off

---

💡 Tip: Copy and paste the appropriate prompt at the start of each new AI conversation for instant context!