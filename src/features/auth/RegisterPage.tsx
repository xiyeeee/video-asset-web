import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { AuthField } from './AuthField'
import { authErrorMessage, isCancelled, registerAccount, requestCode, retryAfterSeconds } from './auth-api'
import { withRedirect } from './safe-destination'
import { useDeadline } from './use-deadline'
import { useRequestSignal } from './use-request-signal'
import { emailSchema, registerSchema, type RegisterValues } from './validation'
import { AuthShell } from './AuthShell'

export function RegisterPage() {
  return (
    <AuthShell title="创建账号" description="填写邮箱和验证码，创建你的创作账号">
      <RegisterForm />
    </AuthShell>
  )
}

function RegisterForm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirect = params.get('redirect')
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)
  const [sentTo, setSentTo] = useState('')
  const emailCooldown = useDeadline()
  const submitCooldown = useDeadline()
  const emailSignal = useRequestSignal()
  const submitSignal = useRequestSignal()
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', username: '', verificationCode: '', password: '', confirmPassword: '' },
  })

  const sendCode = async () => {
    if (sendingRef.current || emailCooldown.remaining || form.formState.isSubmitting) return
    const parsed = emailSchema.safeParse(form.getValues('email'))
    if (!parsed.success) {
      form.setError('email', { message: parsed.error.issues[0]?.message ?? '请输入邮箱' })
      form.setFocus('email')
      return
    }
    form.clearErrors('email')
    setMessage('')
    setFailed(false)
    setSending(true)
    sendingRef.current = true
    const signal = emailSignal()
    const email = parsed.data
    try {
      const result = await requestCode(email, signal)
      if (signal.aborted) return
      setSentTo(email)
      emailCooldown.start(result.data.retryAfterSeconds)
      if (form.getValues('email').trim() === email) {
        setMessage(result.message || '如可处理，验证码将发送至该邮箱，请查收')
        setFailed(false)
      }
    } catch (error) {
      if (signal.aborted || isCancelled(error)) return
      setMessage(authErrorMessage(error, 'email'))
      setFailed(true)
      const seconds = retryAfterSeconds(error)
      if (seconds) emailCooldown.start(seconds)
    } finally {
      sendingRef.current = false
      if (!signal.aborted) setSending(false)
    }
  }

  const submit = form.handleSubmit(async (values) => {
    if (submitCooldown.remaining || sending) return
    setMessage('')
    setFailed(false)
    const signal = submitSignal()
    try {
      await registerAccount(values, signal)
      if (!signal.aborted) {
        navigate(withRedirect('/login', redirect), { replace: true, state: { account: values.email, registered: true } })
      }
    } catch (error) {
      if (signal.aborted || isCancelled(error)) return
      setMessage(authErrorMessage(error, 'register'))
      setFailed(true)
      const seconds = retryAfterSeconds(error)
      if (seconds) submitCooldown.start(seconds)
    }
  })

  const pending = form.formState.isSubmitting

  return (
    <>
      <form noValidate onSubmit={submit} className="space-y-4" aria-label="注册表单" aria-busy={pending}>
        <AuthField
          label="邮箱"
          placeholder="输入邮箱地址"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          error={form.formState.errors.email?.message}
          {...form.register('email', {
            onChange: () => {
              form.setValue('verificationCode', '')
              setMessage('')
              setFailed(false)
            },
          })}
        />
        <AuthField
          label="用户名"
          placeholder="3–32 位字母、数字或下划线"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          error={form.formState.errors.username?.message}
          {...form.register('username')}
        />
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <AuthField
              label="邮箱验证码"
              placeholder="6 位数字"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              error={form.formState.errors.verificationCode?.message}
              {...form.register('verificationCode')}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-7 h-10 shrink-0"
            disabled={sending || pending || emailCooldown.remaining > 0}
            onClick={() => void sendCode()}
          >
            {sending ? '发送中…' : emailCooldown.remaining ? `${emailCooldown.remaining} 秒后重发` : '获取验证码'}
          </Button>
        </div>
        {sentTo && emailCooldown.remaining > 0 ? (
          <p className="text-xs text-muted-foreground">重发等待关联邮箱：{sentTo}。更换邮箱不代表新邮箱已验证。</p>
        ) : null}
        <AuthField
          label="密码"
          placeholder="8–64 个字符"
          password
          autoComplete="new-password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <AuthField
          label="确认密码"
          placeholder="再次输入密码"
          password
          autoComplete="new-password"
          error={form.formState.errors.confirmPassword?.message}
          {...form.register('confirmPassword')}
        />
        <p className={`min-h-5 text-sm ${failed ? 'text-rose-300' : 'text-emerald-300'}`} aria-live="polite" aria-atomic="true">{message}</p>
        <Button type="submit" className="h-11 w-full" disabled={pending || sending || submitCooldown.remaining > 0}>
          {pending ? <><LoaderCircle className="animate-spin" aria-hidden="true" />正在注册</> : submitCooldown.remaining ? `${submitCooldown.remaining} 秒后重试` : '创建账号'}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        已有账号？
        <Link className="ml-1 font-medium text-violet-300 hover:underline" to={withRedirect('/login', redirect)}>立即登录</Link>
      </p>
    </>
  )
}
