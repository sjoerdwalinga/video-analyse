import React, { useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { FacialExpressionEvent } from '../types'
import { formatTimestamp, formatConfidence } from '../utils/format'

interface ExpressionPanelProps {
  events: FacialExpressionEvent[]
  currentTime: number
  onSeek: (time: number) => void
}

function getLabelClass(label: string): string {
  const normalized = label.toLowerCase().replace(/\s+/g, '-')
  return `label-${normalized}`
}

export function ExpressionPanel({ events, currentTime, onSeek }: ExpressionPanelProps) {
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set())

  const allLabels = useMemo(() => {
    const counts = new Map<string, number>()
    for (const ev of events) {
      counts.set(ev.label, (counts.get(ev.label) ?? 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [events])

  const filteredEvents = useMemo(() => {
    if (selectedLabels.size === 0) return events
    return events.filter((ev) => selectedLabels.has(ev.label))
  }, [events, selectedLabels])

  const toggleLabel = (label: string) => {
    setSelectedLabels((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  if (events.length === 0) {
    return (
      <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
        No facial expression events detected.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Disclaimer */}
      <div style={{
        display: 'flex',
        gap: '7px',
        padding: '8px 12px',
        background: 'rgba(236, 72, 153, 0.06)',
        borderBottom: '1px solid rgba(236, 72, 153, 0.15)',
        fontSize: '11px',
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}>
        <AlertCircle size={13} color="var(--facial-color)" style={{ flexShrink: 0, marginTop: '1px' }} />
        Observable facial expressions detected by automated analysis — not psychological diagnoses.
      </div>

      {/* Label filter pills */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        padding: '10px 12px',
        flexShrink: 0,
        borderBottom: '1px solid var(--border)',
      }}>
        {allLabels.map(([label, count]) => {
          const isSelected = selectedLabels.has(label)
          return (
            <button
              key={label}
              onClick={() => toggleLabel(label)}
              className={`badge ${getLabelClass(label)}`}
              style={{
                cursor: 'pointer',
                border: isSelected ? '1px solid currentColor' : '1px solid transparent',
                opacity: selectedLabels.size > 0 && !isSelected ? 0.5 : 1,
                transition: 'opacity 0.15s',
                background: 'none',
              }}
            >
              {label} ({count})
            </button>
          )
        })}
        {selectedLabels.size > 0 && (
          <button
            className="btn btn-ghost"
            onClick={() => setSelectedLabels(new Set())}
            style={{ padding: '2px 8px', fontSize: '11px', height: 'auto' }}
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Events list */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '8px 12px 16px' }}>
        {filteredEvents.map((ev, idx) => {
          const isNear = Math.abs(ev.timestamp - currentTime) < 5
          return (
            <div
              key={`${idx}-${ev.timestamp}`}
              onClick={() => onSeek(ev.timestamp)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '6px',
                marginBottom: '2px',
                cursor: 'pointer',
                background: isNear ? 'rgba(236, 72, 153, 0.08)' : 'transparent',
                borderLeft: isNear ? '2px solid var(--facial-color)' : '2px solid transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isNear) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                if (!isNear) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
              }}
            >
              <span className="timestamp-link" style={{ flexShrink: 0, marginTop: '1px' }}>
                {formatTimestamp(ev.timestamp)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className={`badge ${getLabelClass(ev.label)}`}>{ev.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {formatConfidence(ev.confidence)}
                  </span>
                </div>
                {ev.notes && (
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0', lineHeight: '1.4' }}>
                    {ev.notes}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
