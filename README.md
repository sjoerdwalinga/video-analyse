# Video Analyse

A local web application for analyzing user research interview videos. It transcribes speech with Whisper, detects facial expressions with MediaPipe, and analyzes speech prosody (intonation, pace, energy) with librosa — all running on your machine, with no data leaving your computer.

## What it does

Upload a video interview recording and the app will: (1) produce a searchable, timestamped transcript; (2) detect observable facial expressions (smile, frown, raised eyebrows, looking away, etc.) at regular intervals; and (3) classify speech intonation windows (emphatic, hesitant, monotone, calm, energetic, etc.). Results are synchronized with a video player so you can click any event to jump to that moment. Exports to JSON, CSV, and Markdown.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10+ · FastAPI · uvicorn |
| Transcription | openai-whisper (local, "base" model by default) |
| Facial analysis | MediaPipe Face Mesh (OpenCV Haar cascade fallback) |
| Prosody analysis | librosa · pyin pitch detection |
| Audio extraction | ffmpeg |
| Frontend | React 18 · TypeScript · Vite |

## Prerequisites

- **Python 3.10+** — `python3 --version`
- **Node.js 18+** — `node --version`
- **ffmpeg** (includes ffprobe) — [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)
  - macOS: `brew install ffmpeg`
  - Ubuntu/Debian: `sudo apt install ffmpeg`
  - Windows: download from ffmpeg.org and add to PATH

## Quick start

```bash
# Clone / download the project, then:
chmod +x start.sh
./start.sh
# Open http://localhost:5173
```

## Full installation steps

1. **Install ffmpeg** (see Prerequisites above).

2. **Create Python virtual environment and install dependencies:**
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate          # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   ```

## Running the application

### Option A — start script (recommended)

```bash
./start.sh        # macOS/Linux
start.bat         # Windows
```

The script creates the venv and installs dependencies on first run, then starts both servers.

### Option B — manual

Terminal 1 (from project root):
```bash
source backend/.venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Terminal 2:
```bash
cd frontend
npm run dev
```

## How to use

1. Open [http://localhost:5173](http://localhost:5173) in your browser.
2. Drag and drop a video file (MP4, MOV, AVI, MKV, WebM, M4V — up to 2 GB) onto the upload area, or click to browse.
3. Click **Start Analysis**. The upload progress bar shows file transfer progress.
4. The processing screen shows four steps: transcription → facial analysis → prosody analysis. This takes several minutes for long videos.
5. When analysis is complete, the analysis view opens automatically with:
   - **Video player** (left) — use native controls; click any transcript line or event to seek.
   - **Transcript** (right) — searchable, auto-highlights the current segment.
   - **Facial Expressions** tab (bottom-left) — timestamped expression events with filter pills.
   - **Intonation** tab (bottom-left) — speech prosody events; click the arrow to expand features.
6. Use the **Export** dropdown (top-right) to download results as JSON, CSV, or Markdown.

## Configuration

Set environment variables before starting the backend:

| Variable | Default | Description |
|---|---|---|
| `WHISPER_MODEL` | `base` | Whisper model size: `tiny`, `base`, `small`, `medium`, `large` |
| `FRAME_SAMPLE_INTERVAL` | `5` | Seconds between sampled frames for facial analysis |
| `PROSODY_WINDOW_SIZE` | `2.0` | Duration in seconds of each prosody analysis window |

Example (macOS/Linux):
```bash
WHISPER_MODEL=small ./start.sh
```

## Known limitations

- **Whisper accuracy:** The `base` model trades speed for accuracy. Use `WHISPER_MODEL=small` or `WHISPER_MODEL=medium` for better transcription quality, at the cost of more processing time.
- **Facial analysis is approximate:** The geometric analysis requires a clear, frontal view of the participant's face. Poor lighting, profile angles, or partial occlusion will reduce accuracy. This is an observational aid, not a psychological assessment.
- **Processing time:** A 60-minute video takes approximately 15–20 minutes on a modern laptop (transcription: ~10 min, facial: ~3 min, prosody: ~2 min with `base` model).
- **Memory:** Large files (>1 GB) may require ~4 GB RAM. Whisper `large` model requires ~10 GB RAM.
- **No cancellation:** Clicking "Cancel" on the processing screen navigates away but does not stop the background analysis. The job continues running and its result is saved to disk.
- **Jobs lost on restart:** In-memory job state is lost when the backend restarts. Completed results saved to `storage/results/` are preserved and will be found if you know the job ID.
- **No DeepFace by default:** For deeper emotion analysis, install DeepFace separately: `pip install deepface tf-keras`. The app does not currently call DeepFace but the architecture supports adding it.
- **Single user:** The application is designed for local single-user use. There is no authentication.

## Disclaimer

The facial expression and intonation analyses produced by this tool are generated by automated algorithms processing observable geometric and acoustic features. They are intended as supplementary observational cues for user research purposes only and do not constitute psychological assessments, diagnoses, or definitive characterizations of participants' mental states, emotions, or intentions. Researchers should exercise professional judgment when interpreting results.

## Troubleshooting

**`ffmpeg: command not found`**
Install ffmpeg and ensure it is on your PATH. Test with `ffmpeg -version`.

**MediaPipe install fails**
On Apple Silicon Macs, try: `pip install mediapipe --no-binary mediapipe`. Alternatively, the app automatically falls back to OpenCV Haar cascades if MediaPipe is unavailable.

**Whisper is very slow**
Use `WHISPER_MODEL=tiny` for fastest (lower quality) results. CPU-only machines will be slow; Whisper runs faster on machines with an NVIDIA GPU (CUDA).

**`ModuleNotFoundError: No module named 'backend'`**
Run uvicorn from the project root, not from the `backend/` subdirectory: `uvicorn backend.main:app ...`

**Port already in use**
Change the backend port: `uvicorn backend.main:app --port 8001` and update the Vite proxy in `frontend/vite.config.ts` to match.

**Video does not play in browser**
Ensure the file format is supported by your browser. MP4 (H.264) has the widest support. For MKV or other containers, consider transcoding to MP4 first.
