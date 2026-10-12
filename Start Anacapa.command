#!/bin/sh
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
 echo 'Install Node.js 22.13 or newer from nodejs.org, then open this file again.'
 read -r wait_key
 exit 1
fi
if [ ! -f dist/index.html ]; then
 echo 'Preparing Anacapa. This first setup needs internet access.'
 npm ci && npm run build || exit 1
fi
node runtime/server.mjs --open
