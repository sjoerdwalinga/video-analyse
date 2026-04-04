import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { TranscriptSegment } from '../types'
import { formatTimestamp } from '../utils/format'

interface TranscriptPanelProps {
  segments: TranscriptSegment[]
  currentTime: number
  onSeek: (time: number) => void
}


export function TranscriptPanel({ segments, currentTime, onSeek }: TranscriptPanelProps) {
  const [query, setQuery] = useState('')
  const activeRef = useRef<HTMLDivElement>(null)

  const activeIndex = useMemo(() => {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (currentTime >= segments[i].start_time) return i
    }
    return -1
  }, [segments, currentTime])

  const filteredSegments = useMemo(() => {
    if (!query.trim()) return segments.map((s, i) => ({ ...s, originalIndex: i }))
    const q = query.toLowerCase()
    return segments
      .map((s, i) => ({ ...s, originalIndex: i }))
      .filter((s) => s.text.toLowerCase().includes(q))
  }, [segments, query])

  // Auto-scroll active segment into view
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeIndex])

  if (segments.length === 0) {
    return (
      <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
        No transcript available.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Search */}
      <div style={{ padding: '12px 12px 0', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            className="search-input"
            placeholder="Search transcript..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: '30px' }}
          />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', paddingLeft: '2px' }}>
          {filteredSegments.length} segment{filteredSegments.length !== 1 ? 's' : ''}
          {query && ` matching "${query}"`}
        </div>
      </div>

      {/* Segments */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 12px 16px' }}>
        {filteredSegments.map((seg) => {
          const isActive = seg.originalIndex === activeIndex
          const opacity = seg.confidence !== null
            ? Math.max(0.6, Math.min(1.0, 1.0 + seg.confidence * 0.3))
            : 1.0

          return (
            <div
              key={`${seg.originalIndex}-${seg.start_time}`}
              ref={isActive ? activeRef : null}
              onClick={() => onSeek(seg.start_time)}
              style={{
                display: 'flex',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '6px',
                marginBottom: '2px',
                cursor: 'pointer',
                background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'background 0.15s',
                opacity,
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
              }}
            >
              {/* Timestamp */}
              <div style={{ flexShrink: 0, paddingTop: '1px' }}>
                <span className="timestamp-link" style={{ fontSize: '10px' }}>
                  {formatTimestamp(seg.start_time)}
                </span>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {seg.speaker && (
                  <span className="badge" style={{
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--accent)',
                    marginBottom: '3px',
                    display: 'inline-block',
                  }}>
                    {seg.speaker}
                  </span>
                )}
                <p style={{
                  fontSize: '13px',
                  lineHeight: '1.5',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  margin: 0,
                }}>
                  {seg.text}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
