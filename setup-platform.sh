#!/bin/bash

# Setup script to configure the project for a specific platform

PLATFORM=$1

if [ -z "$PLATFORM" ]; then
    echo "Usage: ./setup-platform.sh [cloudflare|vercel|fastly]"
    exit 1
fi

case "$PLATFORM" in
    cloudflare)
        echo "Setting up for Cloudflare Workers..."
        cp package.cloudflare.json package.json
        echo "✓ Copied package.cloudflare.json to package.json"
        echo "✓ Run 'npm install' or 'yarn install' to install dependencies"
        echo "✓ Run 'npm run dev' to start development server"
        ;;
    vercel)
        echo "Setting up for Vercel..."
        cp package.vercel.json package.json
        echo "✓ Copied package.vercel.json to package.json"
        echo "✓ Run 'npm install' to install dependencies"
        echo "✓ Run 'npm run dev' to start Vercel dev server on port 5000"
        ;;
    fastly)
        echo "Setting up for Fastly Compute..."
        cp package.fastly.json package.json
        echo "✓ Copied package.fastly.json to package.json"
        echo "✓ Run 'npm install' to install dependencies"
        echo "✓ Run 'npm run dev' to start Fastly development server"
        ;;
    *)
        echo "Error: Unknown platform '$PLATFORM'"
        echo "Usage: ./setup-platform.sh [cloudflare|vercel|fastly]"
        exit 1
        ;;
esac

echo ""
echo "Platform setup complete for: $PLATFORM"