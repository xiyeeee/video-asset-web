import axios from 'axios'
import type { AxiosResponse, RawAxiosResponseHeaders } from 'axios'
import { z } from 'zod'
import { useSession } from './session'

const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
})

const sessionSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().positive(),
  user: userSchema,
})

const responseSchema = z.object({ code: z.string(), message: z.string(), data: z.unknown() })
const codeSchema = z.object({ retryAfterSeconds: z.number().nonnegative() })

const http = axios.create({ baseURL: '/api/auth/v1', timeout: 15_000 })

export type AuthUser = z.infer<typeof userSchema>
export type AuthSession = z.infer<typeof sessionSchema>

export type RegisterPayload = {
  email: string
  username: string
  verificationCode: string
  password: string
  confirmPassword: string
}

export class AuthError extends Error {
  readonly status: number
  readonly code: string
  readonly headers?: RawAxiosResponseHeaders

  constructor(message: string, status: number, code: string, headers?: RawAxiosResponseHeaders) {
    super(message)
    this.name = 'AuthError'
    this.status = status
    this.code = code
    this.headers = headers
  }
}

const headerValue = (headers: RawAxiosResponseHeaders | undefined, name: string) => {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()]
  return typeof value === 'string' ? value : undefined
}

const toAuthError = (error: unknown) => {
  if (error instanceof AuthError) return error
  if (axios.isCancel(error) || (axios.isAxiosError(error) && error.code === 'ERR_CANCELED')) {
    return new AuthError('请求已取消', 0, 'ABORTED')
  }
  if (!axios.isAxiosError(error)) return new AuthError('暂时无法完成操作，请稍后重试。', 0, 'UNKNOWN')
  if (error.code === 'ECONNABORTED') return new AuthError('请求超时，请稍后重试', 0, 'TIMEOUT')
  if (!error.response) return new AuthError('网络请求失败，请检查连接', 0, 'NETWORK_ERROR')
  const parsed = responseSchema.safeParse(error.response.data)
  const headers = error.response.headers
  if (!parsed.success) return new AuthError('操作失败，请稍后重试。', error.response.status, 'UNKNOWN', headers)
  return new AuthError(parsed.data.message || '操作失败，请稍后重试。', error.response.status, parsed.data.code, headers)
}

const readData = <Data>(response: AxiosResponse, schema: z.ZodType<Data>) => {
  const envelope = responseSchema.safeParse(response.data)
  if (!envelope.success) throw new AuthError('服务响应格式与接口约定不一致', response.status, 'INVALID_RESPONSE')
  if (envelope.data.code !== 'OK') {
    throw new AuthError(envelope.data.message || '请求未成功，请稍后重试', response.status, envelope.data.code)
  }
  const data = schema.safeParse(envelope.data.data)
  if (!data.success) throw new AuthError('服务响应数据与接口约定不一致', response.status, 'INVALID_RESPONSE')
  return { data: data.data, message: envelope.data.message }
}

const request = async <Data>(
  call: () => Promise<AxiosResponse>,
  schema: z.ZodType<Data>,
  revision?: number,
) => {
  try {
    return readData(await call(), schema)
  } catch (error) {
    const authError = toAuthError(error)
    if (revision !== undefined && authError.status === 401 && authError.code !== 'ABORTED') {
      useSession.getState().expire(revision)
    }
    throw authError
  }
}

export const requestCode = async (email: string, signal?: AbortSignal) => {
  const result = await request(
    () => http.post('/email-codes', { email, purpose: 'REGISTER' }, { signal }),
    codeSchema,
  )
  return result
}

export const registerAccount = (payload: RegisterPayload, signal?: AbortSignal) =>
  request(() => http.post('/register', payload, { signal }), userSchema)

export const login = (account: string, password: string, signal?: AbortSignal) =>
  request(() => http.post('/login', { account, password }, { signal }), sessionSchema)

export const getCurrentUser = (token: string, signal: AbortSignal) => {
  const revision = useSession.getState().revision
  return request(
    () => http.get('/me', { signal, headers: { Authorization: `Bearer ${token}` } }),
    userSchema,
    revision,
  ).then((result) => result.data)
}

export const isCancelled = (error: unknown) => error instanceof AuthError && error.code === 'ABORTED'

export const isUnauthorized = (error: unknown) => error instanceof AuthError && error.status === 401

export const retryAfterSeconds = (error: unknown) => {
  if (!(error instanceof AuthError) || error.status !== 429) return null
  const value = headerValue(error.headers, 'retry-after')?.trim()
  if (!value || !/^\d+$/.test(value)) return null
  const seconds = Number(value)
  return Number.isSafeInteger(seconds) ? seconds : null
}

export const authErrorMessage = (error: unknown, action: 'login' | 'register' | 'email' | 'restore') => {
  if (!(error instanceof AuthError)) return '暂时无法完成操作，请稍后重试。'
  if (error.code === 'INVALID_CREDENTIALS' && action === 'login') return '账号或密码错误'
  if (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR') {
    if (action === 'register') return '未能确认注册结果，请稍后尝试登录确认，或重新提交。'
    if (action === 'email') return '未能确认发送结果，请稍后查看邮箱或重试。'
    return action === 'restore' ? '无法连接服务，暂时无法验证登录状态。请重试。' : '暂时无法连接服务，请检查网络后重试。'
  }
  if (error.status === 429 || error.code === 'RATE_LIMITED') {
    const seconds = retryAfterSeconds(error)
    return seconds ? `操作过于频繁，请在 ${seconds} 秒后重试。` : '操作过于频繁，请稍后重试。'
  }
  if (error.code === 'ACCOUNT_CONFLICT') return '邮箱或用户名已被使用，请修改后重试。'
  if (error.code === 'INVALID_REQUEST') return '提交的信息不符合要求，请检查后重试。'
  if (error.code === 'VERIFICATION_INVALID') return '验证码无效或已过期，请重新获取'
  if (error.status === 403 || error.code === 'FORBIDDEN') return '没有访问权限，请联系管理员。'
  if (error.status >= 500) return '服务暂时不可用，请稍后重试。'
  return error.message || '暂时无法完成操作，请稍后重试。'
}
