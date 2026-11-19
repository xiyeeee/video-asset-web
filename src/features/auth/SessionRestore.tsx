import { useEffect } from 'react'
import { getCurrentUser, isCancelled, isUnauthorized } from './auth-api'
import { useSession } from './session'

export function SessionRestore() {
  const token = useSession((state) => state.token)
  const status = useSession((state) => state.status)
  const revision = useSession((state) => state.revision)

  useEffect(() => {
    if (status !== 'checking' || !token) return
    const request = new AbortController()
    const currentRevision = revision
    void getCurrentUser(token, request.signal)
      .then((user) => useSession.getState().restore(currentRevision, user))
      .catch((failure: unknown) => {
        if (request.signal.aborted || isCancelled(failure)) return
        if (isUnauthorized(failure)) return
        useSession.getState().restoreFailed(currentRevision)
      })
    return () => request.abort()
  }, [revision, status, token])

  return null
}
