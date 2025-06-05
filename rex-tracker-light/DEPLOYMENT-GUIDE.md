# Rex Tracker Light - Deployment Guide

This guide explains how to deploy Rex Tracker Light in a new project from scratch.

## 🚀 Quick Deployment (Copy Method)

### Step 1: Copy Core Files
Copy the entire `rex-tracker-light` directory to your new project:
```bash
cp -r /path/to/rex-tracker-light /path/to/new-project/rex-tracker-light
```

### Step 2: Clean State Files
Remove any existing project-specific data:
```bash
cd /path/to/new-project/rex-tracker-light

# Clear all plans
rm -rf plans/*

# Reset state files
echo '{"currentPlan": null, "currentTask": null, "currentAction": null, "lastUpdated": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'", "blockers": [], "context": {}}' > current/active-plan.json

echo '{"project": "your-project-name", "workingDirectory": "/your-project", "environment": "development", "lastActivity": null, "preferences": {"verboseLogging": false, "autoSave": true, "confirmBeforeDelete": true}, "notes": []}' > current/context.json
```

### Step 3: Initialize with AI
Tell the AI:
```
"Initialize Rex Tracker Light at /path/to/new-project/rex-tracker-light for [project-name]"
```

## 🏗️ Fresh Installation (From Scratch)

### Step 1: Create Directory Structure
```bash
mkdir -p rex-tracker-light/{plans,current,scripts,templates,docs}
```

### Step 2: Download Core Files
Download these essential files from the Rex Tracker Light repository:

**Required Files:**
- `scripts/plan-manager.js` - Core management script
- `templates/plan-template.json` - Plan structure template
- `README.md` - Main documentation
- `OPERATIONAL-RULES.md` - Operating procedures
- `SESSION-INIT.md` - Session initialization
- `CONTEXT-RECOVERY.md` - Context recovery guide
- `.ai-instructions` - AI assistant command recognition

**Documentation (docs/):**
- `docs/execution-guide.md`
- `docs/plan-creation-guide.md`
- `docs/quick-reference.md`

### Step 3: Initialize State Files
Create initial state files:

**current/active-plan.json:**
```json
{
  "currentPlan": null,
  "currentTask": null,
  "currentAction": null,
  "lastUpdated": "2025-01-06T00:00:00Z",
  "blockers": [],
  "context": {}
}
```

**current/context.json:**
```json
{
  "project": "your-project-name",
  "workingDirectory": "/your-project-path",
  "environment": "development",
  "lastActivity": null,
  "preferences": {
    "verboseLogging": false,
    "autoSave": true,
    "confirmBeforeDelete": true
  },
  "notes": []
}
```

### Step 4: Verify Installation
```bash
# Test the plan manager
node scripts/plan-manager.js help

# Check status
node scripts/plan-manager.js status
```

## 📦 Minimal Installation Script

Save this as `install-rex-tracker.sh`:
```bash
#!/bin/bash

# Create directory structure
echo "Creating Rex Tracker Light directories..."
mkdir -p rex-tracker-light/{plans,current,scripts,templates,docs}

# Create state files
echo "Initializing state files..."
cat > rex-tracker-light/current/active-plan.json << EOF
{
  "currentPlan": null,
  "currentTask": null,
  "currentAction": null,
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "blockers": [],
  "context": {}
}
EOF

cat > rex-tracker-light/current/context.json << EOF
{
  "project": "$(basename $(pwd))",
  "workingDirectory": "$(pwd)",
  "environment": "development",
  "lastActivity": null,
  "preferences": {
    "verboseLogging": false,
    "autoSave": true,
    "confirmBeforeDelete": true
  },
  "notes": []
}
EOF

echo "Rex Tracker Light structure created!"
echo "Next steps:"
echo "1. Copy plan-manager.js to rex-tracker-light/scripts/"
echo "2. Copy documentation files (*.md)"
echo "3. Copy templates to rex-tracker-light/templates/"
```

## 🤖 AI Initialization Commands

### For Fresh Installation:
```
"Set up Rex Tracker Light in this project"
```
The AI will guide you through:
1. Creating directory structure
2. Setting up required files
3. Initializing state

### For Copied Installation:
```
"Initialize Rex Tracker Light at ./rex-tracker-light for [project-name]"
```

### Project-Specific Configuration:
```
"Configure Rex Tracker for a Node.js/React/Python project"
```
The AI will adjust templates and patterns for your tech stack.

## 🔧 Customization Options

### 1. Project-Specific Templates
Modify `templates/plan-template.json` to include:
- Your project's file structure
- Common patterns
- Standard dependencies
- Coding conventions

### 2. Global Patterns
Update the template's `globalPatterns` section with:
- Error handling patterns
- Logging conventions
- File naming standards
- Project-specific rules

### 3. Context Configuration
Edit `current/context.json` to set:
- Project name
- Working directory
- Environment settings
- Custom preferences

## ✅ Deployment Checklist

- [ ] Directory structure created
- [ ] Core scripts copied/downloaded
- [ ] State files initialized
- [ ] Documentation files in place
- [ ] Templates customized (optional)
- [ ] Plan manager tested
- [ ] AI assistant initialized

## 🚨 Important Notes

1. **Clean Slate**: Always start with empty `plans/` directory
2. **State Reset**: Ensure state files have null values
3. **Path Updates**: Update working directory in context.json
4. **Script Permissions**: Ensure plan-manager.js is executable
5. **Node.js Required**: System requires Node.js installed

## 🎯 Quick Start After Deployment

Once deployed, tell the AI:
```
"Rex init - create our first implementation plan for [feature]"
```

The system will:
1. Confirm initialization
2. Help create the first plan
3. Guide through task creation
4. Begin tracking implementation

## 📦 Deployment Options Summary

### Option 1: Quick Copy & Clean
```bash
# Copy the directory
cp -r rex-tracker-light /new/project/

# Clean it
cd /new/project/rex-tracker-light
rm -rf plans/*
node scripts/plan-manager.js create-plan temp "Temp" && rm plans/temp.json

# Initialize with AI
echo "Rex init at ./rex-tracker-light for [project-name]"
```

### Option 2: Use the Packager Script
```bash
# From Rex Tracker directory
node scripts/package-rex-tracker.js

# This creates a clean archive in dist/
# Copy rex-tracker-light-[date].tar.gz to new project
# Extract: tar -xzf rex-tracker-light-[date].tar.gz
# Run: node rex-tracker-light/setup.js
```

### Option 3: AI-Guided Fresh Install
Tell the AI in the new project:
```
"Set up Rex Tracker Light from scratch"
```
The AI will create the complete structure and files.

### Option 4: Git Submodule (Advanced)
```bash
# Add as submodule
git submodule add [rex-tracker-repo] rex-tracker-light

# Initialize
cd rex-tracker-light
rm -rf plans/*
./setup.js
```

### Option 5: Manual Minimal Install
```bash
# Run the install script from this guide
bash install-rex-tracker.sh

# Copy only essential files:
# - scripts/plan-manager.js
# - templates/plan-template.json
# - Documentation files (*.md)
```

## 🔑 Key Deployment Principles

1. **Clean State**: Always start with empty plans directory
2. **Reset Context**: Update project name and paths in context.json
3. **No Cross-Contamination**: Never copy plans between projects
4. **Fresh Initialization**: Always "Rex init" after deployment

---

Rex Tracker Light is now ready to manage your new project's implementation plans!