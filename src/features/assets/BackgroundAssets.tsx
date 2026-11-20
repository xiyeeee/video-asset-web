import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { BackgroundCards } from '@/features/background/BackgroundCards'
import {
  nextBackgroundSeek,
  openBackgroundEpisode,
  switchBackgroundEpisode,
  type BackgroundCard,
} from '@/features/background/cards'
import { useBackgroundAssets, useBackgroundTask } from '@/features/background/use-background'
import { useEpisodePlayback } from '@/features/episodes/use-episodes'
import { isCancelled } from '@/features/auth/auth-api'
import { useExtractionCapabilities } from '@/features/extraction/use-extraction'
import { backgroundAssetKey, backgroundErrorMessage, type BackgroundAssetStatus } from '@/services/background/api'
import { episodeErrorMessage } from '@/services/episodes/api'
import { createExtractionTask, extractionBoardKey, extractionFailureText, retryExtractionTask } from '@/services/extraction/api'

export function BackgroundAssets({ projectId, episodeId }: { projectId: string; episodeId: string }) {
  const queryClient = useQueryClient()
  const backgrounds = useBackgroundAssets(episodeId)
  const capabilities = useExtractionCapabilities()
  const supported = capabilities.data?.some((item) => item.type === 'BACKGROUND' && item.supported) === true
  const assetActive = backgrounds.data?.status === 'PENDING' || backgrounds.data?.status === 'RUNNING'
  const task = useBackgroundTask(episodeId, assetActive)
  const [session, setSession] = useState(() => openBackgroundEpisode(episodeId))
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const imageRefresh = useRef(false)
  if (session.episodeId !== episodeId) setSession(switchBackgroundEpisode(session, episodeId))

  const cards = backgrounds.data?.cards ?? []
  const busy = assetActive || task.data?.status === 'PENDING' || task.data?.status === 'RUNNING'

  const choose = (card: BackgroundCard) => {
    setSession((current) => ({
      ...current,
      selectedId: card.assetId,
      seek: nextBackgroundSeek(current.seek, episodeId, card),
    }))
  }

  const reloadImage = (imageUrl: string) => {
    if (imageRefresh.current) {
      setFailedUrl(imageUrl)
      return
    }
    imageRefresh.current = true
    setFailedUrl(null)
    void backgrounds.refetch().finally(() => {
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
        await createExtractionTask(projectId, episodeId, ['BACKGROUND'])
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: backgroundAssetKey(episodeId) }),
        queryClient.invalidateQueries({ queryKey: ['background-task', episodeId] }),
        queryClient.invalidateQueries({ queryKey: extractionBoardKey }),
      ])
    } catch (error) {
      if (!isCancelled(error)) setActionError(backgroundErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <BackgroundStatus
        loading={backgrounds.isPending}
        error={backgrounds.error}
        status={backgrounds.data?.status}
        count={cards.length}
        busy={busy}
        supported={supported}
        capabilityReady={!capabilities.isPending}
        capabilityError={capabilities.error}
        failure={extractionFailureText(task.data?.errorMessage ?? null)}
        submitting={submitting}
        actionError={actionError}
        onRetry={() => {
          if (capabilities.isError) void capabilities.refetch()
          if (backgrounds.isError || !capabilities.isError) void backgrounds.refetch()
        }}
        onSubmit={() => void submit()}
      />
      {supported ? <EpisodeVideo projectId={projectId} episodeId={episodeId} seekTo={session.seek} /> : null}
      {cards.length > 0 ? (
        <BackgroundCards
          cards={cards}
          selectedId={session.selectedId}
          failedUrl={failedUrl}
          onChoose={choose}
          onReload={reloadImage}
        />
      ) : null}
    </div>
  )
}

function EpisodeVideo({
  projectId,
  episodeId,
  seekTo,
}: {
  projectId: string
  episodeId: string
  seekTo: { id: number; seconds: number; episodeId: string } | null
}) {
  const playback = useEpisodePlayback(projectId, episodeId)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const refreshing = useRef(false)
  const url = playback.data?.url
  if (playback.isPending) return <p className="text-sm text-muted-foreground">正在获取原视频…</p>
  if (playback.isError || !url || failedUrl === url) {
    return (
      <EmptyState
        title="暂时无法预览原视频"
        description={playback.isError ? episodeErrorMessage(playback.error) : '播放地址已失效，请重新获取。'}
        action={<Button onClick={() => { setFailedUrl(null); void playback.refetch() }}>重新获取</Button>}
      />
    )
  }
  return (
    <VideoPlayer
      src={url}
      type="video/mp4"
      title="原视频"
      caption="正在播放这一集的原视频。点击来源时间会跳到候选帧。"
      seekTo={seekTo && seekTo.episodeId === episodeId ? seekTo : null}
      onError={() => {
        if (refreshing.current) {
          setFailedUrl(url)
          return
        }
        refreshing.current = true
        void playback.refetch().finally(() => {
          refreshing.current = false
        })
      }}
    />
  )
}

function BackgroundStatus({
  loading,
  error,
  status,
  count,
  busy,
  supported,
  capabilityReady,
  capabilityError,
  failure,
  submitting,
  actionError,
  onRetry,
  onSubmit,
}: {
  loading: boolean
  error: unknown
  status: BackgroundAssetStatus | undefined
  count: number
  busy: boolean
  supported: boolean
  capabilityReady: boolean
  capabilityError: unknown
  failure: string | null
  submitting: boolean
  actionError: string
  onRetry: () => void
  onSubmit: () => void
}) {
  if (capabilityError && status === undefined) {
    return <EmptyState title="背景状态读取失败" description={backgroundErrorMessage(capabilityError)} action={<Button onClick={onRetry}>重新获取</Button>} />
  }
  if (loading) return <p className="text-sm text-muted-foreground">正在读取背景…</p>
  if (error) {
    return <EmptyState title="背景加载失败" description={backgroundErrorMessage(error)} action={<Button onClick={onRetry}>重新获取</Button>} />
  }
  const canStart = capabilityReady && supported && !busy && status !== 'SUCCESS' && status !== 'UNSUPPORTED'
  const note = !capabilityReady
    ? '正在确认背景是否已支持…'
    : status === 'UNSUPPORTED' || !supported
      ? '背景提取即将支持。分镜截图不会被标成无人物背景。'
      : status === 'NOT_STARTED'
        ? '这一集还没有发起背景提取。'
        : status === 'PENDING' || status === 'RUNNING'
          ? count > 0 ? '已有背景仍可查看，新的提取正在进行。' : '背景提取正在进行，完成后会出现候选图。'
          : status === 'FAILED'
            ? failure || '背景提取失败。已有的成功候选仍会保留。'
            : count > 0
              ? `背景候选 ${count} 张`
              : '这一集没有背景候选。'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm">{note}</p>
        {actionError ? <p className="text-sm text-rose-300">{actionError}</p> : null}
      </div>
      {canStart ? (
        <Button type="button" disabled={submitting} onClick={onSubmit}>
          {submitting ? '正在提交' : status === 'FAILED' ? '重试背景提取' : '提取背景'}
        </Button>
      ) : null}
    </div>
  )
}
