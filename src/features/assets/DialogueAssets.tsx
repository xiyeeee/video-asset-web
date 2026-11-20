import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { DialogueLines } from '@/features/dialogue/DialogueLines'
import { DialogueTimeline } from '@/features/dialogue/DialogueTimeline'
import {
  activeDialogue,
  nextSeek,
  openEpisode,
  speakerKey,
  speakerLabel,
  switchEpisode,
  timelineDurationMs,
  type DialogueLine,
} from '@/features/dialogue/timeline'
import { useDialogueAssets, useDialogueTask } from '@/features/dialogue/use-dialogue'
import { useEpisodePlayback } from '@/features/episodes/use-episodes'
import { isCancelled } from '@/features/auth/auth-api'
import { useExtractionCapabilities } from '@/features/extraction/use-extraction'
import { dialogueAssetKey, dialogueErrorMessage, type DialogueAssetStatus } from '@/services/dialogue/api'
import { episodeErrorMessage } from '@/services/episodes/api'
import { createExtractionTask, extractionBoardKey, extractionFailureText, retryExtractionTask } from '@/services/extraction/api'

export function DialogueAssets({ projectId, episodeId }: { projectId: string; episodeId: string }) {
  const queryClient = useQueryClient()
  const dialogue = useDialogueAssets(episodeId)
  const capabilities = useExtractionCapabilities()
  const supported = capabilities.data?.some((item) => item.type === 'DIALOGUE' && item.supported) === true
  const assetActive = dialogue.data?.status === 'PENDING' || dialogue.data?.status === 'RUNNING'
  const task = useDialogueTask(episodeId, assetActive)
  const [session, setSession] = useState(() => openEpisode(episodeId))
  const [mediaSeconds, setMediaSeconds] = useState<number | null>(null)
  const [mediaEpisode, setMediaEpisode] = useState(episodeId)
  const [speaker, setSpeaker] = useState('all')
  const [actionError, setActionError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  if (session.episodeId !== episodeId) setSession(switchEpisode(session, episodeId))
  if (mediaEpisode !== episodeId) {
    setMediaEpisode(episodeId)
    setMediaSeconds(null)
    setSpeaker('all')
  }

  const lines = dialogue.data?.lines ?? []
  const visible = speaker === 'all' ? lines : lines.filter((line) => speakerKey(line.speakerId) === speaker)
  const durationMs = timelineDurationMs(lines, mediaSeconds === null ? null : Math.round(mediaSeconds * 1000))
  const activeIds = new Set(activeDialogue(visible, session.timeMs).map((line) => line.assetId))
  const busy = assetActive || task.data?.status === 'PENDING' || task.data?.status === 'RUNNING'
  const speakers = [...new Map(lines.map((line) => [speakerKey(line.speakerId), speakerLabel(line.speakerId)])).entries()]

  const choose = (line: DialogueLine) => {
    setSession((current) => ({
      ...current,
      selectedId: line.assetId,
      seek: nextSeek(current.seek, episodeId, line),
    }))
  }

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    setActionError('')
    try {
      if (task.data && (task.data.status === 'FAILED' || task.data.status === 'PARTIAL_SUCCESS')) {
        await retryExtractionTask(task.data)
      } else {
        await createExtractionTask(projectId, episodeId, ['DIALOGUE'])
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: dialogueAssetKey(episodeId) }),
        queryClient.invalidateQueries({ queryKey: ['dialogue-task', episodeId] }),
        queryClient.invalidateQueries({ queryKey: extractionBoardKey }),
      ])
    } catch (error) {
      if (!isCancelled(error)) setActionError(dialogueErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <DialogueStatus
        loading={dialogue.isPending}
        error={dialogue.error}
        status={dialogue.data?.status}
        count={lines.length}
        busy={busy}
        supported={supported}
        capabilityReady={!capabilities.isPending}
        capabilityError={capabilities.error}
        failure={extractionFailureText(task.data?.errorMessage ?? null)}
        submitting={submitting}
        actionError={actionError}
        onRetry={() => {
          if (capabilities.isError) void capabilities.refetch()
          if (dialogue.isError || !capabilities.isError) void dialogue.refetch()
        }}
        onSubmit={() => void submit()}
      />
      {supported ? (
        <EpisodeVideo
          projectId={projectId}
          episodeId={episodeId}
          seekTo={session.seek}
          onTimeUpdate={(seconds) => setSession((current) => current.episodeId === episodeId ? { ...current, timeMs: Math.floor(seconds * 1000) } : current)}
          onDuration={setMediaSeconds}
        />
      ) : null}
      {lines.length > 0 ? (
        <>
          <label className="block max-w-xs text-sm text-muted-foreground">
            说话人
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-card px-3 py-2 text-sm text-foreground"
              value={speakers.some(([key]) => key === speaker) || speaker === 'all' ? speaker : 'all'}
              onChange={(event) => setSpeaker(event.target.value)}
            >
              <option value="all">全部说话人</option>
              {speakers.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          {visible.length > 0 && durationMs > 0 ? (
            <DialogueTimeline
              lines={visible}
              durationMs={durationMs}
              selectedId={session.selectedId}
              activeIds={activeIds}
              onChoose={choose}
            />
          ) : (
            <p className="text-sm text-muted-foreground">这个说话人没有对白。</p>
          )}
          <DialogueLines lines={visible} selectedId={session.selectedId} activeIds={activeIds} onChoose={choose} />
        </>
      ) : null}
    </div>
  )
}

function EpisodeVideo({
  projectId,
  episodeId,
  seekTo,
  onTimeUpdate,
  onDuration,
}: {
  projectId: string
  episodeId: string
  seekTo: { id: number; seconds: number } | null
  onTimeUpdate: (seconds: number) => void
  onDuration: (seconds: number) => void
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
      caption="正在播放这一集的原视频。点击对白会跳到该句的开始时间。"
      seekTo={seekTo}
      onTimeUpdate={onTimeUpdate}
      onDuration={onDuration}
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

function DialogueStatus({
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
  status: DialogueAssetStatus | undefined
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
    return <EmptyState title="对话状态读取失败" description={dialogueErrorMessage(capabilityError)} action={<Button onClick={onRetry}>重新获取</Button>} />
  }
  if (loading) return <p className="text-sm text-muted-foreground">正在读取对话…</p>
  if (error) {
    return <EmptyState title="对话加载失败" description={dialogueErrorMessage(error)} action={<Button onClick={onRetry}>重新获取</Button>} />
  }
  const canStart = capabilityReady && supported && !busy && status !== 'SUCCESS' && status !== 'UNSUPPORTED'
  const note = !capabilityReady
    ? '正在确认对话是否已支持…'
    : status === 'UNSUPPORTED' || !supported
      ? '对话提取即将支持。'
      : status === 'NOT_STARTED'
        ? '这一集还没有发起对白提取。'
        : status === 'PENDING' || status === 'RUNNING'
          ? count > 0 ? '已有对白仍可查看，新的提取正在进行。' : '对白提取正在进行，完成后会出现台词。'
          : status === 'FAILED'
            ? failure || '对白提取失败。已有的成功台词仍会保留。'
            : count > 0
              ? `对白 ${count} 句`
              : '这一集没有识别到对白。'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm">{note}</p>
        {actionError ? <p className="text-sm text-rose-300">{actionError}</p> : null}
      </div>
      {canStart ? (
        <Button type="button" disabled={submitting} onClick={onSubmit}>
          {submitting ? '正在提交' : status === 'FAILED' ? '重试对白提取' : '提取对白'}
        </Button>
      ) : null}
    </div>
  )
}
