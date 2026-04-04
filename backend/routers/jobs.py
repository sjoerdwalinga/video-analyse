import logging

from fastapi import APIRouter, HTTPException

from backend.models.schemas import JobInfo, JobStatus
from backend.services import storage

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/jobs/{job_id}", response_model=JobInfo)
async def get_job_status(job_id: str):
    """Get the current status and results of an analysis job."""
    job = storage.get_job(job_id)
    if job is not None:
        return job

    # Try loading from disk (handles app restarts)
    results = storage.load_results(job_id)
    if results is not None:
        return JobInfo(
            job_id=job_id,
            status=JobStatus.completed,
            progress=100,
            current_step="Analysis complete",
            results=results,
        )

    raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
