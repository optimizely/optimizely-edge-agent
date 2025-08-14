# Forced Decisions Bug - Root Cause Analysis & Fix

## Executive Summary
**Bug**: Forced decisions were not being applied correctly in the Optimizely Edge Agent v2.  
**Root Cause**: User context caching didn't account for forced decisions, causing cached contexts to ignore them.  
**Fix**: Include forced decisions in the cache key and apply them during context creation.  
**Status**: ✅ FIXED and tested

## The Bug Discovery

### Symptoms
- NOVA test suite showed forced variation "on" returning "off" instead
- Forced decisions header `X-Optimizely-Forced-Decisions` was being sent correctly
- The system was acknowledging forced decisions but not applying them

### Initial Investigation
1. ✅ Headers were being parsed correctly
2. ✅ Configuration was extracting forced decisions
3. ✅ Forced decisions were being passed to DecisionService
4. ✅ SDK's `setForcedDecision` was being called
5. ❌ But decisions still returned wrong variations

## Root Cause Analysis

### The Caching Problem

The bug was in `DecisionService.getUserContext()` method:

```typescript
// BEFORE (BUGGY CODE):
private getUserContext(client: optimizely.Client, userId: string, attributes: optimizely.UserAttributes = {}): any {
  const cacheKey = `${userId}:${JSON.stringify(attributes)}`;  // ❌ NO FORCED DECISIONS IN KEY!
  
  // Check cache first
  const cached = this.userContextCache.get(cacheKey);
  if (cached) {
    return cached.context;  // ❌ Returns cached context WITHOUT forced decisions!
  }
  
  // Create new context
  context = client.createUserContext(userId, attributes);
  this.userContextCache.set(cacheKey, { context, timestamp: Date.now() });
  return context;
}
```

### The Problem Flow

1. **Request 1** (no forced decisions):
   - Creates user context for `user123`
   - Caches it with key: `user123:{}`
   
2. **Request 2** (with forced "on"):
   - Looks for cached context with key: `user123:{}` 
   - **FINDS IT!** (same key, no forced decisions in key)
   - Returns cached context from Request 1
   - Tries to apply forced decisions to cached object
   - **FAILS** because cached context is shared/immutable

3. **Result**: Forced decisions ignored, default variation returned

### Why It Worked Before
- Possibly no caching was enabled
- Different user IDs prevented cache hits
- SDK version differences
- Testing methodology differences

## The Fix

### Solution Implementation

```typescript
// AFTER (FIXED CODE):
private getUserContext(
  client: optimizely.Client, 
  userId: string, 
  attributes: optimizely.UserAttributes = {}, 
  forcedDecisions?: Record<string, any>  // NEW PARAMETER
): any {
  // Include forced decisions in cache key
  const cacheKey = forcedDecisions && Object.keys(forcedDecisions).length > 0
    ? `${userId}:${JSON.stringify(attributes)}:${JSON.stringify(forcedDecisions)}`  // ✅ INCLUDES FORCED DECISIONS!
    : `${userId}:${JSON.stringify(attributes)}`;
  
  // Check cache
  const cached = this.userContextCache.get(cacheKey);
  if (cached) {
    return cached.context;  // ✅ Returns correctly cached context WITH forced decisions
  }
  
  // Create new context
  context = client.createUserContext(userId, attributes);
  
  // Apply forced decisions immediately
  if (forcedDecisions) {
    for (const [flagKey, decision] of Object.entries(forcedDecisions)) {
      if (decision.variationKey && context.setForcedDecision) {
        context.setForcedDecision(
          { flagKey }, 
          { variationKey: decision.variationKey }
        );
      }
    }
  }
  
  // Cache with forced decisions already applied
  this.userContextCache.set(cacheKey, { context, timestamp: Date.now() });
  return context;
}
```

### Changes Made

1. **Added `forcedDecisions` parameter** to `getUserContext()`
2. **Modified cache key** to include forced decisions
3. **Applied forced decisions** during context creation (not after)
4. **Updated all callers** to pass forced decisions
5. **Removed duplicate code** that tried to apply forced decisions after retrieval

## Testing & Verification

### Test Scenarios

1. **Cache Isolation Test**
   - Same user, no forced → Returns normal variation
   - Same user, forced "on" → Returns "on" variation
   - Same user, no forced again → Returns normal (not polluted by forced)
   - Same user, forced "off" → Returns "off" variation

2. **Rapid Succession Test**
   - Multiple forced decisions in quick succession
   - Each maintains its own cache entry
   - No cross-contamination

3. **NOVA Framework Tests**
   - Re-run edge-core suite
   - Verify all forced decision tests pass

### Test Commands

```bash
# Build the fix
npm run build:cloudflare

# Start the server
wrangler dev --local

# Run comprehensive test
node test-forced-decisions-fix.js

# Run NOVA tests
cd critical-testing-project/nova
node runners/nova.js edge-core --verbose
```

## Impact & Benefits

### Immediate Benefits
- ✅ Forced decisions now work correctly
- ✅ Multiple users can have different forced decisions
- ✅ Same user can have different forced decisions for different flags
- ✅ Cache performance maintained

### Technical Improvements
- Better cache key generation strategy
- Cleaner separation of concerns
- Reduced code duplication
- More predictable behavior

## Lessons Learned

1. **Cache Key Completeness**: Always include ALL decision factors in cache keys
2. **Immutability Matters**: Don't modify cached objects that might be shared
3. **Test Real Scenarios**: Mock-free testing (NOVA) caught this real bug
4. **Deep Investigation Pays Off**: Following the code path thoroughly revealed the issue

## Files Modified

- `src-v2/services/implementations/DecisionService.ts`
  - Modified `getUserContext()` method
  - Updated `decide()` method 
  - Updated `decideMultiple()` method

## Next Steps

1. ✅ Run comprehensive tests with `test-forced-decisions-fix.js`
2. ✅ Verify NOVA test suite passes
3. ⏳ Monitor for any edge cases
4. ⏳ Consider adding specific cache tests to NOVA
5. ⏳ Document this pattern for future adapter implementations

---

**Bug Status**: RESOLVED  
**Fix Verified**: YES  
**Production Ready**: YES  
**Performance Impact**: NONE (actually improved by reducing redundant operations)