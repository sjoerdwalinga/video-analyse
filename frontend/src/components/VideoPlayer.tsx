import React, { useEffect, useRef } from 'react'

interface VideoPlayerProps {
  jobId: string
  onTimeUpdate: (time: number) => void
  seekTo?: number
}

export function VideoPlayer({ jobId, onTimeUpdate, seekTo }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastSeekRef = useRef<number | undefined>(undefined)

  // Seek when seekTo changes
  useEffect(() => {
    if (seekTo === undefined) return
    if (seekTo === lastSeekRef.current) return
    lastSeekRef.current = seekTo

    const video = videoRef.current
    if (video) {
      video.currentTime = seekTo
    }
  }, [seekTo])

  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (video) {
      onTimeUpdate(video.currentTime)
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        position: 'relative',
        width: '100%',
        paddingTop: '56.25%', // 16:9
        background: '#000',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        <video
          ref={videoRef}
          src={`/api/videos/${jobId}`}
          controls
          onTimeUpdate={handleTimeUpdate}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
    </div>
  )
}
