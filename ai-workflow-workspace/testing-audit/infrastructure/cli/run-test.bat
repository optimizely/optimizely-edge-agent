@echo off
REM Enhanced Test Runner Batch Script for Windows Command Line
REM Created as part of the Testing Audit Reconciliation project (testing-audit-reconciliation-04-10-2025)

setlocal enabledelayedexpansion

REM Default values
set BASE_URL=http://localhost:8787
set TEST_TYPE=default
set COMPARE=false
set OUTPUT=
set MODE=
set VERBOSE=false
set HELP=false

REM Parse command line arguments
:parse_args
if "%~1"=="" goto :run_test
if "%~1"=="--test" (
    set TEST_FILE=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="-t" (
    set TEST_FILE=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="--directory" (
    set TEST_DIR=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="-d" (
    set TEST_DIR=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="--type" (
    set TEST_TYPE=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="--base-url" (
    set BASE_URL=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="-b" (
    set BASE_URL=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="--output" (
    set OUTPUT=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="-o" (
    set OUTPUT=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="--compare" (
    set COMPARE=true
    shift
    goto :parse_args
)
if "%~1"=="-c" (
    set COMPARE=true
    shift
    goto :parse_args
)
if "%~1"=="--force-mode" (
    set MODE=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="-m" (
    set MODE=%~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="--no-retry" (
    set RETRY=--no-retry
    shift
    goto :parse_args
)
if "%~1"=="--time-difference" (
    set TIME_DIFF=--time-difference %~2
    shift
    shift
    goto :parse_args
)
if "%~1"=="--verbose" (
    set VERBOSE=true
    shift
    goto :parse_args
)
if "%~1"=="-v" (
    set VERBOSE=true
    shift
    goto :parse_args
)
if "%~1"=="--help" (
    set HELP=true
    shift
    goto :parse_args
)
if "%~1"=="-h" (
    set HELP=true
    shift
    goto :parse_args
)
echo Unknown option: %~1
shift
goto :parse_args

:run_test
REM Show help if requested
if "%HELP%"=="true" (
    echo.
    echo Enhanced Test Runner CLI for Windows
    echo.
    echo Usage:
    echo   run-test.bat [options]
    echo.
    echo Options:
    echo   --test, -t ^<file^>            Test file to run
    echo   --directory, -d ^<dir^>        Directory containing test files to run
    echo   --type ^<type^>                Test type (default, kv-storage, decision-api, etc.)
    echo   --base-url, -b ^<url^>         Base URL for test requests (default: CLOUDFLARE_WORKER_URL or http://localhost:8787)
    echo   --output, -o ^<file^>          Save results to JSON file
    echo   --compare, -c                Run test in both local and live environments and compare results
    echo   --force-mode, -m ^<mode^>      Force environment mode ('local' or 'live')
    echo   --no-retry                   Disable retry logic for operations
    echo   --time-difference ^<ms^>       Maximum acceptable time difference for comparison (default: 1000ms)
    echo   --verbose, -v                Enable verbose logging
    echo   --help, -h                   Show this help message
    echo.
    echo Examples:
    echo   run-test.bat --test tests/example-test.js
    echo   run-test.bat --directory tests --type kv-storage
    echo   run-test.bat --test tests/example-test.js --compare --output results.json
    echo   run-test.bat --test tests/example-test.js --force-mode live
    goto :end
)

REM Validate required options
if "%TEST_FILE%"=="" (
    if "%TEST_DIR%"=="" (
        echo Error: Either --test or --directory must be specified
        echo Try 'run-test.bat --help' for more information
        goto :end
    )
)

REM Use CLOUDFLARE_WORKER_URL if set and no explicit base URL provided
if not "%CLOUDFLARE_WORKER_URL%"=="" (
    if "%BASE_URL%"=="http://localhost:8787" (
        set BASE_URL=!CLOUDFLARE_WORKER_URL!
    )
)

REM Build command
set CMD=node "%~dp0run-test.js"
if not "%TEST_FILE%"=="" set CMD=!CMD! --test "%TEST_FILE%"
if not "%TEST_DIR%"=="" set CMD=!CMD! --directory "%TEST_DIR%"
if not "%TEST_TYPE%"=="default" set CMD=!CMD! --type %TEST_TYPE%
if not "%BASE_URL%"=="http://localhost:8787" set CMD=!CMD! --base-url "%BASE_URL%"
if not "%OUTPUT%"=="" set CMD=!CMD! --output "%OUTPUT%"
if "%COMPARE%"=="true" set CMD=!CMD! --compare
if not "%MODE%"=="" set CMD=!CMD! --force-mode %MODE%
if not "%RETRY%"=="" set CMD=!CMD! %RETRY%
if not "%TIME_DIFF%"=="" set CMD=!CMD! %TIME_DIFF%
if "%VERBOSE%"=="true" set CMD=!CMD! --verbose

REM Display environment info
echo.
echo ===== Environment Information =====
echo Base URL: %BASE_URL%
echo Test Type: %TEST_TYPE%
if not "%CLOUDFLARE_WORKER_URL%"=="" echo CLOUDFLARE_WORKER_URL: %CLOUDFLARE_WORKER_URL%
if not "%OPTIMIZELY_SDK_KEY%"=="" echo OPTIMIZELY_SDK_KEY is set
echo ================================
echo.

REM Execute command
if "%VERBOSE%"=="true" echo Executing: !CMD!
!CMD!

:end
endlocal 