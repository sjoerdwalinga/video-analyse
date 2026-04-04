import logging
import math
from pathlib import Path
from typing import Callable, List, Optional

from backend.models.schemas import FacialExpressionEvent

logger = logging.getLogger(__name__)

# MediaPipe face mesh landmark indices
NOSE_TIP = 4
CHIN = 152
MOUTH_LEFT = 61
MOUTH_RIGHT = 291
MOUTH_TOP = 13
MOUTH_BOTTOM = 14
LEFT_EYE_TOP = 159
LEFT_EYE_BOTTOM = 145
RIGHT_EYE_TOP = 386
RIGHT_EYE_BOTTOM = 374
LEFT_BROW_CENTER = 66
RIGHT_BROW_CENTER = 296
FACE_TOP = 10


def _dist(a, b) -> float:
    return math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)


def _classify_mediapipe(landmarks, frame_width: int, face_bbox_width: float) -> tuple[str, float, Optional[str]]:
    """Classify facial expression from MediaPipe face mesh landmarks."""
    lm = landmarks.landmark

    face_height = _dist(lm[FACE_TOP], lm[CHIN])
    if face_height < 1e-6:
        return "neutral", 0.5, None

    # Check if face is very small in frame (looking away / far)
    face_width_ratio = face_bbox_width / frame_width if frame_width > 0 else 1.0
    if face_width_ratio < 0.05:
        return "looking away", 0.80, "Face is very small in frame"

    # Mouth metrics
    mouth_corner_mid_y = (lm[MOUTH_LEFT].y + lm[MOUTH_RIGHT].y) / 2.0
    mouth_center_y = (lm[MOUTH_TOP].y + lm[MOUTH_BOTTOM].y) / 2.0
    # Positive means corners above center (smile), negative means below (frown)
    corner_vs_center = mouth_center_y - mouth_corner_mid_y
    corner_vs_center_norm = corner_vs_center / face_height

    mouth_open_ratio = _dist(lm[MOUTH_TOP], lm[MOUTH_BOTTOM]) / face_height

    # Brow metrics
    left_brow_eye_dist = lm[LEFT_EYE_TOP].y - lm[LEFT_BROW_CENTER].y
    right_brow_eye_dist = lm[RIGHT_EYE_TOP].y - lm[RIGHT_BROW_CENTER].y
    brow_height = (left_brow_eye_dist + right_brow_eye_dist) / 2.0 / face_height

    # Eye openness
    left_eye_open = _dist(lm[LEFT_EYE_TOP], lm[LEFT_EYE_BOTTOM]) / face_height
    right_eye_open = _dist(lm[RIGHT_EYE_TOP], lm[RIGHT_EYE_BOTTOM]) / face_height
    eye_open = (left_eye_open + right_eye_open) / 2.0

    # Classification logic
    if corner_vs_center_norm > 0.015:
        confidence = min(0.95, 0.65 + corner_vs_center_norm * 10)
        return "smile", confidence, None

    if corner_vs_center_norm < -0.015:
        confidence = min(0.90, 0.60 + abs(corner_vs_center_norm) * 8)
        return "frown", confidence, None

    if brow_height > 0.045 and eye_open > 0.035 and mouth_open_ratio > 0.06:
        return "surprised", 0.78, None

    if brow_height > 0.045:
        return "raised eyebrows", 0.72, None

    if brow_height < 0.020:
        return "thoughtful", 0.65, "Brows drawn together"

    return "neutral", 0.55, None


