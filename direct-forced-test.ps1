# Direct test for forcedDecisions functionality
Write-Host "Testing forcedDecisions with direct headers and body..." -ForegroundColor Green

# Test with direct variation forcing
Write-Host "`n1. Test direct variation forcing (test-user-5):" -ForegroundColor Cyan

# Base case - natural bucketing
$baseBody = @{
    userId = "test-user-5"
    flagKey = "test-flag"
    sdkKey = "8mR1pGh8u2ztUP8GqjmQq"
} | ConvertTo-Json

Write-Host "`nNatural bucketing request:"
Write-Host $baseBody

$baseResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body $baseBody
Write-Host "Status: $($baseResponse.StatusCode)"
$baseContent = $baseResponse.Content | ConvertFrom-Json
Write-Host "Natural variation: $($baseContent.variationKey)"

# Testing with forced variation
$forcedBody = @{
    userId = "test-user-5"
    flagKey = "test-flag"
    sdkKey = "8mR1pGh8u2ztUP8GqjmQq"
    attributes = @{
        forcedDecisions = @(
            @{
                flagKey = "test-flag"
                variationKey = "testing_forced"
            }
        )
    }
} | ConvertTo-Json -Depth 10

Write-Host "`nForced request body:"
Write-Host $forcedBody

$forcedResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body $forcedBody
Write-Host "Status: $($forcedResponse.StatusCode)"
$forcedContent = $forcedResponse.Content | ConvertFrom-Json
Write-Host "Forced variation: $($forcedContent.variationKey)"

# Testing forcing to a different variation
$controlBody = @{
    userId = "test-user-5"
    flagKey = "test-flag" 
    sdkKey = "8mR1pGh8u2ztUP8GqjmQq"
    attributes = @{
        forcedDecisions = @(
            @{
                flagKey = "test-flag"
                variationKey = "control"
            }
        )
    }
} | ConvertTo-Json -Depth 10

Write-Host "`nForce to 'control' request:"
Write-Host $controlBody

$controlResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body $controlBody
Write-Host "Status: $($controlResponse.StatusCode)"
$controlContent = $controlResponse.Content | ConvertFrom-Json
Write-Host "Control variation: $($controlContent.variationKey)"

# Remove forced variation by sending empty array
$removeBody = @{
    userId = "test-user-5"
    flagKey = "test-flag"
    sdkKey = "8mR1pGh8u2ztUP8GqjmQq"
    attributes = @{
        forcedDecisions = @()
    }
} | ConvertTo-Json -Depth 10

Write-Host "`nRemove forced decision request:"
Write-Host $removeBody

$removeResponse = Invoke-WebRequest -Uri "http://localhost:8787/decide" -Method POST -ContentType "application/json" -Body $removeBody
Write-Host "Status: $($removeResponse.StatusCode)"
$removeContent = $removeResponse.Content | ConvertFrom-Json
Write-Host "After removal variation: $($removeContent.variationKey)"

# Summary
Write-Host "`nTest Summary:" -ForegroundColor Yellow
Write-Host "Natural variation: $($baseContent.variationKey)"
Write-Host "Forced to 'testing_forced': $($forcedContent.variationKey)"
Write-Host "Forced to 'control': $($controlContent.variationKey)"
Write-Host "After removal: $($removeContent.variationKey)" 