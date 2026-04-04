export type JobStatus =
  | 'pending'
  | 'uploading'
  | 'processing_transcription'
  | 'processing_facial'
  | 'processing_prosody'
  | 'completed'
  | 'failed'

export interface TranscriptSegment {
  start_time: number
  end_time: number
  text: string
  speaker: string | null
  confidence: number | null
}

export interface FacialExpressionEvent {
  timestamp: number
  label: string
  confidence: number
  notes: string | null
}

export interface IntonationEvent {
  timestamp: number
  label: string
  features: Record<string, number>
  confidence: number
  notes: string | null
}

export interface AnalysisResults {
  job_id: string
  video_filename: string
  duration: number | null
  transcript: TranscriptSegment[]
  facial_expressions: FacialExpressionEvent[]
  intonation_events: IntonationEvent[]
}

export interface JobInfo {
  job_id: string
  status: JobStatus
  progress: number
  current_step: string
  error: string | null
  results: AnalysisResults | null
}
