import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { AuthField } from './AuthField'
import { authErrorMessage, isCancelled, login, retryAfterSeconds } from './auth-api'
import { safeDestination, withRedirect } from './safe-destination'
import { useSession } from './session'
import { useDeadline } from './use-deadline'
import { useRequestSignal } from './use-request-signal'
import { loginSchema, type LoginValues } from './validation'
import { AuthShell } from './AuthShell'

type LoginLocationState = { account?: string; registered?: boolean } | null

export function LoginPage() {
  return (
    <AuthShell title="欢迎回来" description="登录你的账号，继续创作游戏素材">
      <LoginForm />
    </AuthShell>
  )
}

function LoginForm() {
  const location = useLocation()
  const routeState = location.state as LoginLocationState
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const signIn = useSession((state) => state.signIn)
  const [message, setMessage] = useState(routeState?.registered ? '注册成功，请登录' : '')
  const [failed, setFailed] = useState(false)
  const cooldown = useDeadline()
  const getSignal = useRequestSignal()
  const redirect = params.get('redirect')
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { account: routeState?.account ?? '', password: '' },
  })

  const submit = form.handleSubmit(async (values) => {
    if (cooldown.remaining) return
    setMessage('')
    setFailed(false)
    const signal = getSignal()
    try {
      const result = await login(values.account, values.password, signal)
      if (signal.aborted) return
      signIn(result.data)
      queryClient.clear()
      navigate(safeDestination(redirect), { replace: true })
    } catch (error) {
      if (signal.aborted || isCancelled(error)) return
      setMessage(authErrorMessage(error, 'login'))
      setFailed(true)
      const seconds = retryAfterSeconds(error)
      if (seconds) cooldown.start(seconds)
    }
  })

  const pending = form.formState.isSubmitting

  return (
    <>
      <form noValidate onSubmit={submit} className="space-y-4" aria-label="登录表单" aria-busy={pending}>
        <AuthField
          label="用户名或邮箱"
          placeholder="输入用户名或邮箱"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          error={form.formState.errors.account?.message}
          {...form.register('account')}
        />
        <AuthField
          label="密码"
          placeholder="输入你的密码"
          password
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <p className={`min-h-5 text-sm ${failed ? 'text-rose-300' : 'text-emerald-300'}`} aria-live="polite" aria-atomic="true">{message}</p>
        <Button type="submit" className="h-11 w-full" disabled={pending || cooldown.remaining > 0}>
          {pending ? <><LoaderCircle className="animate-spin" aria-hidden="true" />正在登录</> : cooldown.remaining ? `${cooldown.remaining} 秒后重试` : '登录'}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        还没有账号？
        <Link className="ml-1 font-medium text-violet-300 hover:underline" to={withRedirect('/register', redirect)}>立即注册</Link>
      </p>
    </>
  )
}
