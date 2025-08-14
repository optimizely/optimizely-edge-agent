@echo off
REM Vercel Setup Script for Optimizely Edge Agent Test App
REM Email: simonecoelhosfo@gmail.com

echo ================================================
echo Optimizely Edge Agent - Vercel Setup Script
echo ================================================
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed. Please install Node.js 16+ first.
    echo Visit: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

REM Step 1: Install Vercel CLI
echo Step 1: Installing Vercel CLI...
where vercel >nul 2>nul
if %errorlevel% neq 0 (
    echo Installing Vercel CLI globally...
    npm install -g vercel
) else (
    echo Vercel CLI already installed
    vercel --version
)
echo.

REM Step 2: Login
echo Step 2: Login to Vercel
echo When prompted, use email: simonecoelhosfo@gmail.com
echo.
pause
vercel login
echo.

REM Step 3: Install dependencies
echo Step 3: Installing project dependencies...
call npm install
echo Dependencies installed
echo.

REM Step 4: Environment setup
echo Step 4: Setting up environment configuration...
if not exist .env.local (
    copy .env.example .env.local
    echo Created .env.local from template
    echo.
    echo IMPORTANT: You need to edit .env.local and add your Optimizely SDK key
    echo.
    echo To get your SDK key:
    echo 1. Go to https://app.optimizely.com
    echo 2. Navigate to Settings - Environments
    echo 3. Copy the SDK Key
    echo.
    echo Open .env.local in a text editor and replace 'your-optimizely-sdk-key'
    notepad .env.local
    echo.
    echo Press any key after you've saved your SDK key...
    pause >nul
) else (
    echo .env.local already exists
)
echo.

REM Step 5: Build Edge Agent
echo Step 5: Building Edge Agent...
cd ..
if exist package.json (
    call npm install
    call npm run build:vercel
    echo Edge Agent built successfully
) else (
    echo Warning: Could not find parent package.json
)
cd vercel-test-app
echo.

REM Step 6: Test locally
echo Step 6: Testing locally...
echo Starting development server...
echo Visit http://localhost:3000 to test
echo Press Ctrl+C when done testing, then we'll deploy
echo.
start http://localhost:3000
call npm run dev

REM Step 7: Deploy
echo.
echo Step 7: Deploying to Vercel...
echo.
echo When prompted:
echo - Set up and deploy? - Yes
echo - Which scope? - Select your personal account
echo - Link to existing project? - No
echo - Project name? - optimizely-edge-agent-test (or press Enter)
echo - Directory? - ./ (just press Enter)
echo - Override settings? - No
echo.
pause
vercel

REM Step 8: Environment variables
echo.
echo Step 8: Setting environment variables...
echo.

echo Adding OPTIMIZELY_SDK_KEY...
vercel env add OPTIMIZELY_SDK_KEY production

echo Adding NEXT_PUBLIC_OPTIMIZELY_SDK_KEY...
vercel env add NEXT_PUBLIC_OPTIMIZELY_SDK_KEY production

echo Adding OPTIMIZELY_ENABLE_EDGE_MODE...
echo true | vercel env add OPTIMIZELY_ENABLE_EDGE_MODE production

echo Adding OPTIMIZELY_ENABLE_AGENT_MODE...
echo true | vercel env add OPTIMIZELY_ENABLE_AGENT_MODE production

REM Step 9: Production deployment
echo.
echo Step 9: Deploying to production with environment variables...
vercel --prod

echo.
echo ================================================
echo Setup Complete!
echo ================================================
echo.
echo Your app should now be live!
echo Check the URL provided above
echo.
pause