# Test script for forcedDecisions functionality
Write-Host "Testing forcedDecisions functionality against local server..." -ForegroundColor Green

# Base case - No forced decision
Write-Host "`n1. Base case (no forced decision):" -ForegroundColor Cyan
$baseResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body '{"userId":"test-user-1","flagKey":"test-flag","sdkKey":"8mR1pGh8u2ztUP8GqjmQq"}' -UseBasicParsing
Write-Host "Status: $($baseResponse.StatusCode)"
Write-Host "Content: $($baseResponse.Content)"

# Test with forced decision
Write-Host "`n2. With forced decision:" -ForegroundColor Cyan
$forcedResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body '{"userId":"test-user-1","flagKey":"test-flag","sdkKey":"8mR1pGh8u2ztUP8GqjmQq","attributes":{"forcedDecisions":[{"flagKey":"test-flag","variationKey":"testing_forced"}]}}' -UseBasicParsing
Write-Host "Status: $($forcedResponse.StatusCode)"
Write-Host "Content: $($forcedResponse.Content)"

# Test with rule-based forced decision
Write-Host "`n3. With rule-based forced decision:" -ForegroundColor Cyan
$ruleResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body '{"userId":"test-user-1","flagKey":"test-flag","sdkKey":"8mR1pGh8u2ztUP8GqjmQq","attributes":{"forcedDecisions":[{"flagKey":"test-flag","ruleKey":"rule1","variationKey":"On"}]}}' -UseBasicParsing
Write-Host "Status: $($ruleResponse.StatusCode)"
Write-Host "Content: $($ruleResponse.Content)"

# Test multiple forced decisions
Write-Host "`n4. With multiple forced decisions:" -ForegroundColor Cyan
$multiResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body '{"userId":"test-user-1","flagKey":"test-flag","sdkKey":"8mR1pGh8u2ztUP8GqjmQq","attributes":{"forcedDecisions":[{"flagKey":"test-flag","variationKey":"testing_forced"},{"flagKey":"another-flag","variationKey":"Control"}]}}' -UseBasicParsing
Write-Host "Status: $($multiResponse.StatusCode)"
Write-Host "Content: $($multiResponse.Content)"

# Test persistence - Run same user ID again without forced decision
Write-Host "`n5. Testing persistence (same user without forced decision):" -ForegroundColor Cyan
$persistenceResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body '{"userId":"test-user-1","flagKey":"test-flag","sdkKey":"8mR1pGh8u2ztUP8GqjmQq"}' -UseBasicParsing
Write-Host "Status: $($persistenceResponse.StatusCode)"
Write-Host "Content: $($persistenceResponse.Content)"

Write-Host "`nTesting complete!" -ForegroundColor Green 