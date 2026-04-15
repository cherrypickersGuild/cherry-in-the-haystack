#!/usr/bin/env python3
"""
Convenience script to run source sync from the news_collector package.

Usage:
    python sync_sources.py
    python sync_sources.py --dry-run
    python sync_sources.py --database-id <notion_database_id>
"""

import sys
import os

# Add src to path so we can import the sync_sources module
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from sync_sources import main

if __name__ == "__main__":
    main()
