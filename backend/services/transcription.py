"""
Transcription using faster-whisper (CTranslate2 backend — no PyTorch/numba needed).
Models are downloaded from HuggingFace on first use (~74 MB for "base").
"""
import logging
from pathlib import Path
from typing import List, Optional

from backend.models.schemas import TranscriptSegment

logger = logging.getLogger(__name__)

_model = None
_loaded_model_name: Optional[str] = None


def get_model(model_name: str = "base"):
    global _model, _loaded_model_name
    if _model is not None and _loaded_model_name == model_name:
        return _model

    from faster_whisper import WhisperModel  # type: ignore

    logger.info("Loading faster-whisper model: %s (CPU, int8)", model_name)
    _model = WhisperModel(model_name, device="cpu", compute_type="int8")
    _loaded_model_name = model_name
    logger.info("faster-whisper model '%s' ready.", model_name)
    return _model


def transcribe_audio(
    audio_path: Path,
    model_name: str = "base",
) -> List[TranscriptSegment]:
    """
    Transcribe an audio file and return a list of TranscriptSegments.

    faster-whisper returns a generator of Segment objects; we materialise
    them here so callers get a plain list.
    """
    model = get_model(model_name)

    logger.info("Transcribing: %s", audio_path)
    segments_gen, info = model.transcribe(
        str(audio_path),
        beam_size=5,
        language=None,       # auto-detect
        vad_filter=True,     # skip silent regions automatically
        vad_parameters={"min_silence_duration_ms": 500},
    )

    results: List[TranscriptSegment] = []
    for seg in segments_gen:
        text = seg.text.strip()
        if not text:
            continue
        results.append(
            TranscriptSegment(
                start_time=round(float(seg.start), 2),
                end_time=round(float(seg.end), 2),
                text=text,
                speaker=None,
                confidence=round(float(seg.avg_logprob), 3) if seg.avg_logprob is not None else None,
            )
        )

    logger.info(
        "Transcription complete: %d segments (detected language: %s, prob: %.2f)",
        len(results),
        info.language,
        info.language_probability,
    )
    return results
