#!/bin/sh
cd "$(dirname "$0")"
if [ ! -f dist/index.html ]; then npm ci && npm run build || exit 1; fi
node runtime/server.mjs --open
