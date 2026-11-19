import { Navigate, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { useSession, useSignOut } from './session'

export function RequireAuth() {
  const status = useSession((state) => state.status)
  const retry = useSession((state) => state.retry)
  const location = useLocation()
  const signOut = useSignOut()

  if (status === 'anonymous') {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  if (status === 'authenticated') return <Outlet />

  return (
    <main className="grid min-h-svh place-items-center bg-background p-6 text-foreground">
      {status === 'checking' ? <p role="status">正在恢复登录状态…</p> : (
        <section className="space-y-4 text-center" aria-label="会话恢复">
          <p role="alert">无法连接服务，暂时无法验证登录状态。请重试。</p>
          <div className="flex justify-center gap-2">
            <Button type="button" onClick={retry}>重试</Button>
            <Button type="button" variant="outline" onClick={signOut}>退出登录</Button>
          </div>
        </section>
      )}
    </main>
  )
}
