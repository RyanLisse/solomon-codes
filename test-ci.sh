#!/bin/bash

set -e

echo "🧪 Testing CI steps individually..."

echo "Step 1: Dependencies"
bun install > /dev/null 2>&1 && echo "✅ Dependencies OK" || echo "❌ Dependencies failed"

echo "Step 2: TypeScript check"
npm run typecheck > /dev/null 2>&1 && echo "✅ TypeScript OK" || echo "❌ TypeScript failed"

echo "Step 3: Build"
npm run build > /dev/null 2>&1 && echo "✅ Build OK" || echo "❌ Build failed"

echo "Step 4: Tests"
npm run test > /dev/null 2>&1 && echo "✅ Tests OK" || echo "❌ Tests failed"

echo "🎉 CI test complete!"
