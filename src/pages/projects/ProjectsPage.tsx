import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Ellipsis, Plus, Search } from 'lucide-react'
import { EmptyState, PageSkeleton } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ProjectCover } from '@/features/projects/ProjectCover'
import { ProjectFormDialog } from '@/features/projects/ProjectDialogs'
import { PROJECT_PAGE_SIZE, useProjectList } from '@/features/projects/use-projects'
import { formatDateTime } from '@/lib/format'
import type { ProjectSummary } from '@/services/projects/api'

export function ProjectsPage() {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ProjectSummary | null>(null)
  const query = keyword.trim().slice(0, 100)
  const { data, isLoading, isError, isFetching, refetch } = useProjectList({ q: query, page, size: PROJECT_PAGE_SIZE })

  if (isLoading) return <PageSkeleton />
  if (isError || !data) {
    return <EmptyState title="项目列表加载失败" description="请检查网络后重新读取你的项目。" action={<Button onClick={() => void refetch()}>重试</Button>} />
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.size))
  const emptyTitle = query ? '没有匹配的项目' : '还没有项目'
  const emptyDescription = query ? '换一个关键词，或创建一个新的漫剧项目。' : '创建一个漫剧项目后，刷新页面仍然可以在这里看到。'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={keyword}
            placeholder="搜索项目名称或简介"
            maxLength={100}
            onChange={(event) => {
              setKeyword(event.target.value)
              setPage(1)
            }}
          />
        </div>
        <Button onClick={() => setCreating(true)}><Plus />新建项目</Button>
      </div>
      {data.items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={<Button onClick={() => setCreating(true)}>新建项目</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((project) => (
            <article key={project.id} className="overflow-hidden rounded-2xl border border-white/10 bg-card">
              <button type="button" className="block w-full text-left" onClick={() => navigate(`/projects/${project.id}`)}>
                <ProjectCover name={project.name} className="h-44 w-full text-4xl" />
                <div className="space-y-2 p-4">
                  <h2 className="text-lg font-medium">{project.name}</h2>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{project.description || '暂无简介'}</p>
                  <p className="text-xs text-violet-200">更新于 {formatDateTime(project.updatedAt)}</p>
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
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{isFetching ? '正在更新…' : `共 ${data.total} 个项目`}</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>上一页</Button>
          <span>第 {data.page} / {pageCount} 页</span>
          <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>下一页</Button>
        </div>
      </div>
      <ProjectFormDialog open={creating} onOpenChange={setCreating} onSaved={(id) => navigate(`/projects/${id}`)} />
      <ProjectFormDialog
        open={Boolean(editing)}
        project={editing ?? undefined}
        onOpenChange={(open) => { if (!open) setEditing(null) }}
        onSaved={() => setEditing(null)}
      />
    </div>
  )
}
