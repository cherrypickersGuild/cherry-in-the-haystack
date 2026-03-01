"""
Auto-News API Service

FastAPI application with embedded APScheduler for batch job scheduling.
Replaces Airflow + provides REST API for data access and management.
"""

import logging
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from scheduler import NewsScheduler
from api.schemas import HealthResponse, SchedulerStatus
from api.routers import articles, feeds, jobs

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("autonews")

scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduler
    logger.info("Starting Auto-News API service...")

    # Start scheduler
    scheduler = NewsScheduler()
    scheduler.start()
    logger.info("Scheduler started")

    yield

    # Shutdown
    if scheduler:
        scheduler.shutdown()
    logger.info("Auto-News API service shut down")


app = FastAPI(
    title="Auto-News API",
    description="AI-powered news aggregation and curation API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(articles.router)
app.include_router(feeds.router)
app.include_router(jobs.router)


@app.get("/api/v1/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(
        status="ok",
        timestamp=datetime.now(),
    )


@app.get("/api/v1/scheduler/status", response_model=SchedulerStatus)
def scheduler_status():
    global scheduler
    if not scheduler:
        return SchedulerStatus(running=False, jobs=[])

    return SchedulerStatus(
        running=True,
        jobs=scheduler.get_jobs(),
    )
