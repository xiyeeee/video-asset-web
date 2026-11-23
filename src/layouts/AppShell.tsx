import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import {
  Bell,
  FolderKanban,
  LayoutDashboard,
  Library,
  ListTodo,
  Package,
  PanelLeft,
  ScrollText,
} from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSession, useSignOut } from '@/features/auth/session'
import { useProject } from '@/features/projects/use-projects'
import { useCatalog, useTaskSimulation } from '@/hooks/use-catalog'
import { analysisLabel, isActiveAnalysis } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/stores/ui-store'

const navigation = [
  { to: '/', label: '工作台', icon: LayoutDashboard, end: true },
  { to: '/projects', label: '项目管理', icon: FolderKanban, end: false },
  { to: '/tasks', label: '任务中心', icon: ListTodo, end: false },
  { to: '/assets', label: '素材库', icon: Library, end: false },
  { to: '/story', label: '剧情脚本', icon: ScrollText, end: false },
  { to: '/export', label: '导出中心', icon: Package, end: false },
]

function preserveQuery(to: string, search: string) {
  const current = new URLSearchParams(search)
  const next = new URLSearchParams()
  const project = current.get('project')
  const episode = current.get('episode')
  if (project) next.set('project', project)
  if (episode) next.set('episode', episode)
  const query = next.toString()
  return query ? `${to}?${query}` : to
}

export function AppShell() {
  useTaskSimulation()
  const catalog = useCatalog().data
  const collapsed = useUiStore((state) => state.collapsed)
  const toggle = useUiStore((state) => state.toggle)
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams()
  const projectFromPath = useProject(params.projectId)
  const title = titleFor(location.pathname, projectFromPath.data?.name)
  const alerts = catalog?.episodes.filter((item) => isActiveAnalysis(item.status) || item.status === 'FAILED') ?? []
  const user = useSession((state) => state.user)
  const signOut = useSignOut()
  const displayName = user?.displayName || user?.username || '用户'

  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      <aside className={cn('flex shrink-0 flex-col border-r border-white/10 bg-sidebar transition-[width]', collapsed ? 'w-[76px]' : 'w-64')}>
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-semibold">视</div>
          {collapsed ? null : (
            <div>
              <p className="text-sm font-semibold">视频转游戏素材</p>
              <p className="text-xs text-muted-foreground">AI 素材工作台</p>
            </div>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navigation.map((item) => {
            const Icon = item.icon
            const link = (
              <NavLink
                to={preserveQuery(item.to, location.search)}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300',
                    isActive
                      ? 'bg-primary text-white shadow-[0_8px_24px_rgb(139_92_246/0.35)] hover:bg-primary'
                      : 'hover:bg-violet-400/15 hover:text-violet-100',
                    collapsed && 'justify-center px-0',
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                {collapsed ? null : item.label}
              </NavLink>
            )
            return collapsed ? (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ) : (
              <div key={item.to}>{link}</div>
            )
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-white/10 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button type="button" size="icon-sm" variant="outline" onClick={toggle} aria-label={collapsed ? '展开导航' : '折叠导航'}>
              <PanelLeft />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">{title.heading}</h1>
              <p className="truncate text-xs text-muted-foreground">{title.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon-sm" variant="outline" aria-label="任务通知">
                  <Bell />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>解析任务</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {alerts.length === 0 ? <DropdownMenuItem disabled>当前没有进行中的任务</DropdownMenuItem> : null}
                {alerts.slice(0, 6).map((episode) => {
                  const project = catalog?.projects.find((item) => item.id === episode.projectId)
                  return (
                    <DropdownMenuItem
                      key={episode.id}
                      onClick={() => navigate(`/analysis?project=${episode.projectId}&episode=${episode.id}`)}
                    >
                      {project?.name} 第{episode.episodeNumber}集 · {analysisLabel[episode.status]}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="hidden text-right sm:block">
              <p className="text-sm">{displayName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon" aria-label="账号菜单" className="rounded-full">
                  {displayName.slice(0, 1)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
                <DropdownMenuItem onClick={signOut}>退出登录</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}

function titleFor(pathname: string, projectName?: string): { heading: string; description: string } {
  if (pathname.startsWith('/projects/') && pathname.length > '/projects/'.length) {
    return { heading: projectName ?? '项目详情', description: '查看项目资料，上传并预览原视频' }
  }
  const map: Record<string, { heading: string; description: string }> = {
    '/': { heading: '工作台', description: '管理项目、查看解析进度与最近生成的素材' },
    '/projects': { heading: '项目管理', description: '创建漫剧项目，上传视频并导入原著' },
    '/analysis': { heading: '视频解析', description: '查看首帧解析状态，并在失败后重试' },
    '/tasks': { heading: '任务中心', description: '查看素材提取进度，并在失败后重试' },
    '/assets': { heading: '素材库', description: '按集查看分镜、人物和其他提取结果' },
    '/story': { heading: '剧情脚本', description: '修正角色、编辑台词并预览剧情 JSON' },
    '/export': { heading: '导出中心', description: '配置演示导出任务并下载元数据清单' },
  }
  return map[pathname] ?? { heading: '未找到页面', description: '这个地址没有对应的工作台页面' }
}
