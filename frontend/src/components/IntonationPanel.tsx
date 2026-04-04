import React, { useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { IntonationEvent } from '../types'
import { formatTimestamp, formatConfidence } from '../utils/format'

interface IntonationPanelProps {
  events: IntonationEvent[]
  currentTime: number
  onSeek: (time: number) => void
}

function getLabelClass(label: string): string {
  const normalized = label.toLowerCase().replace(/\s+/g, '-')
  return `label-${normalized}`
}

export function IntonationPanel({ events, currentTime, onSeek }: IntonationPanelProps) {
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set())
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

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
        No intonation events detected.
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
        background: 'rgba(6, 182, 212, 0.06)',
        borderBottom: '1px solid rgba(6, 182, 212, 0.15)',
        fontSize: '11px',
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}>
        <AlertCircle size={13} color="var(--intonation-color)" style={{ flexShrink: 0, marginTop: '1px' }} />
        Observable speech characteristics — not conclusions about internal emotional state.
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
          const isExpanded = expandedIdx === idx

          return (
            <div
              key={`${idx}-${ev.timestamp}`}
              style={{
                marginBottom: '2px',
                borderRadius: '6px',
                background: isNear ? 'rgba(6, 182, 212, 0.08)' : 'transparent',
                borderLeft: isNear ? '2px solid var(--intonation-color)' : '2px solid transparent',
                transition: 'background 0.15s',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '8px 10px',
                  cursor: 'pointer',
                }}
                onClick={() => onSeek(ev.timestamp)}
                onMouseEnter={(e) => {
                  if (!isNear) (e.currentTarget.parentElement as HTMLDivElement).style.background = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  if (!isNear) (e.currentTarget.parentElement as HTMLDivElement).style.background = 'transparent'
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
                    {ev.notes && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ev.notes}</span>
                    )}
                  </div>
                </div>
                {/* Expand toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); setExpandedIdx(isExpanded ? null : idx) }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: '0',
                    flexShrink: 0,
                  }}
                  title="Show features"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              </div>

              {/* Expanded features */}
              {isExpanded && (
                <div style={{
                  padding: '0 10px 10px 10px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '6px',
                }}>
                  {Object.entries(ev.features).map(([key, val]) => (
                    <div key={key} style={{
                      background: 'var(--bg-secondary)',
                      borderRadius: '4px',
                      padding: '6px 8px',
                      fontSize: '11px',
                    }}>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div style={{ fontWeight: '600', fontFamily: 'monospace' }}>
                        {typeof val === 'number' ? val.toFixed(3) : String(val)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
