import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def extract_audio(video_path: Path, audio_path: Path) -> bool:
    """Extract audio from video file to WAV format using ffmpeg."""
    try:
        cmd = [
            "ffmpeg",
            "-i", str(video_path),
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            "-y",
            str(audio_path),
        ]
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=600,
        )
        if result.returncode != 0:
            logger.error(
                "ffmpeg failed (code %d): %s",
                result.returncode,
                result.stderr.decode("utf-8", errors="replace"),
            )
            return False
        return True
    except FileNotFoundError:
        logger.error("ffmpeg not found. Please install ffmpeg and ensure it is on PATH.")
        return False
    except subprocess.TimeoutExpired:
        logger.error("ffmpeg timed out while extracting audio from %s", video_path)
        return False
    except Exception as exc:
        logger.error("Unexpected error extracting audio: %s", exc)
        return False


def get_video_duration(video_path: Path) -> float:
    """Return video duration in seconds using ffprobe."""
    try:
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ]
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
        )
        if result.returncode != 0:
            logger.warning("ffprobe failed for %s", video_path)
            return 0.0
        output = result.stdout.decode("utf-8", errors="replace").strip()
        return float(output)
    except FileNotFoundError:
        logger.error("ffprobe not found. Please install ffmpeg (includes ffprobe).")
        return 0.0
    except (ValueError, subprocess.TimeoutExpired) as exc:
        logger.error("Error getting video duration: %s", exc)
        return 0.0
    except Exception as exc:
        logger.error("Unexpected error getting video duration: %s", exc)
        return 0.0