def _analyze_with_mediapipe(
    video_path: Path,
    sample_interval: int,
    progress_callback: Optional[Callable[[float], None]],
) -> List[FacialExpressionEvent]:
    import cv2  # type: ignore
    import mediapipe as mp  # type: ignore

    mp_face_mesh = mp.solutions.face_mesh
    mp_face_detection = mp.solutions.face_detection

    events: List[FacialExpressionEvent] = []

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        logger.error("Could not open video: %s", video_path)
        return events

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_step = max(1, int(fps * sample_interval))

    face_mesh = mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=False,
        min_detection_confidence=0.5,
    )
    face_detection = mp_face_detection.FaceDetection(
        model_selection=0,
        min_detection_confidence=0.5,
    )

    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_idx = 0
    processed = 0

    while True:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            break

        timestamp = frame_idx / fps

        # Progress callback
        if progress_callback is not None and total_frames > 0:
            progress_callback(frame_idx / total_frames)

        # Convert to RGB for MediaPipe
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # First check if face is present
        det_result = face_detection.process(rgb)
        face_bbox_width = 0.0
        if det_result.detections:
            detection = det_result.detections[0]
            bbox = detection.location_data.relative_bounding_box
            face_bbox_width = bbox.width * frame_width

        # Run face mesh
        mesh_result = face_mesh.process(rgb)
        if mesh_result.multi_face_landmarks:
            lm = mesh_result.multi_face_landmarks[0]
            label, confidence, notes = _classify_mediapipe(lm, frame_width, face_bbox_width)
            if label != "neutral" or confidence >= 0.75:
                events.append(
                    FacialExpressionEvent(
                        timestamp=round(timestamp, 2),
                        label=label,
                        confidence=round(confidence, 3),
                        notes=notes,
                    )
                )
        else:
            # No face landmarks — if we had a bbox detection, use it; otherwise looking away
            if det_result.detections:
                # Face detected but mesh failed
                pass
            else:
                events.append(
                    FacialExpressionEvent(
                        timestamp=round(timestamp, 2),
                        label="looking away",
                        confidence=0.70,
                        notes="No face detected in frame",
                    )
                )

        processed += 1
        frame_idx += frame_step

    cap.release()
    face_mesh.close()
    face_detection.close()

    if progress_callback is not None:
        progress_callback(1.0)

    return events


def _analyze_with_opencv_fallback(
    video_path: Path,
    sample_interval: int,
    progress_callback: Optional[Callable[[float], None]],
) -> List[FacialExpressionEvent]:
    """Fallback facial analysis using OpenCV Haar cascade."""
    import cv2  # type: ignore

    events: List[FacialExpressionEvent] = []

    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        logger.error("Could not open video: %s", video_path)
        return events

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_step = max(1, int(fps * sample_interval))
    frame_idx = 0

    while True:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            break

        timestamp = frame_idx / fps

        if progress_callback is not None and total_frames > 0:
            progress_callback(frame_idx / total_frames)

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))

        if len(faces) == 0:
            events.append(
                FacialExpressionEvent(
                    timestamp=round(timestamp, 2),
                    label="looking away",
                    confidence=0.65,
                    notes="No face detected (OpenCV fallback)",
                )
            )

        frame_idx += frame_step

    cap.release()

    if progress_callback is not None:
        progress_callback(1.0)

    return events


def analyze_facial_expressions(
    video_path: Path,
    sample_interval: int = 5,
    progress_callback: Optional[Callable[[float], None]] = None,
) -> List[FacialExpressionEvent]:
    """Analyze facial expressions in a video file.

    Uses MediaPipe Face Mesh as primary method, falls back to OpenCV Haar cascade.
    """
    try:
        import mediapipe  # noqa: F401
        logger.info("Using MediaPipe Face Mesh for facial analysis")
        return _analyze_with_mediapipe(video_path, sample_interval, progress_callback)
    except ImportError:
        logger.warning("MediaPipe not available, falling back to OpenCV Haar cascade")
    except Exception as exc:
        logger.warning("MediaPipe facial analysis failed: %s — trying OpenCV fallback", exc)

    try:
        return _analyze_with_opencv_fallback(video_path, sample_interval, progress_callback)
    except Exception as exc:
        logger.error("OpenCV facial analysis also failed: %s", exc)
        return []
