#!/bin/bash

# Vercel Setup Script for Optimizely Edge Agent Test App
# Email: simonecoelhosfo@gmail.com

echo "================================================"
echo "Optimizely Edge Agent - Vercel Setup Script"
echo "================================================"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Node.js is installed
if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js version: $(node --version)"

# Check if npm is installed
if ! command_exists npm; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✓ npm version: $(npm --version)"

# Step 1: Install Vercel CLI
echo ""
echo "Step 1: Installing Vercel CLI..."
if ! command_exists vercel; then
    npm install -g vercel
    echo "✓ Vercel CLI installed"
else
    echo "✓ Vercel CLI already installed: $(vercel --version)"
fi

# Step 2: Login to Vercel
echo ""
echo "Step 2: Login to Vercel"
echo "When prompted, use email: simonecoelhosfo@gmail.com"
echo "Press Enter to continue..."
read
vercel login

# Step 3: Install dependencies
echo ""
echo "Step 3: Installing project dependencies..."
npm install
echo "✓ Dependencies installed"

# Step 4: Setup environment file
echo ""
echo "Step 4: Setting up environment configuration..."
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo "✓ Created .env.local from template"
    echo ""
    echo "⚠️  IMPORTANT: You need to edit .env.local and add your Optimizely SDK key"
    echo "   Open .env.local and replace 'your-optimizely-sdk-key' with your actual key"
    echo ""
    echo "To get your SDK key:"
    echo "1. Go to https://app.optimizely.com"
    echo "2. Navigate to Settings → Environments"
    echo "3. Copy the SDK Key"
    echo ""
    echo "Press Enter after you've added your SDK key to .env.local..."
    read
else
    echo "✓ .env.local already exists"
fi

# Step 5: Build the Edge Agent
echo ""
echo "Step 5: Building Edge Agent..."
echo "Going to parent directory to build..."
cd ..
if [ -f "package.json" ]; then
    npm install
    npm run build:vercel
    echo "✓ Edge Agent built successfully"
else
    echo "⚠️  Warning: Could not find parent package.json"
    echo "   Make sure you're in the correct directory structure"
fi
cd vercel-test-app

# Step 6: Test locally
echo ""
echo "Step 6: Testing locally..."
echo "Starting development server..."
echo "Visit http://localhost:3000 to test"
echo "Press Ctrl+C when you're done testing, then we'll deploy"
npm run dev

# Step 7: Deploy to Vercel
echo ""
echo "Step 7: Deploying to Vercel..."
echo "This will create a new project in your Vercel account"
echo ""
echo "When prompted:"
echo "- Set up and deploy? → Yes"
echo "- Which scope? → Select your personal account" 
echo "- Link to existing project? → No"
echo "- Project name? → optimizely-edge-agent-test (or press Enter for default)"
echo "- Directory? → ./ (just press Enter)"
echo "- Override settings? → No"
echo ""
echo "Press Enter to start deployment..."
read

vercel

# Get deployment URL
echo ""
echo "Step 8: Setting environment variables..."
echo "We need to add environment variables to your Vercel project"
echo ""

# Add environment variables
echo "Adding OPTIMIZELY_SDK_KEY..."
vercel env add OPTIMIZELY_SDK_KEY production

echo "Adding NEXT_PUBLIC_OPTIMIZELY_SDK_KEY..."
vercel env add NEXT_PUBLIC_OPTIMIZELY_SDK_KEY production

echo "Adding OPTIMIZELY_ENABLE_EDGE_MODE..."
echo "true" | vercel env add OPTIMIZELY_ENABLE_EDGE_MODE production

echo "Adding OPTIMIZELY_ENABLE_AGENT_MODE..."
echo "true" | vercel env add OPTIMIZELY_ENABLE_AGENT_MODE production

# Step 9: Production deployment
echo ""
echo "Step 9: Deploying to production with environment variables..."
vercel --prod

echo ""
echo "================================================"
echo "✅ Setup Complete!"
echo "================================================"
echo ""
echo "Your app should now be live!"
echo "Check the URL provided above"
echo ""
echo "Test endpoints:"
echo "- Home: https://your-app.vercel.app/"
echo "- API Tester: https://your-app.vercel.app/test-api"
echo "- Edge Mode Test: https://your-app.vercel.app/test-pages/home"
echo "- Origin endpoint: https://your-app.vercel.app/origin/home"
echo ""
echo "Next steps:"
echo "1. Visit your deployment URL"
echo "2. Test the Edge Agent functionality"
echo "3. Use the origin URLs for Cloudflare/Fastly testing"
echo ""