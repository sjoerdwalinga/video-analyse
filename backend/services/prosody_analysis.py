"""
Prosody / intonation analysis using scipy + numpy + soundfile.
No librosa / numba / llvmlite dependency required.
"""
import logging
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
import soundfile as sf

from backend.models.schemas import IntonationEvent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_prosody(
    audio_path: Path,
    window_size: float = 2.0,
    progress_callback: Optional[Callable[[float], None]] = None,
) -> List[IntonationEvent]:
    """
    Analyse prosodic features of an audio file.

    Parameters
    ----------
    audio_path:       Path to a WAV file (16 kHz mono recommended).
    window_size:      Analysis window length in seconds.
    progress_callback: Called with a float in [0, 1] as work progresses.

    Returns a list of IntonationEvent objects sorted by timestamp.
    """
    logger.info("Loading audio for prosody analysis: %s", audio_path)

    y, sr = sf.read(str(audio_path), dtype="float32", always_2d=False)
    if y.ndim > 1:
        y = y.mean(axis=1)

    duration = len(y) / sr
    logger.info("Audio duration: %.1fs at %d Hz", duration, sr)

    window_samples = int(window_size * sr)
    hop_samples = max(1, window_samples // 2)

    events: List[IntonationEvent] = []
    starts = list(range(0, max(1, len(y) - window_samples // 4), hop_samples))
    total = len(starts)

    for idx, start in enumerate(starts):
        end = min(start + window_samples, len(y))
        frame = y[start:end]
        if len(frame) < 64:
            break

        timestamp = start / sr
        avg_rms = float(np.sqrt(np.mean(frame ** 2)))
        avg_pitch, pitch_std, voiced_ratio = _estimate_pitch(frame, sr)

        features: Dict[str, Any] = {
            "avg_rms": round(avg_rms, 4),
            "avg_pitch_hz": round(avg_pitch, 1),
            "pitch_variation": round(pitch_std, 1),
            "voiced_ratio": round(voiced_ratio, 2),
        }

        label, confidence, notes = _classify_intonation(features, voiced_ratio)
        if label:
            events.append(
                IntonationEvent(
                    timestamp=round(timestamp, 2),
                    label=label,
                    features=features,
                    confidence=round(confidence, 3),
                    notes=notes,
                )
            )

        if progress_callback:
            progress_callback((idx + 1) / total)

    events = _merge_consecutive_events(events, max_gap=4.0)
    logger.info("Prosody analysis complete: %d events", len(events))
    return events


# ---------------------------------------------------------------------------
# Pitch estimation (autocorrelation / simplified YIN, no numba)
# ---------------------------------------------------------------------------

def _estimate_pitch(
    frame: np.ndarray,
    sr: int,
    f0_min: float = 50.0,
    f0_max: float = 500.0,
    voiced_threshold: float = 0.30,
) -> Tuple[float, float, float]:
    """
    Estimate the fundamental frequency (F0) of a short audio frame via
    normalized autocorrelation.

    Returns
    -------
    avg_pitch_hz : mean F0 over voiced sub-frames (0 if unvoiced)
    pitch_std    : std of F0 over voiced sub-frames
    voiced_ratio : fraction of sub-frames classified as voiced
    """
    min_lag = max(1, int(sr / f0_max))
    max_lag = min(len(frame) - 1, int(sr / f0_min))
    if min_lag >= max_lag:
        return 0.0, 0.0, 0.0

    # Split frame into ~50 ms sub-frames for temporal resolution
    sub_len = max(min_lag * 4, min(512, len(frame)))
    n_sub = max(1, len(frame) // sub_len)

    pitches: List[float] = []
    voiced = 0

    for j in range(n_sub):
        sub = frame[j * sub_len: (j + 1) * sub_len]
        if len(sub) < min_lag * 2:
            continue

        # Zero-pad to next power of two for fast FFT
        n_fft = int(2 ** np.ceil(np.log2(2 * len(sub))))
        F = np.fft.rfft(sub, n=n_fft)
        acf = np.fft.irfft(F * np.conj(F))[: len(sub)]

        norm = acf[0]
        if norm < 1e-10:
            continue
        acf /= norm

        search = acf[min_lag: max_lag + 1]
        if len(search) == 0:
            continue

        peak_offset = int(np.argmax(search))
        lag = peak_offset + min_lag
        peak_val = acf[lag]

        if peak_val >= voiced_threshold and lag > 0:
            pitches.append(sr / lag)
            voiced += 1

    if pitches:
        return float(np.mean(pitches)), float(np.std(pitches)), voiced / n_sub
    return 0.0, 0.0, 0.0


# ---------------------------------------------------------------------------
# Intonation classification
# ---------------------------------------------------------------------------

def _classify_intonation(
    features: Dict[str, Any],
    voiced_ratio: float,
) -> Tuple[Optional[str], float, str]:
    """
    Map prosodic feature values to an intonation label.

    Returns (label, confidence, notes).  Returns (None, 0, '') to skip.
    """
    avg_rms: float = features.get("avg_rms", 0.0)
    avg_pitch: float = features.get("avg_pitch_hz", 0.0)
    pitch_std: float = features.get("pitch_variation", 0.0)

    # ── Silence / pause ──────────────────────────────────────────────────────
    if voiced_ratio < 0.10 or avg_rms < 0.001:
        return "long pause", 0.85, "Low voiced activity detected"

    # ── Emphatic: high energy + high pitch variation ──────────────────────────
    if avg_rms > 0.05 and pitch_std > 30:
        return (
            "emphatic",
            0.75,
            f"High energy (RMS {avg_rms:.4f}) with pitch variation {pitch_std:.0f} Hz",
        )

    # ── Soft voice: low energy ────────────────────────────────────────────────
    if avg_rms < 0.010:
        return "soft voice", 0.70, f"Low vocal energy (RMS {avg_rms:.4f})"

    # ── Monotone: very low pitch variation while speaking ────────────────────
    if avg_pitch > 0 and pitch_std < 10 and voiced_ratio > 0.70:
        return "monotone", 0.72, f"Low pitch variation ({pitch_std:.0f} Hz)"

    # ── Hesitant: broken / interrupted speech pattern ────────────────────────
    if 0.10 <= voiced_ratio < 0.40:
        return (
            "hesitant",
            0.65,
            f"Interrupted speech (voiced fraction: {voiced_ratio:.0%})",
        )

    # ── Energetic: sustained loud speech with varied pitch ───────────────────
    if avg_rms > 0.04 and pitch_std > 20:
        return "energetic", 0.70, "High energy with varied pitch"

    # ── Increased intensity: loud but not particularly varied ─────────────────
    if avg_rms > 0.04:
        return "increased intensity", 0.70, f"Elevated vocal energy (RMS {avg_rms:.4f})"

    # ── Calm: moderate energy, stable pace ───────────────────────────────────
    if avg_rms > 0.015:
        return "calm", 0.60, "Steady pace and moderate energy"

    # ── Default: skip near-silent frames already caught above ────────────────
    return None, 0.0, ""


# ---------------------------------------------------------------------------
# Post-processing
# ---------------------------------------------------------------------------

def _merge_consecutive_events(
    events: List[IntonationEvent],
    max_gap: float = 4.0,
) -> List[IntonationEvent]:
    """
    Drop consecutive events with the same label that are within max_gap
    seconds of each other, keeping only the first occurrence.
    """
    if not events:
        return events

    merged = [events[0]]
    for evt in events[1:]:
        last = merged[-1]
        if evt.label == last.label and (evt.timestamp - last.timestamp) <= max_gap:
            continue
        merged.append(evt)

    return merged
