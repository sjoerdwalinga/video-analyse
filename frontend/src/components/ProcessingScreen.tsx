import React, { useEffect } from 'react'
import { CheckCircle, Circle, Loader, AlertCircle, ArrowLeft } from 'lucide-react'
import { useJob } from '../hooks/useJob'
import { AnalysisResults, JobStatus } from '../types'

interface ProcessingScreenProps {
  jobId: string
  onComplete: (results: AnalysisResults) => void
  onError: (error: string) => void
  onCancel: () => void
}

interface Step {
  id: string
  label: string
  statuses: JobStatus[]
}

const STEPS: Step[] = [
  { id: 'upload', label: 'Upload', statuses: ['uploading'] },
  { id: 'transcription', label: 'Transcription', statuses: ['processing_transcription'] },
  { id: 'facial', label: 'Facial Analysis', statuses: ['processing_facial'] },
  { id: 'prosody', label: 'Prosody Analysis', statuses: ['processing_prosody'] },
  { id: 'complete', label: 'Complete', statuses: ['completed'] },
]

const STATUS_ORDER: JobStatus[] = [
  'pending',
  'uploading',
  'processing_transcription',
  'processing_facial',
  'processing_prosody',
  'completed',
]

function getStepStatus(step: Step, currentStatus: JobStatus): 'pending' | 'active' | 'done' {
  if (currentStatus === 'failed') return 'pending'
  if (step.statuses.includes(currentStatus)) return 'active'

  const currentIndex = STATUS_ORDER.indexOf(currentStatus)
  const stepMinIndex = Math.min(...step.statuses.map((s) => STATUS_ORDER.indexOf(s)))
  if (currentIndex > stepMinIndex) return 'done'
  return 'pending'
}

export function ProcessingScreen({ jobId, onComplete, onError, onCancel }: ProcessingScreenProps) {
  const { job, error } = useJob(jobId)

  useEffect(() => {
    if (!job) return
    if (job.status === 'completed' && job.results) {
      onComplete(job.results)
    } else if (job.status === 'failed') {
      onError(job.error ?? 'Analysis failed for an unknown reason')
    }
  }, [job, onComplete, onError])

  const progress = job?.progress ?? 0
  const currentStep = job?.current_step ?? 'Initializing...'
  const status = job?.status ?? 'pending'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '4px', textAlign: 'center' }}>
          Analyzing Video
        </h1>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '32px', fontSize: '13px' }}>
          Job ID: {jobId}
        </p>

        {/* Progress bar */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{currentStep}</span>
            <span style={{ color: 'var(--accent)', fontWeight: '600' }}>{progress}%</span>
          </div>
          <div style={{
            height: '8px',
            background: 'var(--bg-secondary)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: status === 'failed'
                ? 'var(--error)'
                : `linear-gradient(90deg, var(--accent), var(--accent-hover))`,
              borderRadius: '4px',
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* Steps timeline */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {STEPS.map((step, idx) => {
              const stepStatus = getStepStatus(step, status)
              return (
                <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Icon */}
                  <div style={{ flexShrink: 0 }}>
                    {stepStatus === 'done' ? (
                      <CheckCircle size={20} color="var(--success)" />
                    ) : stepStatus === 'active' ? (
                      <Loader size={20} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Circle size={20} color="var(--text-muted)" />
                    )}
                  </div>
                  {/* Label */}
                  <span style={{
                    fontSize: '14px',
                    fontWeight: stepStatus === 'active' ? '600' : '400',
                    color: stepStatus === 'done'
                      ? 'var(--success)'
                      : stepStatus === 'active'
                        ? 'var(--text-primary)'
                        : 'var(--text-muted)',
                  }}>
                    {step.label}
                  </span>
                  {/* Connector line */}
                  {idx < STEPS.length - 1 && (
                    <div style={{ display: 'none' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Info note */}
        <div style={{
          padding: '10px 14px',
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '6px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          marginBottom: '20px',
        }}>
          This may take several minutes for long videos. Whisper model: <strong>base</strong>.
          Set <code style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: '3px' }}>WHISPER_MODEL=small</code> for better accuracy.
        </div>

        {/* Error state */}
        {(error || status === 'failed') && (
          <div style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            marginBottom: '16px',
            color: 'var(--error)',
            fontSize: '13px',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <strong>Analysis failed.</strong>{' '}
              {job?.error ?? error ?? 'Unknown error'}
            </div>
          </div>
        )}

        {/* Cancel button */}
        <button
          className="btn btn-ghost"
          onClick={onCancel}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <ArrowLeft size={14} />
          {status === 'failed' ? 'Back to Upload' : 'Cancel (back to upload)'}
        </button>
        {status !== 'failed' && (
          <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Note: cancelling here does not stop background processing on the server.
          </p>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
