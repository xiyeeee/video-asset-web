import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { useFrames } from '@/features/analysis/use-analysis'
import { useExtractionCapabilities } from '@/features/extraction/use-extraction'
import { ShotTimeline } from '@/features/shots/ShotTimeline'
import { formatMediaTime, type FormalShot } from '@/features/shots/timeline'
import { useShotAssets, useShotTask } from '@/features/shots/use-shots'
import { isCancelled } from '@/features/auth/auth-api'
import { analysisErrorMessage, type FramePreview } from '@/services/analysis/api'
import { createExtractionTask, extractionBoardKey, retryExtractionTask } from '@/services/extraction/api'
import { shotAssetKey, shotErrorMessage } from '@/services/shots/api'

export function ShotAssets({
  projectId,
  episodeId,
}: {
  projectId: string
  episodeId: string
}) {
  const queryClient = useQueryClient()
  const shots = useShotAssets(episodeId)
  const capabilities = useExtractionCapabilities()
  const task = useShotTask(episodeId, shots.data?.status === 'PENDING' || shots.data?.status === 'RUNNING')
  const frames = useFrames(projectId, episodeId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const imageRefresh = useRef(false)
  const shotSupported = capabilities.data?.some((item) => item.type === 'SHOT' && item.supported) === true
  const formal = shots.data?.formal ?? []
  const busy = shots.data?.status === 'PENDING' || shots.data?.status === 'RUNNING' || task.data?.status === 'PENDING' || task.data?.status === 'RUNNING'

  const selectShot = (shot: FormalShot) => {
    setSelectedId(shot.assetId)
  }

  const reloadShots = (frameUrl: string) => {
    if (imageRefresh.current) {
      setFailedUrl(frameUrl)
      return
    }
    imageRefresh.current = true
    setFailedUrl(null)
    void shots.refetch().finally(() => {
      imageRefresh.current = false
    })
  }

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    setActionError('')
    try {
      if (task.data && (task.data.status === 'FAILED' || task.data.status === 'PARTIAL_SUCCESS')) {
        await retryExtractionTask(task.data)
      } else {
        await createExtractionTask(projectId, episodeId, ['SHOT'])
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: shotAssetKey(episodeId) }),
        queryClient.invalidateQueries({ queryKey: ['shot-task', episodeId] }),
        queryClient.invalidateQueries({ queryKey: extractionBoardKey }),
      ])
    } catch (error) {
      if (!isCancelled(error)) setActionError(shotErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <ShotStatus
        loading={shots.isPending}
        error={shots.error}
        status={shots.data?.status}
        count={formal.length}
        busy={busy}
        supported={shotSupported}
        capabilityReady={!capabilities.isPending}
        failure={task.data?.errorMessage}
        submitting={submitting}
        actionError={actionError}
        onRetry={() => void shots.refetch()}
        onSubmit={() => void submit()}
      />
      {formal.length > 0 ? (
        <ShotTimeline
          shots={formal}
          selectedId={selectedId}
          failedUrl={failedUrl}
          onSelect={selectShot}
          onReload={(shot) => reloadShots(shot.frameUrl)}
        />
      ) : null}
      {shots.data && formal.length === 0 ? <HistoricalFrames frames={frames.data} pending={frames.isPending} error={frames.error} onRetry={() => void frames.refetch()} /> : null}
    </div>
  )
}

function ShotStatus({
  loading,
  error,
  status,
  count,
  busy,
  supported,
  capabilityReady,
  failure,
  submitting,
  actionError,
  onRetry,
  onSubmit,
}: {
  loading: boolean
  error: unknown
  status: string | undefined
  count: number
  busy: boolean
  supported: boolean
  capabilityReady: boolean
  failure: string | null | undefined
  submitting: boolean
  actionError: string
  onRetry: () => void
  onSubmit: () => void
}) {
  if (loading) return <p className="text-sm text-muted-foreground">正在读取分镜…</p>
  if (error) {
    return <EmptyState title="分镜加载失败" description={shotErrorMessage(error)} action={<Button onClick={onRetry}>重新获取</Button>} />
  }
  const canStart = capabilityReady && supported && !busy && status !== 'SUCCESS' && status !== 'UNSUPPORTED'
  const note = status === 'UNSUPPORTED'
    ? '分镜切分即将支持。下面如有图片，是历史首帧，不是分段镜头。'
    : status === 'NOT_STARTED'
      ? '这一集还没有发起分镜提取。'
      : status === 'PENDING' || status === 'RUNNING'
        ? count > 0 ? '已有分镜仍可查看，新的提取正在进行。' : '分镜提取正在进行，完成后会出现分段。'
        : status === 'FAILED'
          ? failure || '分镜提取失败。已有的成功分镜仍会保留。'
          : count > 0
            ? `正式分镜 ${count} 段`
            : '还没有正式分镜。下面如有图片，是历史首帧。'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm">{note}</p>
        {actionError ? <p className="text-sm text-rose-300">{actionError}</p> : null}
      </div>
      {canStart ? (
        <Button type="button" disabled={submitting} onClick={onSubmit}>{submitting ? '正在提交' : status === 'FAILED' ? '重试分镜提取' : '提取分镜'}</Button>
      ) : null}
    </div>
  )
}

function HistoricalFrames({
  frames,
  pending,
  error,
  onRetry,
}: {
  frames: FramePreview[] | undefined
  pending: boolean
  error: unknown
  onRetry: () => void
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (pending) return <p className="text-sm text-muted-foreground">正在读取历史首帧…</p>
  if (error) return <EmptyState title="历史首帧加载失败" description={analysisErrorMessage(error)} action={<Button onClick={onRetry}>重新获取</Button>} />
  if (!frames || frames.length === 0) return null
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium">历史首帧 · {frames.length} 张</h2>
      <ol className="m-0 list-none p-0">
        {frames.map((frame, index) => (
          <li key={frame.id} className="grid grid-cols-[4.75rem_1rem_minmax(0,1fr)] gap-x-3">
            <time className="pt-4 text-right text-xs text-violet-200">{formatMediaTime(frame.timestampMs)}</time>
            <div className="relative flex justify-center">
              {index < frames.length - 1 ? <span className="absolute top-5 bottom-0 w-px bg-white/15" /> : null}
              <span className="relative z-10 mt-4 h-2.5 w-2.5 rounded-full bg-white/40" />
            </div>
            <article className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-card">
              <div className="flex flex-col gap-3 p-3 sm:flex-row">
                {failedUrl === frame.url ? (
                  <div className="flex h-28 w-full items-center justify-center sm:w-44">
                    <Button type="button" variant="outline" onClick={() => { setFailedUrl(null); onRetry() }}>重新获取图片</Button>
                  </div>
                ) : (
                  <img src={frame.url} alt={frame.name} referrerPolicy="no-referrer" className="h-28 w-full rounded-xl object-cover sm:w-44" onError={() => setFailedUrl(frame.url)} />
                )}
                <p className="pt-1 text-sm text-muted-foreground">历史首帧 · 未分段</p>
              </div>
            </article>
          </li>
        ))}
      </ol>
    </div>
  )
}
