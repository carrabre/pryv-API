#!/bin/bash

echo "🔄 Restarting development server with fresh environment..."

# Kill any existing Next.js development server
echo "📴 Stopping existing development server..."
pkill -f "next dev" || true
pkill -f "pnpm dev" || true

# Clear Next.js cache
echo "🧹 Clearing Next.js cache..."
rm -rf .next

# Clear node modules cache if needed
echo "🧹 Clearing package manager cache..."
pnpm store prune || true

# Load environment variables and show current config
echo "🔍 Current environment configuration:"
if [ -f .env.local ]; then
    echo "✅ .env.local found"
    grep -E "^NEXT_PUBLIC_" .env.local | sed 's/=.*/=***/' || echo "No NEXT_PUBLIC_ variables found"
else
    echo "⚠️  .env.local not found"
fi

# Start development server
echo "🚀 Starting development server..."
pnpm dev 