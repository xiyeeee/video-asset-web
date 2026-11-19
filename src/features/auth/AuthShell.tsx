import type { ReactNode } from 'react'
import { Castle, Clapperboard, Gamepad2, Package, UserRound } from 'lucide-react'
import { Navigate, useSearchParams } from 'react-router'
import { safeDestination } from './safe-destination'
import { useSession } from './session'

const auroraUrl = encodeURI('/视频转游戏素材_前端设计稿/01_设计演进/紫蓝幻夜山谷极光.png')
const stageUrl = encodeURI('/视频转游戏素材_前端设计稿/01_设计演进/霓虹电影胶片与幻想卡牌平台.png')

const features = [
  { icon: Clapperboard, title: '视频解析', text: '智能分镜与内容理解' },
  { icon: UserRound, title: '角色提取', text: '自动识别与角色建档' },
  { icon: Castle, title: '场景生成', text: '高质量场景与背景' },
  { icon: Package, title: '素材导出', text: '多格式适配游戏引擎' },
]

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  const status = useSession((state) => state.status)
  const [params] = useSearchParams()
  if (status === 'authenticated') return <Navigate to={safeDestination(params.get('redirect'))} replace />
  if (status === 'checking') {
    return <main className="grid min-h-svh place-items-center bg-background text-muted-foreground">正在恢复登录状态…</main>
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-[#070b18] text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${auroraUrl}")` }} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#070b18]/75 via-[#070b18]/20 to-[#070b18]/60" aria-hidden="true" />
      <div className="relative mx-auto grid min-h-svh max-w-6xl items-center gap-8 px-4 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-10">
        <section className="hidden lg:block">
          <div className="mb-8 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-white"><Gamepad2 size={20} /></span>
            <span className="text-sm font-medium">视频转游戏素材平台</span>
          </div>
          <p className="max-w-xl text-5xl leading-tight font-semibold tracking-tight">
            视频转<span className="bg-gradient-to-r from-violet-200 to-fuchsia-300 bg-clip-text text-transparent">游戏素材</span>
          </p>
          <p className="mt-4 text-lg text-slate-300">让每一帧故事，成为游戏世界的起点</p>
          <img src={stageUrl} alt="" className="mt-8 w-full max-w-xl" />
          <ul className="mt-8 grid max-w-xl grid-cols-4 gap-3">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <li key={feature.title} className="text-center">
                  <span className="mx-auto mb-2 grid size-11 place-items-center rounded-full border border-white/10 bg-white/5 text-violet-200">
                    <Icon size={18} />
                  </span>
                  <p className="text-sm font-medium">{feature.title}</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-400">{feature.text}</p>
                </li>
              )
            })}
          </ul>
        </section>
        <section className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-[#151b30]/85 p-6 shadow-[0_0_80px_rgba(139,92,246,0.16)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-white"><Gamepad2 size={18} /></span>
            <span className="text-sm font-medium">视频转游戏素材平台</span>
          </div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-2 mb-6 text-sm text-muted-foreground">{description}</p>
          {children}
        </section>
      </div>
    </main>
  )
}
