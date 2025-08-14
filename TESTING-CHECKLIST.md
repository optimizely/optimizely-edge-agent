# Forced Decisions Testing Checklist

## Pre-Test Verification
- [ ] Server is running (`wrangler dev --local`)
- [ ] Server is accessible at http://localhost:8787
- [ ] Build completed successfully (`npm run build:cloudflare`)

## Test Execution Order

### 1. Basic Connectivity Test
```bash
curl http://localhost:8787/api/test
```
Expected: 200 OK response

### 2. Deep Debug Test (identifies valid variations)
```bash
node deep-debug-forced-decisions.js
```
This will:
- Show all valid variations in the datafile
- Test each valid variation with forced decisions
- Show exactly what's happening

### 3. Cache Fix Verification Test
```bash
node test-forced-decisions-fix.js
```
This will:
- Test if the cache fix is working
- Verify different forced decisions work for same user
- Check cache isolation

### 4. NOVA Framework Test
```bash
cd critical-testing-project/nova
node runners/nova.js edge-core --verbose
```
This will:
- Run the original tests that found the bug
- Verify if they now pass

## What Success Looks Like

✅ **Forced Decision Working:**
- Request: `X-Optimizely-Forced-Decisions: {"test-flag":{"variationKey":"on"}}`
- Response: `"variationKey": "on"` (matches forced value)

❌ **Forced Decision NOT Working:**
- Request: `X-Optimizely-Forced-Decisions: {"test-flag":{"variationKey":"on"}}`
- Response: `"variationKey": "off"` (doesn't match forced value)

## If Tests Still Fail

### Check These Possibilities:

1. **Invalid Variation Keys**
   - Run `deep-debug-forced-decisions.js` to see valid variations
   - Maybe "on" doesn't exist for test-flag

2. **SDK Issues**
   - Check SDK version: `npm list @optimizely/optimizely-sdk`
   - Should be 5.3.0 or higher

3. **Header Format Issues**
   - Ensure JSON is valid in header
   - Check for escaping issues

4. **Different Root Cause**
   - Maybe it's not a cache issue
   - Could be in ApiRouter.ts instead
   - Could be in ConfigurationService.ts

5. **Build/Deploy Issues**
   - Ensure latest code is built: `npm run build:cloudflare`
   - Check if wrangler is serving old code
   - Try `rm -rf dist/` and rebuild

## Debug Commands

```bash
# Check what's actually running
curl -i http://localhost:8787/api/test

# Test without forced decision (baseline)
curl -X GET "http://localhost:8787/api/decide?flagKey=test-flag&userId=baseline-user" \
  -H "X-Optimizely-SDK-Key: 8mR1pGh8u2ztUP8GqjmQq"

# Test with forced "on"
curl -X GET "http://localhost:8787/api/decide?flagKey=test-flag&userId=forced-user" \
  -H "X-Optimizely-SDK-Key: 8mR1pGh8u2ztUP8GqjmQq" \
  -H 'X-Optimizely-Forced-Decisions: {"test-flag":{"variationKey":"on"}}'

# Test with forced "control"
curl -X GET "http://localhost:8787/api/decide?flagKey=test-flag&userId=forced-user" \
  -H "X-Optimizely-SDK-Key: 8mR1pGh8u2ztUP8GqjmQq" \
  -H 'X-Optimizely-Forced-Decisions: {"test-flag":{"variationKey":"control"}}'
```

## The Real Test

**We don't know if the fix works until we run these tests!**

My hypothesis about the cache being the issue is just that - a hypothesis. It needs verification through testing.