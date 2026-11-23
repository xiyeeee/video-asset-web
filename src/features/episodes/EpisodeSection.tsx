import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/common/EmptyState'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { ExtractOptions } from '@/features/extraction/ExtractOptions'
import { useExtractionCapabilities } from '@/features/extraction/use-extraction'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AuthError, isCancelled } from '@/features/auth/auth-api'
import { formatClock, formatDateTime } from '@/lib/format'
import {
  canRetryEpisodeUpload,
  episodeErrorMessage,
  episodeListPrefix,
  MAX_VIDEO_BYTES,
  type EpisodeSummary,
} from '@/services/episodes/api'
import {
  createExtractionTask,
  extractionBoardKey,
  uploadAndExtract,
  type ExtractType,
} from '@/services/extraction/api'
import { EPISODE_PAGE_SIZE, useEpisodeList, useEpisodePlayback } from './use-episodes'

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const statusLabel = (status: string) => (status === 'PENDING' ? '待解析' : status)

type UploadPhase = 'idle' | 'uploading' | 'uploaded' | 'upload-failed' | 'creating-task' | 'task-created' | 'task-failed'

const phaseLabel: Record<UploadPhase, string> = {
  idle: '待上传',
  uploading: '上传中',
  uploaded: '上传成功',
  'upload-failed': '上传失败',
  'creating-task': '创建任务中',
  'task-created': '任务创建成功',
  'task-failed': '任务创建失败',
}

