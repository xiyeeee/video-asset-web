import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { EmptyState, PageSkeleton } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { EpisodeSection } from '@/features/episodes/EpisodeSection'
import { ProjectCover } from '@/features/projects/ProjectCover'
import { ProjectFormDialog } from '@/features/projects/ProjectDialogs'
import { isProjectId, useProject } from '@/features/projects/use-projects'
import { AuthError } from '@/features/auth/auth-api'
import { formatDateTime } from '@/lib/format'

export function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const validId = isProjectId(projectId)
  const { data: project, isLoading, isError, error, refetch } = useProject(validId ? projectId : undefined)
  const [editing, setEditing] = useState(false)

  if (!validId) {
    return <EmptyState title="项目不可访问或已不存在" description="请从项目列表重新进入。" action={<Button asChild><Link to="/projects">返回项目列表</Link></Button>} />
  }
  if (isLoading) return <PageSkeleton />
  if (isError || !project) {
    const missing = error instanceof AuthError && error.code === 'NOT_FOUND'
    return (
      <EmptyState
        title={missing ? '项目不可访问或已不存在' : '项目详情加载失败'}
        description={missing ? '这个项目不属于当前账号，或已经被移除。' : '请检查网络后重试。'}
        action={missing ? <Button asChild><Link to="/projects">返回项目列表</Link></Button> : <Button onClick={() => void refetch()}>重试</Button>}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100svh-7rem)] lg:min-h-0">
      <section className="flex shrink-0 flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-card p-4">
        <ProjectCover name={project.name} className="size-20 rounded-xl text-2xl" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">项目管理 / {project.name}</p>
          <h2 className="text-2xl font-semibold">{project.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{project.description || '暂无简介'}</p>
          <p className="mt-2 text-xs text-violet-200">创建于 {formatDateTime(project.createdAt)} · 更新于 {formatDateTime(project.updatedAt)}</p>
        </div>
        <Button variant="outline" onClick={() => setEditing(true)}>编辑</Button>
      </section>
      <div className="min-h-0 flex-1">
        <EpisodeSection key={project.id} projectId={project.id} />
      </div>
      <ProjectFormDialog open={editing} project={project} onOpenChange={setEditing} onSaved={() => setEditing(false)} />
    </div>
  )
}
