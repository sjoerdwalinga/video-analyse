import logging
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from backend.config import settings
from backend.models.schemas import AnalysisResults, JobStatus
from backend.services import facial_analysis, prosody_analysis, storage, transcription
from backend.utils.video import extract_audio, get_video_duration

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}


@router.post("/upload")
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """Upload a video file and start analysis in the background."""
    # Validate extension
    suffix = Path(file.filename or "video.mp4").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Create job
    job_id = storage.create_job(file.filename or "video")
    storage.update_job(job_id, status=JobStatus.uploading, progress=1, current_step="Uploading file...")

    # Save file in 1MB chunks
    upload_path = settings.uploads_dir / f"{job_id}{suffix}"
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)

    try:
        with upload_path.open("wb") as f:
            total_bytes = 0
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
                total_bytes += len(chunk)
    except Exception as exc:
        logger.error("Failed to save uploaded file for job %s: %s", job_id, exc)
        storage.update_job(
            job_id,
            status=JobStatus.failed,
            error=f"Failed to save file: {exc}",
        )
        raise HTTPException(status_code=500, detail="Failed to save uploaded file")

    storage.update_job(
        job_id,
        status=JobStatus.pending,
        progress=5,
        current_step="Upload complete. Queuing analysis...",
    )

    background_tasks.add_task(process_video, job_id, upload_path, file.filename or "video")

    return {"job_id": job_id}


def process_video(job_id: str, video_path: Path, original_filename: str) -> None:
    """Process a video file: extract audio, transcribe, analyze facial expressions and prosody.

    This is a sync function — FastAPI runs it in a thread pool via BackgroundTasks.
    """
    audio_path: Path | None = None
    try:
        # Step 1: Get duration
        storage.update_job(
            job_id,
            status=JobStatus.processing_transcription,
            progress=5,
            current_step="Extracting audio...",
        )
        duration = get_video_duration(video_path)

        # Step 2: Extract audio
        audio_path = video_path.with_suffix(".wav")
        success = extract_audio(video_path, audio_path)
        if not success:
            raise RuntimeError("ffmpeg audio extraction failed. Ensure ffmpeg is installed.")

        storage.update_job(job_id, progress=15, current_step="Audio extracted. Starting transcription...")

        # Step 3: Transcribe
        storage.update_job(
            job_id,
            status=JobStatus.processing_transcription,
            progress=15,
            current_step="Transcribing audio with Whisper...",
        )
        transcript_segments = transcription.transcribe_audio(audio_path, settings.whisper_model)
        storage.update_job(job_id, progress=45, current_step="Transcription complete.")

        # Step 4: Facial analysis
        storage.update_job(
            job_id,
            status=JobStatus.processing_facial,
            progress=50,
            current_step="Analyzing facial expressions...",
        )

        def facial_progress(frac: float) -> None:
            p = 50 + int(frac * 20)
            storage.update_job(job_id, progress=p, current_step=f"Facial analysis... {int(frac*100)}%")

        facial_events = facial_analysis.analyze_facial_expressions(
            video_path,
            sample_interval=settings.frame_sample_interval,
            progress_callback=facial_progress,
        )
        storage.update_job(job_id, progress=70, current_step="Facial analysis complete.")

        # Step 5: Prosody analysis
        storage.update_job(
            job_id,
            status=JobStatus.processing_prosody,
            progress=75,
            current_step="Analyzing intonation and prosody...",
        )

        def prosody_progress(frac: float) -> None:
            p = 75 + int(frac * 20)
            storage.update_job(job_id, progress=p, current_step=f"Prosody analysis... {int(frac*100)}%")

        intonation_events = prosody_analysis.analyze_prosody(
            audio_path,
            window_size=settings.prosody_window_size,
            progress_callback=prosody_progress,
        )
        storage.update_job(job_id, progress=95, current_step="Prosody analysis complete. Saving results...")

        # Step 6: Save results
        results = AnalysisResults(
            job_id=job_id,
            video_filename=original_filename,
            duration=duration if duration > 0 else None,
            transcript=transcript_segments,
            facial_expressions=facial_events,
            intonation_events=intonation_events,
        )
        storage.save_results(job_id, results)
        storage.update_job(
            job_id,
            status=JobStatus.completed,
            progress=100,
            current_step="Analysis complete",
            results=results,
        )
        logger.info("Job %s completed successfully.", job_id)

    except Exception as exc:
        logger.exception("Job %s failed: %s", job_id, exc)
        storage.update_job(
            job_id,
            status=JobStatus.failed,
            error=str(exc),
            current_step="Analysis failed",
        )
    finally:
        # Clean up temporary audio file
        if audio_path is not None and audio_path.exists():
            try:
                audio_path.unlink()
            except Exception as cleanup_exc:
                logger.warning("Could not delete temp audio %s: %s", audio_path, cleanup_exc)


@router.get("/videos/{job_id}")
async def stream_video(job_id: str):
    """Stream a video file by job ID, supporting HTTP range requests."""
    # Find the video file by scanning uploads_dir for {job_id}.*
    matches = list(settings.uploads_dir.glob(f"{job_id}.*"))
    # Filter out .wav temp files
    video_matches = [p for p in matches if p.suffix.lower() in ALLOWED_EXTENSIONS]

    if not video_matches:
        raise HTTPException(status_code=404, detail=f"Video not found for job '{job_id}'")

    video_path = video_matches[0]

    # Determine media type
    media_types = {
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".mkv": "video/x-matroska",
        ".webm": "video/webm",
        ".m4v": "video/x-m4v",
    }
    media_type = media_types.get(video_path.suffix.lower(), "video/mp4")

    return FileResponse(
        path=str(video_path),
        media_type=media_type,
        filename=video_path.name,
    )
