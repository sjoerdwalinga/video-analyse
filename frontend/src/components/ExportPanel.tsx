import React, { useEffect, useRef, useState } from 'react'
import { Download, ChevronDown, FileJson, FileText, FileSpreadsheet } from 'lucide-react'
import { AnalysisResults } from '../types'
import { exportCSV, exportJSON, exportMarkdown } from '../utils/export'

interface ExportPanelProps {
  results: AnalysisResults
}

export function ExportPanel({ results }: ExportPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost"
        onClick={() => setIsOpen((v) => !v)}
      >
        <Download size={14} />
        Export
        <ChevronDown size={12} />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          right: 0,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '6px',
          minWidth: '180px',
          zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <button
            className="btn btn-ghost"
            onClick={() => { exportJSON(results); setIsOpen(false) }}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', border: 'none' }}
          >
            <FileJson size={14} color="#f59e0b" />
            Export JSON
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => { exportCSV(results); setIsOpen(false) }}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', border: 'none' }}
          >
            <FileSpreadsheet size={14} color="#22c55e" />
            Export CSV
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => { exportMarkdown(results); setIsOpen(false) }}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', border: 'none' }}
          >
            <FileText size={14} color="#6366f1" />
            Export Markdown
          </button>
        </div>
      )}
    </div>
  )
}
