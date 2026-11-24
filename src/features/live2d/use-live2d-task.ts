import { useEffect, useRef, useState } from 'react'
import { isCancelled } from '@/features/auth/auth-api'
import {
  createLive2dTask,
  getLive2dTask,
  live2dErrorMessage,
  type Live2dTask,
} from '@/services/live2d/api'
import {
  isLive2dSettled,
  LIVE2D_POLL_INTERVAL_MS,
  shouldApplyLive2dTask,
  type Live2dTaskBody,
} from '@/services/live2d/contract'

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) {
    reject(new DOMException('aborted', 'AbortError'))
    return
  }
  const timer = setTimeout(resolve, ms)
  signal.addEventListener('abort', () => {
    clearTimeout(timer)
    reject(new DOMException('aborted', 'AbortError'))
  }, { once: true })
})

export function useLive2dTask(projectId: string | undefined) {
  const [task, setTask] = useState<Live2dTask | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const projectRef = useRef(projectId)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    projectRef.current = projectId
  }, [projectId])

  useEffect(() => () => abortRef.current?.abort(), [])

  const submit = async (body: Live2dTaskBody): Promise<Live2dTask | null> => {
    if (!projectId || submitting || (task && !isLive2dSettled(task.status))) return null
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    const startedProjectId = projectId
    setSubmitting(true)
    setError('')
    try {
      let current = await createLive2dTask(body, controller.signal)
      if (!shouldApplyLive2dTask(startedProjectId, projectRef.current)) return null
      setTask(current)
      setSubmitting(false)
      while (!isLive2dSettled(current.status)) {
        await wait(LIVE2D_POLL_INTERVAL_MS, controller.signal)
        current = await getLive2dTask(startedProjectId, current.taskId, controller.signal)
        if (!shouldApplyLive2dTask(startedProjectId, projectRef.current)) return null
        setTask(current)
      }
      return current
    } catch (caught) {
      if (controller.signal.aborted || isCancelled(caught)) return null
      if (!shouldApplyLive2dTask(startedProjectId, projectRef.current)) return null
      setError(live2dErrorMessage(caught))
      return null
    } finally {
      if (shouldApplyLive2dTask(startedProjectId, projectRef.current) && abortRef.current === controller) {
        setSubmitting(false)
      }
    }
  }

  const busy = submitting || (task !== null && !isLive2dSettled(task.status))
  const clear = () => {
    setTask(null)
    setError('')
  }
  return { task, error, submitting, busy, submit, clear }
}
