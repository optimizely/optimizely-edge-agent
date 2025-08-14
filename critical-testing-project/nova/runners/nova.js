#!/usr/bin/env node

/**
 * NOVA CLI - Main entry point
 * 
 * Usage:
 *   nova                           Run quick suite on local environment
 *   nova --suite full              Run full test suite
 *   nova --env staging-cloudflare  Run on staging environment
 *   nova --adapter vercel          Override adapter
 *   nova --compare <session-id>    Compare with baseline session
 *   nova --dry-run                 Show what would be tested
 *   nova --verbose                 Verbose output
 *   nova --help                    Show help
 */

const { TestRunner } = require('../core/test-runner');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    environment: 'local',
    suite: 'quick',
    adapter: null,
    baselineSession: null,
    dryRun: false,
    verbose: false,
    continueOnFailure: true,
    help: false,
    list: false,
    init: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--env':
      case '-e':
        options.environment = args[++i];
        break;
      
      case '--suite':
      case '-s':
        options.suite = args[++i];
        break;
      
      case '--adapter':
      case '-a':
        options.adapter = args[++i];
        break;
      
      case '--compare':
      case '-c':
        options.baselineSession = args[++i];
        break;
      
      case '--dry-run':
      case '-d':
        options.dryRun = true;
        break;
      
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      
      case '--no-continue':
      case '-x':
        options.continueOnFailure = false;
        break;
      
      case '--help':
      case '-h':
        options.help = true;
        break;
      
      case '--list':
      case '-l':
        options.list = true;
        break;
      
      case '--init':
        options.init = true;
        break;
      
      default:
        if (!arg.startsWith('-')) {
          // Assume it's a suite name if no flag
          options.suite = arg;
        } else {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

// Show help message
function showHelp() {
  console.log(`
NOVA - No-mocks Optimizely Validation Architecture

Usage: nova [options] [suite]

Options:
  -e, --env <name>         Environment to test (default: local)
  -s, --suite <name>       Test suite to run (default: quick)
  -a, --adapter <name>     Override adapter (cloudflare, vercel, fastly)
  -c, --compare <session>  Compare with baseline session
  -d, --dry-run           Show what would be tested without running
  -v, --verbose           Verbose output
  -x, --no-continue       Stop on first failure
  -l, --list              List available environments and suites
  -h, --help              Show this help message
  --init                   Initialize NOVA configuration

Available Suites:
  quick          Basic smoke tests (default)
  agent-core     Core Agent Mode tests
  agent-matrix   Comprehensive Agent Mode parameter tests
  edge-core      Core Edge Mode tests
  edge-matrix    Comprehensive Edge Mode tests
  full           Complete test coverage
  regression     Tests for known issues

Available Environments:
  local                  Local development
  staging-cloudflare     Cloudflare staging
  staging-vercel        Vercel staging
  staging-fastly        Fastly staging
  production            Production environment

Examples:
  nova                          Run quick tests on local
  nova full                     Run full suite on local
  nova --env staging-cloudflare Run quick tests on staging
  nova agent-core --verbose    Run agent tests with verbose output
  nova --dry-run full          Show what full suite would test
  nova --compare abc123        Compare with session abc123
`);
}

// List available configurations
function listConfigurations() {
  const configDir = path.join(__dirname, '..', 'config');
  
  try {
    const environments = require(path.join(configDir, 'environments.json'));
    const suites = require(path.join(configDir, 'test-suites.json'));
    const adapters = require(path.join(configDir, 'adapters.json'));
    
    console.log('\nAvailable Environments:');
    console.log('-'.repeat(50));
    Object.entries(environments.environments).forEach(([key, env]) => {
      console.log(`  ${key.padEnd(20)} ${env.name}`);
      console.log(`    URL: ${env.url}`);
      console.log(`    Adapter: ${env.adapter}`);
    });
    
    console.log('\nAvailable Test Suites:');
    console.log('-'.repeat(50));
    Object.entries(suites.suites).forEach(([key, suite]) => {
      console.log(`  ${key.padEnd(20)} ${suite.name}`);
      console.log(`    ${suite.description}`);
      console.log(`    Tests: ${suite.tests.length}`);
    });
    
    console.log('\nAvailable Adapters:');
    console.log('-'.repeat(50));
    Object.entries(adapters.adapters).forEach(([key, adapter]) => {
      console.log(`  ${key.padEnd(20)} ${adapter.name}`);
      console.log(`    Features: ${Object.keys(adapter.features).join(', ')}`);
    });
    
  } catch (error) {
    console.error('Error loading configurations:', error.message);
  }
}

// Initialize NOVA configuration
async function initializeNova() {
  console.log('\nInitializing NOVA configuration...\n');
  
  const configDir = path.join(__dirname, '..', 'config');
  const credentialsPath = path.join(configDir, 'credentials.json');
  
  // Check if credentials already exist
  if (fs.existsSync(credentialsPath)) {
    console.log('⚠️  Credentials file already exists.');
    console.log('   Edit nova/config/credentials.json to update.\n');
    return;
  }
  
  // Create credentials from environment or defaults
  const credentials = {
    sdkKey: process.env.SDK_KEY || '8mR1pGh8u2ztUP8GqjmQq',
    flagKey: process.env.FLAG_KEY || 'test-flag',
    adminToken: process.env.ADMIN_TOKEN || 'dev-admin-token',
    visitorId: process.env.VISITOR_ID || 'nova-test-user'
  };
  
  fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
  
  console.log('✅ Created credentials.json with:');
  console.log(`   SDK Key: ${credentials.sdkKey}`);
  console.log(`   Flag Key: ${credentials.flagKey}`);
  console.log(`   Admin Token: ${credentials.adminToken}`);
  console.log(`   Visitor ID: ${credentials.visitorId}`);
  console.log('\nEdit nova/config/credentials.json to customize.\n');
  
  // Create results directories
  const resultsDir = path.join(__dirname, '..', 'results');
  const dirs = [
    path.join(resultsDir, 'sessions'),
    path.join(resultsDir, 'comparisons'),
    path.join(resultsDir, 'reports')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  });
  
  console.log('\nNOVA initialization complete!');
  console.log('Run "nova" to start testing.\n');
}

// Main execution
async function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    process.exit(0);
  }
  
  if (options.list) {
    listConfigurations();
    process.exit(0);
  }
  
  if (options.init) {
    await initializeNova();
    process.exit(0);
  }
  
  try {
    const runner = new TestRunner(options);
    const results = await runner.run();
    
    // Exit with appropriate code
    process.exit(results.summary.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}\n`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };