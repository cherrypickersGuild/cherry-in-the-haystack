#!/bin/bash
cd "$(dirname "$0")"
export PATH="/Users/soma/.nvm/versions/node/v20.19.2/bin:$PATH"

# pnpm 환경에서 ts-node 경로 탐색
TS_NODE=$(find /Users/soma/IdeaProjects/cherry-in-the-haystack/node_modules/.pnpm -name "bin.js" -path "*/ts-node/dist/bin.js" 2>/dev/null | head -1)

if [ -z "$TS_NODE" ]; then
  echo "Error: ts-node not found" >&2
  exit 1
fi

exec node "$TS_NODE" -r tsconfig-paths/register src/mcp-server.ts
