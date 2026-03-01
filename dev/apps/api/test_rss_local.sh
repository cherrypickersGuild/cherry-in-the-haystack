#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  RSS Feed Local Test Script${NC}"
echo -e "${BLUE}========================================${NC}"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
API_DIR="$SCRIPT_DIR"

# Check if .env file exists
if [ ! -f "$API_DIR/.env" ]; then
    echo -e "${RED}ERROR: .env file not found in $API_DIR${NC}"
    echo -e "${YELLOW}Please create .env file with required environment variables.${NC}"
    exit 1
fi

echo -e "${GREEN}Found .env file${NC}"

# Activate virtual environment if exists, otherwise create it
if [ -f "$API_DIR/venv/bin/activate" ]; then
    echo -e "${GREEN}Activating existing virtual environment...${NC}"
    source "$API_DIR/venv/bin/activate"
else
    echo -e "${YELLOW}Creating new virtual environment...${NC}"
    python3 -m venv "$API_DIR/venv"
    source "$API_DIR/venv/bin/activate"
    echo -e "${GREEN}Installing requirements...${NC}"
    pip install -q --upgrade pip
    pip install -q -r "$API_DIR/docker/requirements.txt"
fi

# Verify environment
echo -e "\n${BLUE}=== Environment Check ===${NC}"
python3 --version
echo "Python path: $(which python3)"
echo "Working directory: $API_DIR"

# Run test menu
echo -e "\n${BLUE}=== Test Menu ===${NC}"
echo "1. Test RSS Feed Connectivity (Quick Check)"
echo "2. Run Manual RSS Update (Full Pipeline)"
echo "3. Run Both Tests"
echo ""
read -p "Select test option (1-3): " TEST_OPTION

run_feed_connectivity_test() {
    echo -e "\n${BLUE}=== Testing RSS Feed Connectivity ===${NC}"
    cd "$API_DIR/src"
    python3 check_rss_feeds.py
}

run_manual_update() {
    echo -e "\n${BLUE}=== Running Manual RSS Update ===${NC}"
    echo -e "${YELLOW}This will:${NC}"
    echo "  1. Pull RSS feeds"
    echo "  2. Deduplicate against database"
    echo "  3. Summarize with LLM"
    echo "  4. Push to Notion"
    echo ""
    read -p "Continue? (y/n): " CONFIRM

    if [ "$CONFIRM" != "y" ]; then
        echo -e "${YELLOW}Cancelled.${NC}"
        return
    fi

    cd "$API_DIR/src"
    python3 manual_rss_update.py
}

case $TEST_OPTION in
    1)
        run_feed_connectivity_test
        ;;
    2)
        run_manual_update
        ;;
    3)
        run_feed_connectivity_test
        echo -e "\n${BLUE}========================================${NC}"
        sleep 2
        run_manual_update
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Test Completed${NC}"
echo -e "${GREEN}========================================${NC}"

# Check for log files
if [ -f "$API_DIR/src/rss_pull.log" ]; then
    echo -e "\n${BLUE}Log file created: ${NC}$API_DIR/src/rss_pull.log"
    echo -e "${YELLOW}Last 10 lines:${NC}"
    tail -10 "$API_DIR/src/rss_pull.log"
fi