export function EpisodeSection({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<EpisodeSummary | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploadKey, setUploadKey] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<unknown>(null)
  const [taskError, setTaskError] = useState<unknown>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [savedEpisodeId, setSavedEpisodeId] = useState<string | null>(null)
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [episodeNumber, setEpisodeNumber] = useState('')
  const [numberEdited, setNumberEdited] = useState(false)
  const [autoExtract, setAutoExtract] = useState(true)
  const [selectedTypes, setSelectedTypes] = useState<ExtractType[] | null>(null)
  const [localMessage, setLocalMessage] = useState('')
  const [dragging, setDragging] = useState(false)
  const [panel, setPanel] = useState<'upload' | 'episodes'>('episodes')
  const capabilities = useExtractionCapabilities()
  const uploadingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => {
    abortRef.current?.abort()
  }, [])

  const list = useEpisodeList(projectId, page)
  const current = list.data?.items.find((item) => item.id === picked?.id)
  const selected = current ?? (picked?.projectId === projectId ? picked : null) ?? list.data?.items[0] ?? null
  const pageCount = Math.max(1, Math.ceil((list.data?.total ?? 0) / (list.data?.size ?? EPISODE_PAGE_SIZE)))

  const takeFile = (next: File | undefined) => {
    if (!next || uploadingRef.current) return
    setFile(next)
    setUploadKey(crypto.randomUUID())
    setProgress(null)
    setUploadError(null)
    setTaskError(null)
    setTaskId(null)
    setSavedEpisodeId(null)
    setPhase('idle')
    setLocalMessage('')
  }

  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0]
    event.target.value = ''
    takeFile(next)
  }

  const dropFile = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    takeFile(event.dataTransfer.files[0])
  }

  const supported = (capabilities.data ?? []).filter((item) => item.supported).map((item) => item.type)
  const chosen = selectedTypes ?? supported
  const busy = phase === 'uploading' || phase === 'creating-task'
  const suggestedNumber = page === pageCount && list.data
    ? String(list.data.items.reduce((max, item) => Math.max(max, item.episodeNumber), 0) + 1)
    : ''
  const numberValue = numberEdited ? episodeNumber : episodeNumber || suggestedNumber
  const parsedNumber = /^[1-9]\d*$/.test(numberValue) ? Number(numberValue) : null

  const submit = async () => {
    if (uploadingRef.current) return
    if (autoExtract && chosen.length === 0) {
      setLocalMessage('请至少选择一种可提取的素材类型。')
      return
    }
    if (phase === 'task-failed' && savedEpisodeId) {
      uploadingRef.current = true
      setPhase('creating-task')
      setTaskError(null)
      try {
        const created = await createExtractionTask(projectId, savedEpisodeId, chosen)
        setTaskId(created.id)
        setPhase('task-created')
        setPanel('episodes')
        await queryClient.invalidateQueries({ queryKey: extractionBoardKey })
      } catch (error) {
        if (!isCancelled(error)) {
          setTaskError(error)
          setPhase('task-failed')
        }
      } finally {
        uploadingRef.current = false
      }
      return
    }
    if (!file || !uploadKey) return
    if (!parsedNumber || parsedNumber > 4294967295) {
      setLocalMessage('请填写未被占用的集号。')
      return
    }
    if (!file.name.toLowerCase().endsWith('.mp4')) {
      setLocalMessage('请检查文件是否为 MP4。')
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setLocalMessage('文件超过大小限制，单个视频不能超过 100 MiB。')
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    uploadingRef.current = true
    setPhase('uploading')
    setUploadError(null)
    setTaskError(null)
    setLocalMessage('')
    setProgress(0)
    try {
      const result = await uploadAndExtract({
        projectId,
        episodeNumber: parsedNumber,
        file,
        idempotencyKey: uploadKey,
        autoExtract,
        extractTypes: chosen,
        onProgress: (ratio) => {
          setProgress(ratio)
          if (ratio >= 1 && autoExtract) setPhase('creating-task')
        },
        signal: controller.signal,
      })
      if (result.created) {
        const last = Math.max(1, Math.ceil(((list.data?.total ?? 0) + 1) / EPISODE_PAGE_SIZE))
        setPage(last)
      }
      setSavedEpisodeId(result.episodeId)
      if (result.episode) setPicked(result.episode)
      setFile(null)
      setUploadKey(null)
      setProgress(null)
      await queryClient.invalidateQueries({ queryKey: episodeListPrefix(projectId) })
      if (result.taskError) {
        setTaskError(result.taskError)
        setPhase('task-failed')
      } else if (result.autoExtract) {
        setTaskId(result.taskId)
        setPhase('task-created')
        setPanel('episodes')
        await queryClient.invalidateQueries({ queryKey: extractionBoardKey })
      } else {
        setPhase('uploaded')
        setPanel('episodes')
      }
    } catch (error) {
      if (isCancelled(error)) return
      setUploadError(error)
      setPhase('upload-failed')
    } finally {
      uploadingRef.current = false
    }
  }

  const message = localMessage || (uploadError ? episodeErrorMessage(uploadError) : '')
  const sameKeyBlocked = uploadError instanceof AuthError
    && (uploadError.code === 'VIDEO_UPLOAD_CONFLICT' || uploadError.status === 409)

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-card p-4">
        <Tabs
          value={panel}
          onValueChange={(value) => {
            if (value === 'upload' || value === 'episodes') setPanel(value)
          }}
          className="min-h-0 flex-1 gap-3 overflow-hidden"
        >
        <TabsList className="grid w-full shrink-0 grid-cols-2">
          <TabsTrigger value="upload">上传</TabsTrigger>
          <TabsTrigger value="episodes">集数</TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="min-h-0 overflow-y-auto">
        <div className="space-y-3">
        <label className="block text-sm">
          集号
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-background/40 px-3 py-2"
            inputMode="numeric"
            value={numberValue}
            disabled={busy}
            onChange={(event) => {
              setNumberEdited(true)
              setEpisodeNumber(event.target.value.trim())
            }}
          />
        </label>
        <label
          className={`flex flex-col items-center gap-1 rounded-xl border border-dashed px-3 py-4 text-center ${dragging ? 'border-violet-300 bg-violet-400/10' : 'border-white/20 bg-background/40'} ${busy ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
          onDragEnter={(event) => {
            event.preventDefault()
            if (!busy) setDragging(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (!busy) setDragging(true)
          }}
          onDragLeave={(event) => {
            const next = event.relatedTarget
            if (next instanceof Node && event.currentTarget.contains(next)) return
            setDragging(false)
          }}
          onDrop={dropFile}
        >
          <Upload className="size-5 text-violet-200" />
          <span className="text-sm">{dragging ? '松开即可选择' : '拖拽 MP4 到这里，或点击选择'}</span>
          <span className="truncate text-xs text-muted-foreground">
            {file ? `${file.name} · ${formatBytes(file.size)}` : '单个视频不超过 100 MiB'}
          </span>
          <input className="sr-only" type="file" accept=".mp4,video/mp4" disabled={busy} onChange={pickFile} />
        </label>
        <ExtractOptions
          capabilities={capabilities.data}
          loading={capabilities.isPending}
          error={capabilities.error}
          onRetry={() => void capabilities.refetch()}
          autoExtract={autoExtract}
          onAutoExtract={setAutoExtract}
          selected={chosen}
          onSelected={setSelectedTypes}
          disabled={busy}
        />
        {file || phase !== 'idle' ? (
          <div className="space-y-2 rounded-xl border border-white/10 bg-background/40 p-3">
            <p className="text-xs text-violet-200">{phaseLabel[phase]}</p>
            {phase === 'uploading' ? (
              <>
                <Progress value={Math.round((progress ?? 0) * 100)} />
                <p className="text-xs text-violet-200">
                  {(progress ?? 0) >= 1 ? '文件已传完，正在保存' : `已上传 ${Math.round((progress ?? 0) * 100)}%`}
                </p>
              </>
            ) : null}
            {message ? <p className="text-xs text-rose-300">{message}</p> : null}
            {taskError ? <p className="text-xs text-rose-300">{taskError instanceof AuthError ? taskError.message : '任务创建失败，视频已保留，可以重试创建任务。'}</p> : null}
            {phase === 'uploaded' ? <p className="text-xs text-muted-foreground">视频已保存。未创建提取任务。</p> : null}
            {phase === 'task-created' && taskId ? <p className="text-xs text-muted-foreground">任务 {taskId} 已创建，提取会在后台继续。</p> : null}
            <div className="flex flex-wrap gap-2">
              {(phase === 'task-failed' || (file && !(uploadError && canRetryEpisodeUpload(uploadError)))) ? (
                <Button type="button" size="sm" disabled={busy || sameKeyBlocked || (autoExtract && (capabilities.isPending || chosen.length === 0))} onClick={() => void submit()}>
                  {phase === 'creating-task' ? '正在创建任务' : phase === 'uploading' ? '正在上传' : phase === 'task-failed' ? '重试创建任务' : '确认上传'}
                </Button>
              ) : null}
              {uploadError && canRetryEpisodeUpload(uploadError) ? (
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void submit()}>
                  使用原文件重试
                </Button>
              ) : null}
              {phase === 'task-created' ? (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link to="/tasks">前往任务中心</Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        </div>
        </TabsContent>
        <TabsContent value="episodes" className="flex min-h-0 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {list.isLoading ? <p className="text-sm text-muted-foreground">正在读取集数…</p> : null}
        {list.isError ? (
          <EmptyState
            title="集数加载失败"
            description={episodeErrorMessage(list.error)}
            action={<Button onClick={() => void list.refetch()}>重试</Button>}
          />
        ) : null}
        {list.data && list.data.items.length === 0 ? (
          <EmptyState title="暂无集数" description="上传一份 MP4 后，刷新页面仍然可以在这里看到。" />
        ) : null}
        {list.data && list.data.items.length > 0 ? (
          <div className="space-y-2">
            {list.data.items.map((episode) => {
              const active = episode.id === selected?.id
              return (
                <button
                  key={episode.id}
                  type="button"
                  className={`w-full rounded-xl border px-3 py-2 text-left ${active ? 'border-violet-300/60 bg-violet-400/10' : 'border-white/10 bg-background/40'}`}
                  onClick={() => setPicked(episode)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">第 {episode.episodeNumber} 集 · {episode.title}</span>
                    <span className="shrink-0 text-xs text-violet-200">{statusLabel(episode.status)}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{episode.originalFilename}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatBytes(episode.sizeBytes)} · {episode.durationMs === null ? '时长待识别' : formatClock(episode.durationMs / 1000)} · {formatDateTime(episode.uploadedAt)}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
        </div>
        {pageCount > 1 ? (
          <div className="mt-3 flex shrink-0 items-center justify-between text-sm text-muted-foreground">
            <span>第 {page} / {pageCount} 页</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>上一页</Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>下一页</Button>
            </div>
          </div>
        ) : null}
        </TabsContent>
        </Tabs>
      </section>
      <div className="min-h-0 self-start lg:sticky lg:top-0">
        <EpisodePreview projectId={projectId} episode={selected} />
      </div>
    </div>
  )
}

function EpisodePreview({ projectId, episode }: { projectId: string; episode: EpisodeSummary | null }) {
  const playback = useEpisodePlayback(projectId, episode?.id)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const refreshing = useRef(false)
  const url = playback.data?.url
  const failed = Boolean(url && failedUrl === url)

  if (!episode) {
    return <EmptyState title="选择一集后预览" description="上传或点选集数后，才会获取这一集的播放地址。" />
  }

  let preview = (
    <EmptyState
      title="暂时无法播放"
      description={playback.isError ? episodeErrorMessage(playback.error) : '播放地址已失效，请重新获取。'}
      action={<Button onClick={() => { setFailedUrl(null); void playback.refetch() }}>重新获取</Button>}
    />
  )
  if (playback.isPending) {
    preview = <EmptyState title="正在获取播放地址" description={`准备播放第 ${episode.episodeNumber} 集。`} />
  } else if (url && !failed && !playback.isError) {
    const caption = episode.durationMs === null
      ? '正在播放已保存的原视频。服务端尚未记录时长，进度以播放器读取的媒体时长为准。'
      : '正在播放已保存的原视频。'
    preview = (
      <VideoPlayer
        src={url}
        type={episode.contentType}
        title={episode.title}
        caption={caption}
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

  return (
    <div className="space-y-3">
      <div className="mx-auto w-full max-w-[calc((100svh-18rem)*16/9)]">
        {preview}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" asChild>
          <Link to={`/analysis?project=${projectId}&episode=${episode.id}`}>解析这一集</Link>
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link to={`/assets?project=${projectId}&episode=${episode.id}`}>查看素材</Link>
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link to="/tasks">任务中心</Link>
        </Button>
      </div>
    </div>
  )
}
