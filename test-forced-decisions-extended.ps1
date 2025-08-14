# Enhanced test script for forcedDecisions functionality
Write-Host "Testing forcedDecisions functionality against local server..." -ForegroundColor Green

# Base case - No forced decision
Write-Host "`n1. Base case (no forced decision):" -ForegroundColor Cyan
$baseResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body '{"userId":"test-user-2","flagKey":"test-flag","sdkKey":"8mR1pGh8u2ztUP8GqjmQq"}' -UseBasicParsing
Write-Host "Status: $($baseResponse.StatusCode)"
Write-Host "Response (natural bucketing):" 
$baseContent = $baseResponse.Content | ConvertFrom-Json
Write-Host "Variation: $($baseContent.variationKey)"

# Force to testing_forced variation
Write-Host "`n2. Force to 'testing_forced' variation:" -ForegroundColor Cyan
$forcedResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body '{"userId":"test-user-2","flagKey":"test-flag","sdkKey":"8mR1pGh8u2ztUP8GqjmQq","attributes":{"forcedDecisions":[{"flagKey":"test-flag","variationKey":"testing_forced"}]}}' -UseBasicParsing
Write-Host "Status: $($forcedResponse.StatusCode)"
$forcedContent = $forcedResponse.Content | ConvertFrom-Json
Write-Host "Variation: $($forcedContent.variationKey)"

# Change to 'control' variation
Write-Host "`n3. Change to 'control' variation:" -ForegroundColor Cyan
$controlResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body '{"userId":"test-user-2","flagKey":"test-flag","sdkKey":"8mR1pGh8u2ztUP8GqjmQq","attributes":{"forcedDecisions":[{"flagKey":"test-flag","variationKey":"control"}]}}' -UseBasicParsing
Write-Host "Status: $($controlResponse.StatusCode)"
$controlContent = $controlResponse.Content | ConvertFrom-Json
Write-Host "Variation: $($controlContent.variationKey)"

# Change to 'on' variation
Write-Host "`n4. Change to 'on' variation:" -ForegroundColor Cyan
$onResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body '{"userId":"test-user-2","flagKey":"test-flag","sdkKey":"8mR1pGh8u2ztUP8GqjmQq","attributes":{"forcedDecisions":[{"flagKey":"test-flag","variationKey":"on"}]}}' -UseBasicParsing
Write-Host "Status: $($onResponse.StatusCode)"
$onContent = $onResponse.Content | ConvertFrom-Json
Write-Host "Variation: $($onContent.variationKey)"

# Remove forced variation - Test return to natural bucketing
Write-Host "`n5. Remove forced variation (should return to natural bucketing):" -ForegroundColor Cyan
$naturalResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body '{"userId":"test-user-2","flagKey":"test-flag","sdkKey":"8mR1pGh8u2ztUP8GqjmQq","attributes":{"forcedDecisions":[]}}' -UseBasicParsing
Write-Host "Status: $($naturalResponse.StatusCode)"
$naturalContent = $naturalResponse.Content | ConvertFrom-Json
Write-Host "Variation: $($naturalContent.variationKey)"

# Send request without forcedDecisions attribute to confirm natural bucketing
Write-Host "`n6. Request without forcedDecisions attribute:" -ForegroundColor Cyan
$withoutForcedResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body '{"userId":"test-user-2","flagKey":"test-flag","sdkKey":"8mR1pGh8u2ztUP8GqjmQq"}' -UseBasicParsing
Write-Host "Status: $($withoutForcedResponse.StatusCode)"
$withoutForcedContent = $withoutForcedResponse.Content | ConvertFrom-Json
Write-Host "Variation: $($withoutForcedContent.variationKey)"

# Use different user to verify isolation of forced decisions
Write-Host "`n7. Different user (should get natural bucketing):" -ForegroundColor Cyan
$differentUserResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body '{"userId":"test-user-3","flagKey":"test-flag","sdkKey":"8mR1pGh8u2ztUP8GqjmQq"}' -UseBasicParsing
Write-Host "Status: $($differentUserResponse.StatusCode)"
$differentUserContent = $differentUserResponse.Content | ConvertFrom-Json
Write-Host "Variation: $($differentUserContent.variationKey)"

# Verify previous user still gets natural bucketing after forced decision removal
Write-Host "`n8. Previous user after forced decision removal:" -ForegroundColor Cyan
$previousUserResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body '{"userId":"test-user-2","flagKey":"test-flag","sdkKey":"8mR1pGh8u2ztUP8GqjmQq"}' -UseBasicParsing
Write-Host "Status: $($previousUserResponse.StatusCode)"
$previousUserContent = $previousUserResponse.Content | ConvertFrom-Json
Write-Host "Variation: $($previousUserContent.variationKey)"

Write-Host "`nTesting complete!" -ForegroundColor Green
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "- Base natural bucketing: $($baseContent.variationKey)"
Write-Host "- Forced to 'testing_forced': $($forcedContent.variationKey)"
Write-Host "- Forced to 'control': $($controlContent.variationKey)"
Write-Host "- Forced to 'on': $($onContent.variationKey)"
Write-Host "- After removing forced variation: $($naturalContent.variationKey)"
Write-Host "- Different user (natural bucketing): $($differentUserContent.variationKey)" 