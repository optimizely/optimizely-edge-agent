#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Rex Tracker Light...\n');

// Update context.json with current project info
const contextPath = path.join(__dirname, 'current', 'context.json');
const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));

context.project = path.basename(process.cwd());
context.workingDirectory = process.cwd();

fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));

console.log('✅ Updated project context');
console.log('✅ Rex Tracker Light is ready!');
console.log('\n📋 Next steps:');
console.log('1. Tell your AI: "Rex init at ./rex-tracker-light"');
console.log('2. Create your first plan');
console.log('3. Start tracking implementation');
