import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { create } from 'zustand'
import type { AuthSession, AuthUser } from './auth-api'

const TOKEN_KEY = 'video-asset.access-token'

type SessionStatus = 'anonymous' | 'checking' | 'authenticated' | 'error'

interface SessionState {
  token: string | null
  user: AuthUser | null
  status: SessionStatus
  revision: number
  signIn: (session: AuthSession) => void
  signOut: () => void
  restore: (revision: number, user: AuthUser) => void
  restoreFailed: (revision: number) => void
  expire: (revision: number) => void
  retry: () => void
}

const readToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

const writeToken = (token: string | null) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
    return true
  } catch {
    return false
  }
}

const initialToken = readToken()

export const useSession = create<SessionState>((set, get) => ({
  token: initialToken,
  user: null,
  status: initialToken ? 'checking' : 'anonymous',
  revision: 0,
  signIn: ({ accessToken, user }) => {
    if (!writeToken(accessToken)) toast.info('登录仅在当前页面有效，浏览器未允许保存会话。')
    set((state) => ({ token: accessToken, user, status: 'authenticated', revision: state.revision + 1 }))
  },
  signOut: () => {
    writeToken(null)
    set((state) => ({ token: null, user: null, status: 'anonymous', revision: state.revision + 1 }))
  },
  restore: (revision, user) => set((state) => (
    state.revision === revision && state.token ? { user, status: 'authenticated' } : state
  )),
  restoreFailed: (revision) => set((state) => (
    state.revision === revision && state.token ? { status: 'error' } : state
  )),
  expire: (revision) => {
    const state = get()
    if (state.revision !== revision || !state.token) return
    writeToken(null)
    set({ token: null, user: null, status: 'anonymous', revision: state.revision + 1 })
    if (window.location.pathname !== '/login') toast.info('登录已失效，请重新登录。', { id: 'session-expired' })
  },
  retry: () => set((state) => (state.token ? { status: 'checking', user: null } : state)),
}))

export const useSignOut = () => {
  const signOut = useSession((state) => state.signOut)
  const queryClient = useQueryClient()
  return () => {
    signOut()
    queryClient.clear()
  }
}
