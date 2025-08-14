# Simple test for forcedDecisions functionality
Write-Host "Simple forcedDecisions test..." -ForegroundColor Green

# Using curl directly for clearer debugging
Write-Host "`nTest with forced decision (testing_forced):" -ForegroundColor Cyan
$curlCmd = "curl -X POST http://localhost:8787/decide -H 'Content-Type: application/json' -d '{`"userId`":`"test-user-4`",`"flagKey`":`"test-flag`",`"sdkKey`":`"8mR1pGh8u2ztUP8GqjmQq`",`"attributes`":{`"forcedDecisions`":[{`"flagKey`":`"test-flag`",`"variationKey`":`"testing_forced`"}]}}'"
Write-Host "Running command: $curlCmd"
Invoke-Expression $curlCmd

# Let's also check what happens with a non-forced request for comparison
Write-Host "`n`nTest without forced decision (same user):" -ForegroundColor Cyan
$curlCmd2 = "curl -X POST http://localhost:8787/decide -H 'Content-Type: application/json' -d '{`"userId`":`"test-user-4`",`"flagKey`":`"test-flag`",`"sdkKey`":`"8mR1pGh8u2ztUP8GqjmQq`"}'"
Write-Host "Running command: $curlCmd2"
Invoke-Expression $curlCmd2 