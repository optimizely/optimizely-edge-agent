# NOVA - No-mocks Optimizely Validation Architecture

A comprehensive, reusable testing framework for the Optimizely Edge Agent that eliminates mocks and focuses on real HTTP requests to live endpoints.

## 🎯 Overview

NOVA provides:
- ✅ **No-mocks philosophy**: Every test hits real endpoints with actual HTTP requests
- ✅ **Multi-adapter support**: Test Cloudflare, Vercel, Fastly with the same framework
- ✅ **Comprehensive coverage**: Agent Mode, Edge Mode, and parameter matrix testing
- ✅ **Evidence capture**: Automatic collection of requests, responses, and validation results
- ✅ **Cross-platform**: Works on Windows, macOS, and Linux
- ✅ **Comparison reports**: Track improvements and regressions across test runs
- ✅ **Reusable test suites**: Write once, run everywhere

## 🚀 Quick Start

### 1. Install Dependencies
```bash
# Ensure curl is available (usually pre-installed)
curl --version

# Install Node dependencies
npm ci
```

### 2. Initialize NOVA
```bash
cd critical-testing-project/nova
node runners/nova.js --init
```

### 3. Start Your Edge Agent
```bash
# For Cloudflare
npm run build:cloudflare
wrangler dev --local

# For Vercel
npm run build:vercel
vercel dev --listen 8787

# For Fastly
npm run build:fastly
fastly compute serve
```

### 4. Run Tests
```bash
# Quick smoke test
node runners/nova.js

# Full test suite
node runners/nova.js full

# Specific environment
node runners/nova.js --env staging-cloudflare

# Verbose output with failure details
node runners/nova.js agent-core --verbose
```

## 📋 Test Suites

| Suite | Description | Duration | Tests |
|-------|-------------|----------|-------|
| `quick` | Basic smoke tests | ~30s | Health, basic decide, edge forced |
| `agent-core` | Core API endpoints | ~60s | Decide, track, datafile, flagkeys |
| `agent-matrix` | Parameter combinations | ~5min | All SDK/user/attribute sources |
| `edge-core` | Core edge functionality | ~2min | Forced decisions, cache, forwarding |
| `edge-matrix` | Edge combinations | ~5min | Headers, cookies, cache states |
| `adapter-specific` | Adapter features | ~3min | Storage, metrics, platform-specific |
| `full` | Complete coverage | ~10min | All tests |
| `regression` | Known issue tests | ~2min | Bug fixes and edge cases |

## 🌍 Environments

| Environment | Platform | Usage |
|-------------|----------|-------|
| `local` | Any | Development testing (default) |
| `staging-cloudflare` | Cloudflare | Staging validation |
| `staging-vercel` | Vercel | Cross-platform testing |
| `staging-fastly` | Fastly | Performance testing |
| `production` | Any | Production smoke tests |

## 🔧 Configuration

### Environment Configuration (`config/environments.json`)
```json
{
  "environments": {
    "local": {
      "name": "Local Development",
      "url": "http://localhost:8787",
      "adapter": "cloudflare"
    }
  }
}
```

### Credentials (`config/credentials.json`)
```json
{
  "sdkKey": "8mR1pGh8u2ztUP8GqjmQq",
  "flagKey": "test-flag",
  "adminToken": "dev-admin-token",
  "visitorId": "nova-test-user"
}
```

## 📊 Test Execution Examples

### Basic Usage
```bash
# Run quick tests on local
nova

# Run full suite with verbose output
nova full --verbose

# Test specific adapter
nova --adapter vercel agent-core

# Dry run to see what would be tested
nova --dry-run full
```

### Advanced Usage
```bash
# Test on staging environment
nova --env staging-cloudflare agent-matrix

# Compare with baseline
nova --compare abc123-def456 quick

# Stop on first failure
nova --no-continue edge-core

# List available options
nova --list
```

### Cross-Platform Commands

**PowerShell:**
```powershell
# Set environment variables
$env:SDK_KEY = "8mR1pGh8u2ztUP8GqjmQq"
$env:EDGE_AGENT_URL = "http://localhost:8787"

# Run tests
node nova/runners/nova.js agent-core --verbose
```

**Bash:**
```bash
# Set environment variables
export SDK_KEY="8mR1pGh8u2ztUP8GqjmQq"
export EDGE_AGENT_URL="http://localhost:8787"

# Run tests
node nova/runners/nova.js agent-core --verbose
```

## 📈 Results and Reports

NOVA automatically generates comprehensive results in `nova/results/`:

```
results/
├── sessions/
│   └── 2025-01-15T10-30-45-abc123/
│       ├── summary.json           # Complete test results
│       ├── quick-results.txt      # Human-readable summary
│       ├── requests/              # All HTTP requests
│       ├── responses/             # All HTTP responses
│       └── evidence/              # Validation and raw data
├── reports/
│   ├── 2025-01-15T10-30-45-abc123.html  # Interactive HTML report
│   └── 2025-01-15T10-30-45-abc123.json  # Machine-readable report
└── comparisons/
    └── baseline-vs-current.html   # Comparison reports
```

