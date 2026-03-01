"""
APScheduler-based batch scheduler. Replaces Apache Airflow.

Lightweight in-process scheduler with:
- Cron-like scheduling matching existing Airflow DAG intervals
- max_instances=1 (equivalent to Airflow max_active_runs=1)
- coalesce=True (collapse missed runs)
- Asia/Seoul timezone
"""

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED

from pipeline import (
    run_news_pulling,
    run_sync_dist,
    run_collection_weekly,
    run_journal_daily,
    run_action,
)

logger = logging.getLogger("scheduler")


def _job_listener(event):
    """Log job execution results."""
    if event.exception:
        logger.error(f"Job {event.job_id} failed: {event.exception}")
    else:
        logger.info(f"Job {event.job_id} completed successfully")


class NewsScheduler:
    def __init__(self):
        executors = {
            "default": ThreadPoolExecutor(max_workers=3),
        }
        job_defaults = {
            "coalesce": True,
            "max_instances": 1,
            "misfire_grace_time": 300,  # 5 minutes
        }
        self.scheduler = BackgroundScheduler(
            executors=executors,
            job_defaults=job_defaults,
            timezone="Asia/Seoul",
        )
        self.scheduler.add_listener(_job_listener, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)

    def start(self):
        """Register all jobs and start the scheduler."""

        # news_pulling: every hour at :15
        self.scheduler.add_job(
            run_news_pulling,
            "cron",
            minute=15,
            id="news_pulling",
            name="News Pulling (RSS + API + Substack)",
            replace_existing=True,
        )

        # sync_dist: every hour at :01
        self.scheduler.add_job(
            run_sync_dist,
            "cron",
            minute=1,
            id="sync_dist",
            name="Sync Distribution (Milvus embeddings)",
            replace_existing=True,
        )

        # collection_weekly: Saturday at 02:30
        self.scheduler.add_job(
            run_collection_weekly,
            "cron",
            day_of_week="sat",
            hour=2,
            minute=30,
            id="collection_weekly",
            name="Weekly Collection Summary",
            replace_existing=True,
        )

        # journal_daily: daily at 03:30
        self.scheduler.add_job(
            run_journal_daily,
            "cron",
            hour=3,
            minute=30,
            id="journal_daily",
            name="Daily Journal Processing",
            replace_existing=True,
        )

        # action: every hour at :00
        self.scheduler.add_job(
            run_action,
            "cron",
            minute=0,
            id="action",
            name="Action Processing (TODOs)",
            replace_existing=True,
        )

        self.scheduler.start()
        logger.info("Scheduler started with %d jobs", len(self.scheduler.get_jobs()))

    def shutdown(self):
        """Gracefully shut down the scheduler."""
        self.scheduler.shutdown(wait=True)
        logger.info("Scheduler shut down")

    def get_jobs(self) -> list:
        """Get all scheduled jobs with their next run times."""
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger),
            })
        return jobs

    def trigger_job(self, job_id: str) -> bool:
        """Manually trigger a job immediately."""
        job = self.scheduler.get_job(job_id)
        if not job:
            return False

        # Run immediately in the thread pool
        self.scheduler.modify_job(job_id, next_run_time=None)
        job.func()
        return True

    def pause_job(self, job_id: str) -> bool:
        job = self.scheduler.get_job(job_id)
        if not job:
            return False
        self.scheduler.pause_job(job_id)
        return True

    def resume_job(self, job_id: str) -> bool:
        job = self.scheduler.get_job(job_id)
        if not job:
            return False
        self.scheduler.resume_job(job_id)
        return True
