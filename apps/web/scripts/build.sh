#!/bin/bash
set -e

echo "🔧 Generating Prisma Client..."
npx prisma generate

echo "🗄️ Running database migrations..."
npx prisma migrate deploy || echo "⚠️ Migration failed, continuing build..."

echo "🏗️ Building Next.js..."
npx next build

echo "✅ Build complete!"
