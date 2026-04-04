import io
import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse, StreamingResponse

from backend.models.schemas import AnalysisResults
from backend.services import storage

logger = logging.getLogger(__name__)

router = APIRouter()


def _format_time(seconds: float) -> str:
    """Format seconds as MM:SS.cc"""
    total_centiseconds = int(round(seconds * 100))
    cc = total_centiseconds % 100
    total_seconds = total_centiseconds // 100
    mm = total_seconds // 60
    ss = total_seconds % 60
    return f"{mm:02d}:{ss:02d}.{cc:02d}"


def _get_results(job_id: str) -> AnalysisResults:
    """Retrieve results from in-memory store or disk, raise 404 if not found."""
    job = storage.get_job(job_id)
    if job is not None and job.results is not None:
        return job.results

    results = storage.load_results(job_id)
    if results is not None:
        return results

    raise HTTPException(status_code=404, detail=f"Results for job '{job_id}' not found")


@router.get("/jobs/{job_id}/export/json")
async def export_json(job_id: str):
    """Export analysis results as JSON."""
    results = _get_results(job_id)
    json_bytes = results.model_dump_json(indent=2).encode("utf-8")

    return StreamingResponse(
        io.BytesIO(json_bytes),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="analysis_{job_id}.json"',
        },
    )


@router.get("/jobs/{job_id}/export/csv")
async def export_csv(job_id: str):
    """Export analysis results as CSV with three sections."""
    results = _get_results(job_id)

    lines = []

    # TRANSCRIPT section
    lines.append("TRANSCRIPT")
    lines.append("start_time,end_time,speaker,text,confidence")
    for seg in results.transcript:
        speaker = seg.speaker or ""
        text = seg.text.replace('"', '""')
        conf = f"{seg.confidence:.4f}" if seg.confidence is not None else ""
        lines.append(
            f'"{_format_time(seg.start_time)}","{_format_time(seg.end_time)}","{speaker}","{text}","{conf}"'
        )

    lines.append("")

    # FACIAL EXPRESSIONS section
    lines.append("FACIAL EXPRESSIONS")
    lines.append("timestamp,label,confidence,notes")
    for ev in results.facial_expressions:
        notes = (ev.notes or "").replace('"', '""')
        lines.append(
            f'"{_format_time(ev.timestamp)}","{ev.label}","{ev.confidence:.3f}","{notes}"'
        )

    lines.append("")

    # INTONATION EVENTS section
    lines.append("INTONATION EVENTS")
    lines.append("timestamp,label,confidence,avg_rms,avg_pitch_hz,pitch_variation,voiced_ratio,notes")
    for ev in results.intonation_events:
        notes = (ev.notes or "").replace('"', '""')
        f = ev.features
        lines.append(
            f'"{_format_time(ev.timestamp)}","{ev.label}","{ev.confidence:.3f}",'
            f'"{f.get("avg_rms", "")}","{f.get("avg_pitch_hz", "")}","{f.get("pitch_variation", "")}",'
            f'"{f.get("voiced_ratio", "")}","{notes}"'
        )

    csv_content = "\n".join(lines) + "\n"
    csv_bytes = csv_content.encode("utf-8-sig")  # BOM for Excel compatibility

    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="analysis_{job_id}.csv"',
        },
    )


@router.get("/jobs/{job_id}/export/txt")
async def export_txt(job_id: str):
    """Export analysis results as formatted markdown/plain text."""
    results = _get_results(job_id)

    lines = []
    lines.append(f"# Analysis Results: {results.video_filename}")
    lines.append("")

    if results.duration:
        m = int(results.duration) // 60
        s = int(results.duration) % 60
        lines.append(f"**Duration:** {m}m {s:02d}s")

    lines.append(f"**Job ID:** {results.job_id}")
    lines.append("")

    # Transcript
    lines.append("## Transcript")
    lines.append("")
    if results.transcript:
        for seg in results.transcript:
            speaker_prefix = f"[{seg.speaker}] " if seg.speaker else ""
            lines.append(f"**[{_format_time(seg.start_time)} – {_format_time(seg.end_time)}]** {speaker_prefix}{seg.text}")
            lines.append("")
    else:
        lines.append("*No transcript available.*")
        lines.append("")

    # Facial expressions
    lines.append("## Facial Expressions")
    lines.append("")
    lines.append("> Observable facial expressions detected by automated analysis — not psychological diagnoses.")
    lines.append("")
    if results.facial_expressions:
        for ev in results.facial_expressions:
            note_str = f" — {ev.notes}" if ev.notes else ""
            lines.append(f"- **[{_format_time(ev.timestamp)}]** {ev.label} (confidence: {ev.confidence:.0%}){note_str}")
    else:
        lines.append("*No facial expression events detected.*")
    lines.append("")

    # Intonation
    lines.append("## Intonation / Prosody")
    lines.append("")
    lines.append("> Observable speech characteristics — not conclusions about internal emotional state.")
    lines.append("")
    if results.intonation_events:
        for ev in results.intonation_events:
            note_str = f" — {ev.notes}" if ev.notes else ""
            f = ev.features
            pitch_str = f", pitch: {f.get('avg_pitch_hz', 0):.0f} Hz" if f.get("avg_pitch_hz") else ""
            lines.append(
                f"- **[{_format_time(ev.timestamp)}]** {ev.label} "
                f"(confidence: {ev.confidence:.0%}{pitch_str}){note_str}"
            )
    else:
        lines.append("*No intonation events detected.*")
    lines.append("")

    # Disclaimer
    lines.append("---")
    lines.append("")
    lines.append("## Disclaimer")
    lines.append("")
    lines.append(
        "This analysis is generated by automated algorithms and is intended as an observational aid "
        "for user research purposes only. Facial expression detection is geometric and approximate; "
        "it requires a clear frontal view of the participant's face. Prosody analysis reflects "
        "acoustic features of the speech signal. Neither analysis constitutes a psychological "
        "assessment, diagnosis, or definitive characterization of the participant's mental state, "
        "emotions, or intentions. Researchers should exercise professional judgment when interpreting "
        "these results and should treat them as supplementary cues rather than conclusions."
    )
    lines.append("")

    txt_content = "\n".join(lines)

    return PlainTextResponse(
        content=txt_content,
        headers={
            "Content-Disposition": f'attachment; filename="analysis_{job_id}.txt"',
        },
    )
