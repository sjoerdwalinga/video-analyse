import React, { useCallback, useRef, useState } from 'react'
import { Upload, Film, AlertCircle, CheckCircle } from 'lucide-react'

interface UploadScreenProps {
  onUploadStart: (jobId: string) => void
}

const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v']
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024 // 2GB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function UploadScreen({ onUploadStart }: UploadScreenProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type "${ext}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File too large (${formatBytes(file.size)}). Maximum: 2 GB`
    }
    return null
  }

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      setSelectedFile(null)
      return
    }
    setError(null)
    setSelectedFile(file)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleUpload = () => {
    if (!selectedFile || isUploading) return
    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    const formData = new FormData()
    formData.append('file', selectedFile)

    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100)
        setUploadProgress(pct)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { job_id: string }
          onUploadStart(data.job_id)
        } catch {
          setError('Invalid response from server')
          setIsUploading(false)
          setUploadProgress(null)
        }
      } else {
        let msg = `Upload failed (HTTP ${xhr.status})`
        try {
          const data = JSON.parse(xhr.responseText) as { detail?: string }
          if (data.detail) msg = data.detail
        } catch { /* ignore */ }
        setError(msg)
        setIsUploading(false)
        setUploadProgress(null)
      }
    }

    xhr.onerror = () => {
      setError('Network error. Is the backend running on port 8000?')
      setIsUploading(false)
      setUploadProgress(null)
    }

    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: '560px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            background: 'rgba(99, 102, 241, 0.15)',
            borderRadius: '16px',
            marginBottom: '16px',
          }}>
            <Film size={32} color="var(--accent)" />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>Video Analyse</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            User Research Interview Analyzer
          </p>
        </div>

        {/* Drop zone */}
        <div
          className="card"
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            cursor: isUploading ? 'default' : 'pointer',
            border: `2px dashed ${isDragging ? 'var(--accent)' : selectedFile ? 'var(--success)' : 'var(--border)'}`,
            background: isDragging ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-card)',
            padding: '40px 24px',
            textAlign: 'center',
            transition: 'border-color 0.15s, background 0.15s',
            marginBottom: '16px',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS.join(',')}
            onChange={handleInputChange}
            style={{ display: 'none' }}
            disabled={isUploading}
          />

          {selectedFile ? (
            <div>
              <CheckCircle size={40} color="var(--success)" style={{ marginBottom: '12px' }} />
              <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '15px' }}>
                {selectedFile.name}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                {formatBytes(selectedFile.size)}
              </div>
              {!isUploading && (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px' }}>
                  Click to change file
                </div>
              )}
            </div>
          ) : (
            <div>
              <Upload size={40} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
              <div style={{ fontWeight: '600', marginBottom: '4px', fontSize: '15px' }}>
                Drop your video here
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
                or click to browse
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Supported: {ALLOWED_EXTENSIONS.join(', ')} &middot; Max 2 GB
              </div>
            </div>
          )}
        </div>

        {/* Upload progress */}
        {uploadProgress !== null && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Uploading...</span>
              <span style={{ color: 'var(--accent)', fontWeight: '600' }}>{uploadProgress}%</span>
            </div>
            <div style={{
              height: '6px',
              background: 'var(--bg-secondary)',
              borderRadius: '3px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${uploadProgress}%`,
                background: 'var(--accent)',
                borderRadius: '3px',
                transition: 'width 0.2s',
              }} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
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
            {error}
          </div>
        )}

        {/* Upload button */}
        <button
          className="btn btn-primary"
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
        >
          {isUploading ? 'Uploading...' : 'Start Analysis'}
        </button>

        {/* Info footer */}
        <div style={{
          marginTop: '24px',
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          borderRadius: '6px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          lineHeight: '1.6',
        }}>
          <strong style={{ color: 'var(--text-secondary)' }}>How it works:</strong>{' '}
          Your video is processed locally — transcribed with Whisper, facial expressions
          analyzed with MediaPipe, and speech prosody analyzed with librosa.
          Processing a 60-minute video takes approximately 15–20 minutes.
        </div>
      </div>
    </div>
  )
}
