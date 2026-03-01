from typing import Optional
from threading import Thread

from fastapi import APIRouter, Query, HTTPException

from api.deps import get_pg
from api.schemas import JobRunList, JobRunResponse, JobTriggerResponse
from pipeline import (
    run_news_pulling,
    run_sync_dist,
    run_collection_weekly,
    run_journal_daily,
    run_action,
)

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])

PIPELINE_MAP = {
    "news_pulling": run_news_pulling,
    "sync_dist": run_sync_dist,
    "collection_weekly": run_collection_weekly,
    "journal_daily": run_journal_daily,
    "action": run_action,
}


@router.get("", response_model=JobRunList)
def list_job_runs(
    job_name: Optional[str] = Query(None, description="Filter by job name"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    pg = get_pg()
    return pg.get_job_runs(job_name=job_name, page=page, size=size)


@router.get("/{job_name}/latest", response_model=Optional[JobRunResponse])
def get_latest_job_run(job_name: str):
    pg = get_pg()
    result = pg.get_latest_job_run(job_name)
    if not result:
        raise HTTPException(status_code=404, detail=f"No runs found for {job_name}")
    return result


@router.post("/{job_name}/trigger", response_model=JobTriggerResponse)
def trigger_job(job_name: str):
    if job_name not in PIPELINE_MAP:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown job: {job_name}. Available: {', '.join(PIPELINE_MAP.keys())}"
        )

    # Run in background thread to not block the API
    thread = Thread(target=PIPELINE_MAP[job_name], daemon=True)
    thread.start()

    return JobTriggerResponse(
        success=True,
        message=f"Job {job_name} triggered in background",
        job_name=job_name,
    )
