import { z } from 'zod'

export const emailSchema = z.string().trim().min(1, '请输入邮箱').max(254, '邮箱最多 254 个字符')
  .email('请输入有效的邮箱地址').regex(/^[\x21-\x7E]+$/, '邮箱仅支持 ASCII 字符')

export const loginSchema = z.object({
  account: z.string().trim().min(1, '请输入用户名或邮箱').max(254, '账号最多 254 个字符'),
  password: z.string().min(1, '请输入密码'),
})

export const registerSchema = z.object({
  email: emailSchema,
  username: z.string().min(1, '请输入用户名').regex(/^[A-Za-z0-9_]{3,32}$/, '用户名需为 3–32 位字母、数字或下划线'),
  verificationCode: z.string().regex(/^[0-9]{6}$/, '请输入 6 位数字验证码'),
  password: z.string().min(8, '密码至少 8 个字符').max(64, '密码最多 64 个字符'),
  confirmPassword: z.string().min(1, '请再次输入密码'),
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: '两次输入的密码不一致',
})

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
