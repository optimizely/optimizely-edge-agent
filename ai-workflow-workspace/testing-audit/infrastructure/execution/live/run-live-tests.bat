@echo off
:: Batch script for running tests against the live Cloudflare Worker environment
:: Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)

echo ===================================================================
echo Live Environment Test Runner
echo ===================================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js is not installed or not in the PATH.
    echo Please install Node.js and try again.
    exit /b 1
)

:: Set working directory to script location
pushd %~dp0\..\..\..\..\..

:: Display environment information
echo Current directory: %CD%
echo Node version: 
node --version
echo.

:: Check for environment variables
if not defined CLOUDFLARE_WORKER_URL (
    echo WARNING: CLOUDFLARE_WORKER_URL environment variable is not set.
    echo You can set it with: set CLOUDFLARE_WORKER_URL=https://your-worker-url
    echo Or pass it via the --url parameter.
    echo.
)

if not defined OPTIMIZELY_SDK_KEY (
    echo WARNING: OPTIMIZELY_SDK_KEY environment variable is not set.
    echo You can set it with: set OPTIMIZELY_SDK_KEY=your-sdk-key
    echo Or pass it via the --key parameter.
    echo.
)

:: Display warning about live environment testing
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
echo WARNING: You are about to run tests against the LIVE environment.
echo This may have impacts on production data and services.
echo !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
echo.

:: Prompt for confirmation
set /p CONFIRM=Type 'yes' to continue or anything else to abort: 
if /i not "%CONFIRM%"=="yes" (
    echo Aborted.
    exit /b 0
)

echo.
echo Proceeding with live environment testing...
echo.

:: Run the script with provided arguments
node ai-workflow-workspace\testing-audit\infrastructure\execution\live\run-live-tests.js %*

:: Capture exit code
set EXIT_CODE=%ERRORLEVEL%

:: Restore original directory
popd

:: Exit with the same code as the Node script
exit /b %EXIT_CODE% 