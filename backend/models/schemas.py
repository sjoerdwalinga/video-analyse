from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class JobStatus(str, Enum):
    pending = "pending"
    uploading = "uploading"
    processing_transcription = "processing_transcription"
    processing_facial = "processing_facial"
    processing_prosody = "processing_prosody"
    completed = "completed"
    failed = "failed"


class TranscriptSegment(BaseModel):
    start_time: float
    end_time: float
    text: str
    speaker: Optional[str] = None
    confidence: Optional[float] = None


class FacialExpressionEvent(BaseModel):
    timestamp: float
    label: str
    confidence: float
    notes: Optional[str] = None


class IntonationEvent(BaseModel):
    timestamp: float
    label: str
    features: Dict[str, Any]
    confidence: float
    notes: Optional[str] = None


class AnalysisResults(BaseModel):
    job_id: str
    video_filename: str
    duration: Optional[float] = None
    transcript: List[TranscriptSegment] = []
    facial_expressions: List[FacialExpressionEvent] = []
    intonation_events: List[IntonationEvent] = []


class JobInfo(BaseModel):
    job_id: str
    status: JobStatus
    progress: int = 0
    current_step: str = ""
    error: Optional[str] = None
    results: Optional[AnalysisResults] = None
