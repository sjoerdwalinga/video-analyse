import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.routers import export, jobs, upload

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure storage directories exist
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    settings.results_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Storage directories ready:")
    logger.info("  Uploads: %s", settings.uploads_dir)
    logger.info("  Results: %s", settings.results_dir)
    logger.info("Backend started. Whisper model: %s", settings.whisper_model)
    yield
    # Shutdown
    logger.info("Backend shutting down.")


app = FastAPI(
    title="Video Analyse API",
    description="User Research Interview Video Analysis",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(export.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "whisper_model": settings.whisper_model}
