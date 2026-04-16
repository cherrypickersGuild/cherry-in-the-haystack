#!/bin/bash
exec node "$(dirname "$0")/cherry-agent.js" 2>/tmp/cherry-mcp.log
