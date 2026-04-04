import { useCallback, useEffect, useRef, useState } from 'react'
import { JobInfo } from '../types'

const TERMINAL_STATUSES: JobInfo['status'][] = ['completed', 'failed']
const POLL_INTERVAL_MS = 2000

export function useJob(jobId: string | null) {
  const [job, setJob] = useState<JobInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchJob = useCallback(async () => {
    if (!jobId) return
    try {
      const res = await fetch(`/api/jobs/${jobId}`)
      if (!res.ok) {
        const text = await res.text()
        setError(`HTTP ${res.status}: ${text}`)
        return
      }
      const data: JobInfo = await res.json()
      setJob(data)
      setError(null)

      // Stop polling when done
      if (TERMINAL_STATUSES.includes(data.status)) {
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    }
  }, [jobId])

  const refetch = useCallback(() => {
    void fetchJob()
  }, [fetchJob])

  useEffect(() => {
    if (!jobId) {
      setJob(null)
      setError(null)
      return
    }

    setLoading(true)
    void fetchJob().then(() => setLoading(false))

    // Start polling
    intervalRef.current = setInterval(() => {
      void fetchJob()
    }, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [jobId, fetchJob])

  return { job, loading, error, refetch }
}
