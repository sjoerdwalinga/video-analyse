import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent


class Settings:
    storage_dir = BASE_DIR / "storage"
    uploads_dir = storage_dir / "uploads"
    results_dir = storage_dir / "results"
    whisper_model = os.getenv("WHISPER_MODEL", "base")
    frame_sample_interval = int(os.getenv("FRAME_SAMPLE_INTERVAL", "5"))  # seconds
    prosody_window_size = float(os.getenv("PROSODY_WINDOW_SIZE", "2.0"))  # seconds
    max_file_size_bytes = 2 * 1024 * 1024 * 1024  # 2GB


settings = Settings()
