import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Clapperboard, FileJson, FolderUp, Images, Plus } from 'lucide-react'
import { AssetBadge, AnalysisBadge } from '@/components/common/StatusBadge'
import { EmptyState, PageSkeleton } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { NovelDialog, ProjectFormDialog, UploadDialog } from '@/features/projects/ProjectDialogs'
import { useCatalog, usePublishCatalog } from '@/hooks/use-catalog'
import { assetTypeLabel, isActiveAnalysis } from '@/lib/labels'
import { completedEpisodeCount } from '@/services/view'
import type { AssetType } from '@/types/domain'

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useCatalog()
  const publish = usePublishCatalog()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)

  if (isLoading) return <PageSkeleton />
  if (isError || !data) {
    return <EmptyState title="工作台没有加载出来" description="演示数据读取失败。" action={<Button onClick={() => void refetch()}>重试</Button>} />
  }

  const running = data.episodes.filter((item) => isActiveAnalysis(item.status))
  const recentProjects = [...data.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)
  const recentAssets = [...data.assets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)
  const stats = [
    { label: '项目总数', value: data.projects.length, icon: FolderUp },
    { label: '视频集数', value: data.episodes.length, icon: Clapperboard },
    { label: '生成素材', value: data.assets.length, icon: Images },
    { label: '解析完成', value: data.episodes.filter((item) => item.status === 'COMPLETED').length, icon: FileJson },
  ]

  return (
    <div className="space-y-4">
      <section className="grid gap-3 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.map((item) => (
            <article key={item.label} className="rounded-2xl border border-white/10 bg-card p-4">
              <item.icon className="size-5 text-primary" />
              <p className="mt-3 text-3xl font-semibold">{item.value}</p>
              <p className="text-sm text-muted-foreground">{item.label}</p>
            </article>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button className="h-auto flex-col gap-2 py-6" onClick={() => setCreating(true)}>
            <Plus />
            新建项目
          </Button>
          <Button className="h-auto flex-col gap-2 py-6" variant="secondary" onClick={() => setUploading(true)}>
            <FolderUp />
            上传视频
          </Button>
          <Button className="h-auto flex-col gap-2 py-6" variant="secondary" onClick={() => setImporting(true)}>
            <FileJson />
            导入小说
          </Button>
          <Button className="h-auto flex-col gap-2 py-6" variant="secondary" onClick={() => navigate('/export')}>
            <Images />
            导出素材
          </Button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-4">
          <article className="rounded-2xl border border-white/10 bg-card p-4">
            <h2 className="mb-3 font-medium">正在执行的解析</h2>
            {running.length === 0 ? (
              <EmptyState title="没有进行中的任务" description="上传视频或在视频解析页开始排队中的集数。" />
            ) : (
              <div className="space-y-3">
                {running.map((episode) => {
                  const project = data.projects.find((item) => item.id === episode.projectId)
                  return (
                    <div key={episode.id} className="rounded-xl bg-background/60 p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{project?.name} · 第{episode.episodeNumber}集</p>
                          <p className="text-xs text-muted-foreground">{episode.title}</p>
                        </div>
                        <AnalysisBadge status={episode.status} />
                      </div>
                      <Progress value={episode.progress} />
                      <div className="mt-2 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/analysis?project=${episode.projectId}&episode=${episode.id}`)}>
                          查看详情
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </article>
          <article className="rounded-2xl border border-white/10 bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">最近生成的素材</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/assets')}>查看全部</Button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {recentAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className="overflow-hidden rounded-xl border border-white/10 bg-background text-left hover:-translate-y-0.5 hover:border-primary/50"
                  onClick={() => navigate(`/assets?project=${asset.projectId}&episode=${asset.episodeId}&type=${asset.type as AssetType}&asset=${asset.id}`)}
                >
                  <img src={asset.posterUrl || asset.url} alt="" className="aspect-square w-full object-cover" />
                  <div className="space-y-1 p-2">
                    <p className="truncate text-sm">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">{assetTypeLabel[asset.type]}</p>
                    <AssetBadge status={asset.status} />
                  </div>
                </button>
              ))}
            </div>
          </article>
        </div>
        <article className="rounded-2xl border border-white/10 bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">最近的项目</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/projects">全部项目</Link>
            </Button>
          </div>
          <div className="space-y-3">
            {recentProjects.map((project) => {
              const total = data.episodes.filter((item) => item.projectId === project.id).length
              const done = completedEpisodeCount(data, project.id)
              return (
                <button
                  key={project.id}
                  type="button"
                  className="flex w-full gap-3 rounded-xl bg-background/60 p-2 text-left hover:bg-background"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <img src={project.coverUrl} alt="" className="size-16 rounded-lg object-cover" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{project.name}</span>
                    <span className="block text-xs text-muted-foreground">{total} 集 · 已完成 {done} 集</span>
                    <span className="mt-1 block text-xs text-violet-200">{done === total && total > 0 ? '解析完成' : '进行中'}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </article>
      </section>

      <ProjectFormDialog open={creating} onOpenChange={setCreating} onSaved={(id) => { publish(); navigate(`/projects/${id}`) }} />
      <UploadDialog open={uploading} projects={data.projects} multiple onOpenChange={setUploading} onUploaded={(projectId, episodeId) => { publish(); navigate(`/analysis?project=${projectId}&episode=${episodeId}`) }} />
      <NovelDialog open={importing} projects={data.projects} onOpenChange={setImporting} onImported={(id) => { publish(); navigate(`/projects/${id}`) }} />
    </div>
  )
}
