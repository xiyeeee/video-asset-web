import { useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { EmptyState, PageSkeleton } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { useExtractionBoard, useExtractionCapabilities, useExtractionTask } from '@/features/extraction/use-extraction'
import { formatDateTime } from '@/lib/format'
import { characterErrorMessage } from '@/services/characters/api'
import {
  createExtractionTask,
  extractionBoardKey,
  extractTypeName,
  retryExtractionTask,
  taskStatusLabel,
  type ExtractionTask,
} from '@/services/extraction/api'

export function TaskCenterPage() {
  const board = useExtractionBoard()
  const capabilities = useExtractionCapabilities()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const characterReady = capabilities.data?.some((item) => item.type === 'CHARACTER' && item.supported) === true

  const refresh = () => queryClient.invalidateQueries({ queryKey: extractionBoardKey })
  const run = async (key: string, action: () => Promise<unknown>) => {
    setActionError('')
    setPendingId(key)
    try {
      await action()
      await refresh()
    } catch (error) {
      setActionError(characterErrorMessage(error))
    } finally {
      setPendingId(null)
    }
  }

  if (board.isPending) return <PageSkeleton />
  if (board.isError || !board.data) {
    return <EmptyState title="任务中心加载失败" description={characterErrorMessage(board.error)} action={<Button onClick={() => void board.refetch()}>重新获取</Button>} />
  }

  const selected = board.data.tasks.find((task) => task.id === selectedId) ?? board.data.tasks[0] ?? null
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
      <section className="space-y-3">
        {actionError ? <p className="text-sm text-rose-300">{actionError}</p> : null}
        {board.data.failedReads > 0 ? <p className="text-sm text-rose-300">有 {board.data.failedReads} 集的任务状态没有读到。</p> : null}
        {board.data.tasks.length === 0 ? (
          <EmptyState title="还没有提取任务" description="上传视频并开启自动提取后，任务会出现在这里。关闭自动提取的视频可以在下方手动发起。" />
        ) : board.data.tasks.map((task) => (
          <TaskRow key={`${task.projectId}-${task.episodeId}-${task.id}`} task={task} selected={selected?.id === task.id} onSelect={() => setSelectedId(task.id)} />
        ))}
        {board.data.pendingEpisodes.length > 0 ? (
          <div className="space-y-2">
            <h2 className="font-medium">尚未创建提取任务</h2>
            {board.data.pendingEpisodes.map((episode) => (
              <article key={episode.episodeId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card p-4">
                <div>
                  <p className="text-sm">{episode.projectName} · 第 {episode.episodeNumber} 集</p>
                  <p className="text-xs text-muted-foreground">{episode.episodeTitle}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={capabilities.isPending || !characterReady || pendingId === episode.episodeId}
                  onClick={() => void run(episode.episodeId, () => createExtractionTask(episode.projectId, episode.episodeId, ['CHARACTER']))}
                >
                  {capabilities.isPending ? '正在确认' : characterReady ? '发起人物提取' : '即将支持'}
                </Button>
              </article>
            ))}
          </div>
        ) : null}
      </section>
      <TaskDetail
        task={selected}
        busy={pendingId === selected?.id}
        onRetry={(task) => void run(task.id, () => retryExtractionTask(task))}
      />
    </div>
  )
}

function TaskRow({ task, selected, onSelect }: { task: ExtractionTask; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={`w-full rounded-2xl border p-4 text-left ${selected ? 'border-violet-300/60 bg-violet-400/10' : 'border-white/10 bg-card'}`}>
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{task.projectName || '项目'} · {task.episodeNumber ? `第 ${task.episodeNumber} 集` : task.episodeTitle || '剧集'}</span>
        <span className="text-xs text-violet-200">{taskStatusLabel(task.status)}</span>
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">任务 {task.id} · {task.types.map(extractTypeName).join('、') || '未标明类型'}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{task.stageLabel}</span>
    </button>
  )
}

function TaskDetail({
  task,
  busy,
  onRetry,
}: {
  task: ExtractionTask | null
  busy: boolean
  onRetry: (task: ExtractionTask) => void
}) {
  const detail = useExtractionTask(task?.id)
  if (!task) return <EmptyState title="选择一个任务" description="任务详情会显示每种素材的真实阶段。没有百分比时，不会自行估算进度。" />
  const current = detail.data ?? task
  let assetTab = 'characters'
  if (current.types.includes('BACKGROUND')) assetTab = 'background'
  if (current.types.includes('DIALOGUE')) assetTab = 'dialogue'
  if (current.types.includes('SHOT')) assetTab = 'shots'
  return (
    <article className="space-y-3 rounded-2xl border border-white/10 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">{current.episodeNumber ? `第 ${current.episodeNumber} 集` : current.episodeTitle} · AI 素材提取</h2>
        <span className="text-sm text-violet-200">{taskStatusLabel(current.status)}</span>
      </div>
      <dl className="grid gap-2 text-sm text-muted-foreground">
        <div>任务 ID {current.id}</div>
        <div>项目 {current.projectName || '—'}</div>
        <div>剧集 {current.episodeTitle || '—'}</div>
        <div>创建 {current.createdAt ? formatDateTime(current.createdAt) : '—'}</div>
        <div>开始 {current.startedAt ? formatDateTime(current.startedAt) : '—'}</div>
        <div>完成 {current.finishedAt ? formatDateTime(current.finishedAt) : '—'}</div>
      </dl>
      {detail.isError ? <p className="text-sm text-rose-300">任务详情读取失败。</p> : null}
      {current.errorMessage ? <p className="text-sm text-rose-300">{current.errorMessage}</p> : null}
      <div className="space-y-2">
        {current.steps.map((step) => (
          <div key={step.type} className="flex items-start justify-between gap-3 rounded-xl bg-background/40 px-3 py-2 text-sm">
            <span>{extractTypeName(step.type)}</span>
            <span className="text-right text-muted-foreground">{step.detail || step.state}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {current.status === 'FAILED' || current.status === 'PARTIAL_SUCCESS' ? <Button type="button" disabled={busy} onClick={() => onRetry(current)}>{busy ? '正在提交' : '重试'}</Button> : null}
        {current.projectId && current.episodeId ? (
          <Button type="button" variant="outline" asChild>
            <Link to={`/assets?project=${current.projectId}&episode=${current.episodeId}&tab=${assetTab}`}>查看已生成素材</Link>
          </Button>
        ) : null}
      </div>
    </article>
  )
}
