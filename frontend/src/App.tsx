import React, { useState } from 'react'
import { UploadScreen } from './components/UploadScreen'
import { ProcessingScreen } from './components/ProcessingScreen'
import { AnalysisView } from './components/AnalysisView'
import { AnalysisResults } from './types'

type View = 'upload' | 'processing' | 'analysis'

export default function App() {
  const [view, setView] = useState<View>('upload')
  const [jobId, setJobId] = useState<string | null>(null)
  const [results, setResults] = useState<AnalysisResults | null>(null)

  const handleUploadStart = (newJobId: string) => {
    setJobId(newJobId)
    setResults(null)
    setView('processing')
  }

  const handleComplete = (analysisResults: AnalysisResults) => {
    setResults(analysisResults)
    setView('analysis')
  }

  // Error is displayed by ProcessingScreen internally; App just stays on that view
  const handleError = (_error: string) => {
    // Stay on processing screen — it shows the error and a back button
  }

  const handleReset = () => {
    setJobId(null)
    setResults(null)
    setView('upload')
  }

  if (view === 'upload') {
    return (
      <UploadScreen onUploadStart={handleUploadStart} />
    )
  }

  if (view === 'processing' && jobId) {
    return (
      <ProcessingScreen
        jobId={jobId}
        onComplete={handleComplete}
        onError={handleError}
        onCancel={handleReset}
      />
    )
  }

  if (view === 'analysis' && results && jobId) {
    return (
      <AnalysisView
        results={results}
        jobId={jobId}
        onReset={handleReset}
      />
    )
  }

  // Fallback
  return <UploadScreen onUploadStart={handleUploadStart} />
}
