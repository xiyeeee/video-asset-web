import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { AnalysisBadge } from '@/components/common/StatusBadge'
import { EmptyState, PageSkeleton } from '@/components/common/EmptyState'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ConfirmDialog, NovelDialog, ProjectFormDialog, UploadDialog } from '@/features/projects/ProjectDialogs'
import { useCatalog, usePublishCatalog } from '@/hooks/use-catalog'
import { formatClock } from '@/lib/format'
import { assetTypeLabel, assetTypeOrder } from '@/lib/labels'
import { deleteProject, retryAnalysis, startAnalysis } from '@/services/mock/catalog'
import { assetsOfEpisode, episodesOf } from '@/services/view'

export function ProjectDetailPage() {
  const { projectId = '' } = useParams()
  const { data, isLoading, isError, refetch } = useCatalog()
  const publish = usePublishCatalog()
  const navigate = useNavigate()
  const project = data?.projects.find((item) => item.id === projectId)
  const episodes = data && project ? episodesOf(data, project.id) : []
  const [episodeId, setEpisodeId] = useState<string | null>(null)
  const selected = episodes.find((item) => item.id === episodeId) ?? episodes[0]
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [batch, setBatch] = useState(false)
  const [importing, setImporting] = useState(false)

  if (isLoading) return <PageSkeleton />
  if (isError || !data) return <EmptyState title="项目详情加载失败" description="请重新读取演示数据。" action={<Button onClick={() => void refetch()}>重试</Button>} />
  if (!project) return <EmptyState title="项目不存在" description="它可能已经在本次会话中被删除。" action={<Button asChild><Link to="/projects">返回项目列表</Link></Button>} />

  const selectedAssets = selected ? assetsOfEpisode(data, selected.id) : []

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-card p-4">
        <img src={project.coverUrl} alt="" className="size-20 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">项目管理 / {project.name}</p>
          <h2 className="text-2xl font-semibold">{project.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
          <p className="mt-2 text-xs text-violet-200">
            {episodes.length} 集 · 已完成 {episodes.filter((item) => item.status === 'COMPLETED').length} 集 · 素材 {data.assets.filter((item) => item.projectId === project.id).length} 项
            {project.novelName ? ` · 原著 ${project.novelName}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setUploading(true)}>上传单集</Button>
          <Button variant="outline" onClick={() => setBatch(true)}>批量上传</Button>
          <Button variant="outline" onClick={() => setImporting(true)}>导入小说</Button>
          <Button variant="outline" onClick={() => setEditing(true)}>编辑</Button>
          <Button variant="destructive" onClick={() => setRemoving(true)}>删除</Button>
        </div>
      </section>
      {project.novelText ? <p className="rounded-2xl border border-white/10 bg-panel px-4 py-3 text-sm text-muted-foreground">原著摘录：{project.novelText.slice(0, 120)}</p> : null}
      <section className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-white/10 bg-card p-3">
          <h3 className="mb-2 px-2 font-medium">集数列表（{episodes.length}）</h3>
          {episodes.length === 0 ? <EmptyState title="还没有集数" description="上传视频后，这里会显示解析状态。" /> : null}
          <div className="max-h-[640px] space-y-1 overflow-auto">
            {episodes.map((episode) => (
              <button
                key={episode.id}
                type="button"
                className={`w-full rounded-xl px-3 py-2 text-left ${selected?.id === episode.id ? 'bg-primary/20' : 'hover:bg-white/5'}`}
                onClick={() => setEpisodeId(episode.id)}
              >
                <span className="flex items-center justify-between gap-2">
                  <span>第{episode.episodeNumber}集</span>
                  <AnalysisBadge status={episode.status} />
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{formatClock(episode.duration)} · 素材 {assetsOfEpisode(data, episode.id).length}</span>
                {episode.status === 'ANALYZING' || episode.status === 'EXTRACTING' || episode.status === 'UPLOADING' ? <Progress className="mt-2" value={episode.progress} /> : null}
              </button>
            ))}
          </div>
        </div>
        {selected ? (
          <div className="space-y-4">
            <VideoPlayer src={selected.videoUrl} poster={selected.posterUrl} title={`${project.name} ${selected.title}`} />
            <div className="rounded-2xl border border-white/10 bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-medium">{selected.title}</h3>
                  <p className="text-sm text-muted-foreground">{selected.resolution} · {formatClock(selected.duration)} · 素材 {selectedAssets.length} 项</p>
                  {selected.errorMessage ? <p className="mt-1 text-sm text-rose-300">{selected.errorMessage}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.status === 'FAILED' ? <Button onClick={() => { retryAnalysis(selected.id); publish(); toast.success('已重新开始解析') }}>重试解析</Button> : null}
                  {selected.status === 'QUEUED' || selected.status === 'PENDING' ? <Button onClick={() => { startAnalysis(selected.id); publish(); toast.success('已开始解析') }}>开始解析</Button> : null}
                  <Button variant="outline" onClick={() => navigate(`/analysis?project=${project.id}&episode=${selected.id}`)}>查看解析</Button>
                  <Button onClick={() => navigate(`/assets?project=${project.id}&episode=${selected.id}`)}>查看素材</Button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
                {assetTypeOrder.map((type) => (
                  <button key={type} type="button" className="rounded-xl bg-background px-3 py-2 text-left hover:bg-primary/10" onClick={() => navigate(`/assets?project=${project.id}&episode=${selected.id}&type=${type}`)}>
                    <span className="block text-xs text-muted-foreground">{assetTypeLabel[type]}</span>
                    <span className="text-lg font-medium">{selectedAssets.filter((item) => item.type === type).length}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="选择一集视频" description="上传后可以在这里预览，并进入解析或素材库。" />
        )}
      </section>
      <ProjectFormDialog open={editing} project={project} onOpenChange={setEditing} onSaved={() => publish()} />
      <UploadDialog open={uploading} projects={data.projects} defaultProjectId={project.id} multiple={false} onOpenChange={setUploading} onUploaded={(_, episodeId) => { publish(); setEpisodeId(episodeId) }} />
      <UploadDialog open={batch} projects={data.projects} defaultProjectId={project.id} multiple onOpenChange={setBatch} onUploaded={(_, episodeId) => { publish(); setEpisodeId(episodeId) }} />
      <NovelDialog open={importing} projects={data.projects} defaultProjectId={project.id} onOpenChange={setImporting} onImported={() => publish()} />
      <ConfirmDialog
        open={removing}
        title="删除项目"
        description={`删除「${project.name}」后，本次会话中的集数和素材会一起移除。`}
        confirmLabel="确认删除"
        onOpenChange={setRemoving}
        onConfirm={() => {
          deleteProject(project.id)
          publish()
          toast.success('项目已删除')
          navigate('/projects')
        }}
      />
    </div>
  )
}
