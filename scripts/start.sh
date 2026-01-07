#!/bin/sh
# Olive Baby API - Start Script
# Resolve failed migrations and start the server

echo "Resolving failed migrations..."
npx prisma migrate resolve --rolled-back 20260103_promote_admin 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260103211800_promote_admin 2>/dev/null || true

echo "Applying pending migrations..."
npx prisma migrate deploy || true

echo "Starting server..."
node dist/app.js
