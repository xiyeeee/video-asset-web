import { useEffect, useRef, useState } from 'react'
import { isCancelled } from '@/features/auth/auth-api'
import { useSession } from '@/features/auth/session'
import {
  createLive2dTask,
  live2dErrorMessage,
  parseLive2dTask,
  type Live2dTask,
} from '@/services/live2d/api'
import {
  isLive2dSettled,
  live2dEventsPath,
  shouldApplyLive2dTask,
  type Live2dTaskBody,
} from '@/services/live2d/contract'

const SOCKET_ERROR = '任务状态连接中断，请重试。'

const live2dEventsUrl = (projectId: string, taskId: string) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${live2dEventsPath(projectId, taskId)}`
}

const watchLive2dTask = (
  projectId: string,
  taskId: string,
  token: string,
  signal: AbortSignal,
  onTask: (task: Live2dTask) => void,
) => new Promise<Live2dTask>((resolve, reject) => {
  let settled = false
  let attempts = 0
  let socket: WebSocket | null = null
  let retry: number | undefined

  const finish = (task: Live2dTask | null, error?: Error) => {
    if (settled) return
    settled = true
    if (retry !== undefined) window.clearTimeout(retry)
    socket?.close()
    if (task) resolve(task)
    else reject(error ?? new DOMException('aborted', 'AbortError'))
  }

  const open = () => {
    if (signal.aborted || settled) return
    const current = new WebSocket(live2dEventsUrl(projectId, taskId), ['video-asset.bearer', token])
    socket = current
    current.onmessage = (event) => {
      if (typeof event.data !== 'string' || settled) return
      let payload: unknown
      try {
        payload = JSON.parse(event.data)
      } catch {
        return
      }
      const task = parseLive2dTask(payload)
      if (!task || task.taskId !== taskId) return
      attempts = 0
      onTask(task)
      if (isLive2dSettled(task.status)) finish(task)
    }
    current.onclose = () => {
      if (settled || signal.aborted || socket !== current) return
      attempts += 1
      if (attempts >= 5) {
        finish(null, new Error(SOCKET_ERROR))
        return
      }
      retry = window.setTimeout(open, 1000)
    }
  }

  signal.addEventListener('abort', () => finish(null), { once: true })
  open()
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
      const created = await createLive2dTask(body, controller.signal)
      if (!shouldApplyLive2dTask(startedProjectId, projectRef.current)) return null
      setTask(created)
      setSubmitting(false)
      if (isLive2dSettled(created.status)) return created
      const token = useSession.getState().token
      if (!token) {
        setError('登录已失效，请重新登录。')
        return null
      }
      return await watchLive2dTask(startedProjectId, created.taskId, token, controller.signal, (next) => {
        if (shouldApplyLive2dTask(startedProjectId, projectRef.current)) setTask(next)
      })
    } catch (caught) {
      if (controller.signal.aborted || isCancelled(caught)) return null
      if (!shouldApplyLive2dTask(startedProjectId, projectRef.current)) return null
      setError(caught instanceof Error && caught.message === SOCKET_ERROR ? SOCKET_ERROR : live2dErrorMessage(caught))
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
