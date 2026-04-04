import json
import uuid
from pathlib import Path
from typing import Optional

from backend.config import settings
from backend.models.schemas import AnalysisResults, JobInfo, JobStatus

_jobs: dict[str, JobInfo] = {}


def create_job(video_filename: str) -> str:
    job_id = str(uuid.uuid4())
    job = JobInfo(
        job_id=job_id,
        status=JobStatus.pending,
        progress=0,
        current_step="Job created",
    )
    _jobs[job_id] = job
    return job_id


def get_job(job_id: str) -> Optional[JobInfo]:
    return _jobs.get(job_id)


def update_job(job_id: str, **kwargs) -> None:
    job = _jobs.get(job_id)
    if job is None:
        return
    for key, value in kwargs.items():
        if hasattr(job, key):
            setattr(job, key, value)


def save_results(job_id: str, results: AnalysisResults) -> None:
    settings.results_dir.mkdir(parents=True, exist_ok=True)
    result_path = settings.results_dir / f"{job_id}.json"
    result_path.write_text(results.model_dump_json(indent=2), encoding="utf-8")


def load_results(job_id: str) -> Optional[AnalysisResults]:
    result_path = settings.results_dir / f"{job_id}.json"
    if not result_path.exists():
        return None
    try:
        data = json.loads(result_path.read_text(encoding="utf-8"))
        return AnalysisResults(**data)
    except Exception:
        return None
