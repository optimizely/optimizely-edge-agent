#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Package Rex Tracker Light for deployment to a new project
 * Creates a clean, ready-to-deploy bundle
 */

class RexTrackerPackager {
  constructor() {
    this.rootDir = path.join(__dirname, '..');
    this.outputDir = path.join(this.rootDir, 'dist');
  }

  // Files and directories to include in the package
  getIncludeList() {
    return {
      files: [
        'README.md',
        'OPERATIONAL-RULES.md',
        'SESSION-INIT.md',
        'CONTEXT-RECOVERY.md',
        'DEPLOYMENT-GUIDE.md',
        '.ai-instructions',
        'AI-STARTER-PROMPT.md'
      ],
      directories: [
        'scripts',
        'templates',
        'docs'
      ]
    };
  }

  // Create clean state files
  createCleanStateFiles() {
    const stateFiles = {
      'current/active-plan.json': {
        currentPlan: null,
        currentTask: null,
        currentAction: null,
        lastUpdated: new Date().toISOString(),
        blockers: [],
        context: {}
      },
      'current/context.json': {
        project: 'your-project-name',
        workingDirectory: '/your-project-path',
        environment: 'development',
        lastActivity: null,
        preferences: {
          verboseLogging: false,
          autoSave: true,
          confirmBeforeDelete: true
        },
        notes: []
      }
    };

    return stateFiles;
  }

  // Package the system
  package() {
    console.log('📦 Packaging Rex Tracker Light...\n');

    // Clean/create output directory
    if (fs.existsSync(this.outputDir)) {
      fs.rmSync(this.outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(this.outputDir, { recursive: true });

    const packageDir = path.join(this.outputDir, 'rex-tracker-light');
    fs.mkdirSync(packageDir, { recursive: true });

    // Create directory structure
    ['plans', 'current', 'scripts', 'templates', 'docs'].forEach(dir => {
      fs.mkdirSync(path.join(packageDir, dir), { recursive: true });
    });

    // Copy files
    const { files, directories } = this.getIncludeList();

    // Copy individual files
    files.forEach(file => {
      const src = path.join(this.rootDir, file);
      const dest = path.join(packageDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`✅ Copied ${file}`);
      }
    });

    // Copy directories
    directories.forEach(dir => {
      const src = path.join(this.rootDir, dir);
      const dest = path.join(packageDir, dir);
      if (fs.existsSync(src)) {
        this.copyDirectory(src, dest);
        console.log(`✅ Copied ${dir}/`);
      }
    });

    // Create clean state files
    const stateFiles = this.createCleanStateFiles();
    Object.entries(stateFiles).forEach(([filePath, content]) => {
      const dest = path.join(packageDir, filePath);
      fs.writeFileSync(dest, JSON.stringify(content, null, 2));
      console.log(`✅ Created clean ${filePath}`);
    });

    // Create setup script
    this.createSetupScript(packageDir);

    // Create archive
    const archiveName = `rex-tracker-light-${new Date().toISOString().split('T')[0]}.tar.gz`;
    const archivePath = path.join(this.outputDir, archiveName);
    
    console.log('\n📦 Creating archive...');
    execSync(`tar -czf ${archiveName} rex-tracker-light`, { cwd: this.outputDir });
    
    console.log(`\n✅ Package created: ${archivePath}`);
    console.log('\n📋 Deployment instructions:');
    console.log('1. Copy the archive to your new project');
    console.log('2. Extract: tar -xzf ' + archiveName);
    console.log('3. Run: node rex-tracker-light/setup.js');
    console.log('4. Tell AI: "Rex init at ./rex-tracker-light"');
  }

  // Recursively copy directory
  copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // Create setup script for easy initialization
  createSetupScript(packageDir) {
    const setupScript = `#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Rex Tracker Light...\\n');

// Update context.json with current project info
const contextPath = path.join(__dirname, 'current', 'context.json');
const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));

context.project = path.basename(process.cwd());
context.workingDirectory = process.cwd();

fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));

console.log('✅ Updated project context');
console.log('✅ Rex Tracker Light is ready!');
console.log('\\n📋 Next steps:');
console.log('1. Tell your AI: "Rex init at ./rex-tracker-light"');
console.log('2. Create your first plan');
console.log('3. Start tracking implementation');
`;

    fs.writeFileSync(path.join(packageDir, 'setup.js'), setupScript);
    fs.chmodSync(path.join(packageDir, 'setup.js'), '755');
    console.log('✅ Created setup.js');
  }
}

// Run packager
if (require.main === module) {
  const packager = new RexTrackerPackager();
  packager.package();
}

module.exports = RexTrackerPackager;