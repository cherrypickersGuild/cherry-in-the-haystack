#!/bin/bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <topic> <update_path>"
  echo "Example: $0 \"RAG evaluation\" dev/apps/agent/writer_agent/data/update.txt"
  exit 1
fi

topic="$1"
update_path="$2"

WRITER_UPDATE_PATH="$update_path" \
python3 dev/apps/agent/writer_agent/run_writer_agent.py "$topic"

latest_json=$(ls -t dev/apps/agent/writer_agent/outputs/*.json | head -n 1)
python3 dev/apps/agent/writer_agent/build_front_preview.py "$latest_json"

echo "Used writer output: $latest_json"
