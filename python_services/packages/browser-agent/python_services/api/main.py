"""
FastAPI application entry-point for the Python crawler service (port 8000).

Lifespan:
  - Initialises the asyncpg connection pool on startup.
  - Story 1.7 will add BrowserConfig singleton here for /crawler/execute.
  - Closes the pool on shutdown.

Run locally:
  DATABASE_URL=postgresql://... ANTHROPIC_API_KEY=... uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import FastAPI

from .db.client import close_pool, init_pool
from .routers import crawler, run_all


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool(os.environ["DATABASE_URL"])
    from crawl4ai import BrowserConfig  # deferred import — allows test patching
    app.state.browser_config = BrowserConfig(headless=True, verbose=False)
    yield
    await close_pool()


app = FastAPI(title="browser-agent crawler service", lifespan=lifespan)
app.include_router(crawler.router)
app.include_router(run_all.router)