### HTML Reports
Rich, interactive HTML reports include:
- ✅ Test pass/fail status with details
- ⏱️ Performance metrics and duration
- 🔍 Request/response details
- 📊 Summary statistics
- 🎯 Error details and suggestions

## 🧪 Test Structure

### Agent Mode Tests (v2)
```javascript
{
  id: 'agent.decide.basic',
  name: 'Basic Decide Request',
  description: 'Test basic decide endpoint with SDK key in header',
  async execute(context) {
    const { env, credentials, httpClient, validator } = context;
    
    const response = await httpClient.request({
      method: 'POST',
      url: `${env.url}/api/decide`,
      headers: {
        'Content-Type': 'application/json',
        'X-Optimizely-SDK-Key': credentials.sdkKey,
        'X-Optimizely-Enable-FEX': 'true'
      },
      body: {
        flagKey: credentials.flagKey,
        userId: 'test-user-1'
      }
    });

    const validation = validator.validate(response, {
      status: 200,
      requiredHeaders: ['content-type'],
      bodySchema: {
        type: 'object',
        required: ['flagKey', 'enabled', 'variationKey']
      }
    });

    return { request, response, validation };
  }
}
```

### Edge Mode Tests (v2 forced via API)
```javascript
{
  id: 'edge.forced.basic',
  name: 'Forced Decision Basic',
  description: 'GET /api/decide with forced variation header',
  async execute(context) {
    const { env, credentials, httpClient, validator } = context;

    const forced = {};
    forced[credentials.flagKey] = { variationKey: 'on' };

    const response = await httpClient.request({
      method: 'GET',
      url: `${env.url}/api/decide?flagKey=${credentials.flagKey}&userId=edge-user`,
      headers: {
        'Accept': 'application/json',
        'X-Optimizely-SDK-Key': credentials.sdkKey,
        'X-Optimizely-Enable-FEX': 'true',
        'X-Optimizely-Forced-Decisions': JSON.stringify(forced)
      }
    });

    const validation = validator.validate(response, {
      status: 200,
      requiredHeaders: ['content-type', 'x-optimizely-edge-decisions'],
      custom: (resp) => {
        const body = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.json || {};
        return typeof body.variationKey === 'string';
      }
    });

    return { request: response.request, response, validation };
  }
}
```

### Important (v2)
- Set header `X-Optimizely-Enable-FEX: true` on Agent/Edge API requests, otherwise responses may bypass Optimizely processing.
- Prefer `userId` over nested `user.id` in v2 request bodies and query params.

## 🛠️ Extending NOVA

### Adding New Adapters
1. Add adapter configuration in `config/adapters.json`
2. Create adapter-specific tests in `suites/adapter-specific/`
3. Update environment configurations

### Adding New Test Suites
1. Create new `.suite.js` file in appropriate `suites/` directory
2. Export tests array with test definitions
3. Add suite to `config/test-suites.json`

### Custom Validators
```javascript
const validation = validator.validate(response, {
  status: 200,
  custom: (response) => {
    // Custom validation logic
    if (!response.headers['x-custom-header']) {
      return 'Missing custom header';
    }
    return true;
  }
});
```

## 🚨 Troubleshooting

### Common Issues

**Environment not accessible:**
```bash
# Check if service is running
curl -i http://localhost:8787/api/test

# Verify environment configuration
nova --list
```

**Test failures:**
```bash
# Run with verbose output
nova agent-core --verbose

# Check specific test evidence
ls nova/results/sessions/[session-id]/evidence/
```

**Comparison issues:**
```bash
# List available sessions
ls nova/results/sessions/

# Generate comparison
nova --compare [baseline-session-id] quick
```

### Performance Tips

1. **Use `quick` suite for rapid feedback**
2. **Run `agent-core` before `agent-matrix` for faster debugging**
3. **Use `--dry-run` to preview test execution**
4. **Set shorter timeouts for development testing**

## 🎯 Integration with CI/CD

### GitHub Actions Example
```yaml
name: NOVA Tests
on: [push, pull_request]

jobs:
  nova-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build for Cloudflare
        run: npm run build:cloudflare
      
      - name: Run NOVA tests
        run: |
          cd critical-testing-project/nova
          node runners/nova.js quick --verbose
        env:
          SDK_KEY: ${{ secrets.SDK_KEY }}
          FLAG_KEY: ${{ secrets.FLAG_KEY }}
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: nova-results
          path: critical-testing-project/nova/results/
```

## 📚 Best Practices

1. **Always run `quick` tests first** for rapid feedback
2. **Use environment variables** for sensitive credentials
3. **Capture evidence** for all important test runs
4. **Compare with baselines** to track progress
5. **Run adapter-specific tests** when changing platform code
6. **Use verbose mode** when debugging test failures
7. **Set up automated testing** for continuous validation

---

**NOVA ensures your Optimizely Edge Agent works correctly across all platforms with real-world testing that you can trust.**
