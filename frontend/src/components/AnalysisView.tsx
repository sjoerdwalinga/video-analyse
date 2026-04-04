import React, { useState } from 'react'
import { RotateCcw, Film, Clock } from 'lucide-react'
import { AnalysisResults } from '../types'
import { VideoPlayer } from './VideoPlayer'
import { TranscriptPanel } from './TranscriptPanel'
import { ExpressionPanel } from './ExpressionPanel'
import { IntonationPanel } from './IntonationPanel'
import { ExportPanel } from './ExportPanel'
import { formatDuration } from '../utils/format'

interface AnalysisViewProps {
  results: AnalysisResults
  jobId: string
  onReset: () => void
}

type ActiveTab = 'facial' | 'intonation'

export function AnalysisView({ results, jobId, onReset }: AnalysisViewProps) {
  const [currentTime, setCurrentTime] = useState(0)
  const [seekTo, setSeekTo] = useState<number | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<ActiveTab>('facial')

  const handleSeek = (time: number) => {
    setSeekTo(time)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <Film size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontWeight: '600',
              fontSize: '14px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '400px',
            }}>
              {results.video_filename}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
              {results.duration != null && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={10} />
                  {formatDuration(results.duration)}
                </span>
              )}
              <span>{results.transcript.length} segments</span>
              <span>{results.facial_expressions.length} facial events</span>
              <span>{results.intonation_events.length} intonation events</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <ExportPanel results={results} />
          <button className="btn btn-ghost" onClick={onReset}>
            <RotateCcw size={14} />
            New Analysis
          </button>
        </div>
      </div>

      {/* Main content grid */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '55fr 45fr',
        gridTemplateRows: '1fr',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Left column: video + bottom tabs */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: '1px solid var(--border)',
        }}>
          {/* Video */}
          <div style={{ padding: '12px 12px 8px', flexShrink: 0 }}>
            <VideoPlayer
              jobId={jobId}
              onTimeUpdate={setCurrentTime}
              seekTo={seekTo}
            />
          </div>

          {/* Tab bar */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <button
              onClick={() => setActiveTab('facial')}
              style={{
                flex: 1,
                padding: '10px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'facial' ? '2px solid var(--facial-color)' : '2px solid transparent',
                color: activeTab === 'facial' ? 'var(--facial-color)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === 'facial' ? '600' : '400',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              Facial Expressions
              <span style={{
                marginLeft: '6px',
                fontSize: '11px',
                background: 'rgba(236, 72, 153, 0.15)',
                color: 'var(--facial-color)',
                padding: '1px 6px',
                borderRadius: '9999px',
              }}>
                {results.facial_expressions.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('intonation')}
              style={{
                flex: 1,
                padding: '10px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'intonation' ? '2px solid var(--intonation-color)' : '2px solid transparent',
                color: activeTab === 'intonation' ? 'var(--intonation-color)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === 'intonation' ? '600' : '400',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              Intonation
              <span style={{
                marginLeft: '6px',
                fontSize: '11px',
                background: 'rgba(6, 182, 212, 0.15)',
                color: 'var(--intonation-color)',
                padding: '1px 6px',
                borderRadius: '9999px',
              }}>
                {results.intonation_events.length}
              </span>
            </button>
          </div>

          {/* Active panel */}
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {activeTab === 'facial' ? (
              <ExpressionPanel
                events={results.facial_expressions}
                currentTime={currentTime}
                onSeek={handleSeek}
              />
            ) : (
              <IntonationPanel
                events={results.intonation_events}
                currentTime={currentTime}
                onSeek={handleSeek}
              />
            )}
          </div>
        </div>

        {/* Right column: transcript */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 12px 8px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--transcript-color)' }}>
              Transcript
            </h3>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <TranscriptPanel
              segments={results.transcript}
              currentTime={currentTime}
              onSeek={handleSeek}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
