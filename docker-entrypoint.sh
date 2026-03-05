#!/bin/sh
set -e

echo "Pushing database schema..."
npm run db:push

echo "Seeding database..."
npm run db:seed

echo "Starting application..."
exec node server.js
