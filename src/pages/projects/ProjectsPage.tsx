import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Ellipsis, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, PageSkeleton } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ConfirmDialog, ProjectFormDialog } from '@/features/projects/ProjectDialogs'
import { useCatalog, usePublishCatalog } from '@/hooks/use-catalog'
import { deleteProject } from '@/services/mock/catalog'
import { completedEpisodeCount } from '@/services/view'
import type { Project } from '@/types/domain'

export function ProjectsPage() {
  const { data, isLoading, isError, refetch } = useCatalog()
  const publish = usePublishCatalog()
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [removing, setRemoving] = useState<Project | null>(null)
  const projects = useMemo(() => {
    const text = keyword.trim().toLowerCase()
    return (data?.projects ?? []).filter((project) => `${project.name} ${project.description}`.toLowerCase().includes(text))
  }, [data?.projects, keyword])

  if (isLoading) return <PageSkeleton />
  if (isError || !data) return <EmptyState title="项目列表加载失败" description="请重新读取演示数据。" action={<Button onClick={() => void refetch()}>重试</Button>} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input className="pl-9" value={keyword} placeholder="搜索项目名称或简介" onChange={(event) => setKeyword(event.target.value)} />
        </div>
        <Button onClick={() => setCreating(true)}><Plus />新建项目</Button>
      </div>
      {projects.length === 0 ? (
        <EmptyState title="没有匹配的项目" description="换一个关键词，或创建一个新的漫剧项目。" action={<Button onClick={() => setCreating(true)}>新建项目</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const episodes = data.episodes.filter((item) => item.projectId === project.id)
            const done = completedEpisodeCount(data, project.id)
            return (
              <article key={project.id} className="overflow-hidden rounded-2xl border border-white/10 bg-card">
                <button type="button" className="block w-full text-left" onClick={() => navigate(`/projects/${project.id}`)}>
                  <img src={project.coverUrl} alt="" className="h-44 w-full object-cover" />
                  <div className="space-y-2 p-4">
                    <h2 className="text-lg font-medium">{project.name}</h2>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
                    <p className="text-xs text-violet-200">{episodes.length} 集 · 已解析 {done} 集 · 素材 {data.assets.filter((item) => item.projectId === project.id).length} 项</p>
                  </div>
                </button>
                <div className="flex justify-end px-3 pb-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-sm" variant="outline" aria-label={`${project.name}的操作`}>
                        <Ellipsis />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(project)}>编辑</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setRemoving(project)}>删除</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </article>
            )
          })}
        </div>
      )}
      <ProjectFormDialog open={creating} onOpenChange={setCreating} onSaved={() => { publish(); setCreating(false) }} />
      <ProjectFormDialog open={Boolean(editing)} project={editing ?? undefined} onOpenChange={(open) => !open && setEditing(null)} onSaved={() => publish()} />
      <ConfirmDialog
        open={Boolean(removing)}
        title="删除项目"
        description={removing ? `删除「${removing.name}」后，本次会话中的集数、角色和素材会一起移除。` : ''}
        confirmLabel="确认删除"
        onOpenChange={(open) => !open && setRemoving(null)}
        onConfirm={() => {
          if (!removing) return
          deleteProject(removing.id)
          publish()
          toast.success('项目已删除')
        }}
      />
    </div>
  )
}
