import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AuthError, isCancelled } from '@/features/auth/auth-api'
import { formatClock, formatDateTime } from '@/lib/format'
import {
  canRetryEpisodeUpload,
  episodeErrorMessage,
  episodeListPrefix,
  MAX_VIDEO_BYTES,
  uploadEpisode,
  type EpisodeSummary,
} from '@/services/episodes/api'
import { EPISODE_PAGE_SIZE, useEpisodeList, useEpisodePlayback } from './use-episodes'

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const statusLabel = (status: string) => (status === 'PENDING' ? '待解析' : status)

export function EpisodeSection({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [picked, setPicked] = useState<EpisodeSummary | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploadKey, setUploadKey] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<unknown>(null)
  const [localMessage, setLocalMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const uploadingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => {
    abortRef.current?.abort()
  }, [])

  const list = useEpisodeList(projectId, page)
  const current = list.data?.items.find((item) => item.id === picked?.id)
  const selected = current ?? (picked?.projectId === projectId ? picked : null) ?? list.data?.items[0] ?? null
  const pageCount = Math.max(1, Math.ceil((list.data?.total ?? 0) / (list.data?.size ?? EPISODE_PAGE_SIZE)))

  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0]
    event.target.value = ''
    if (!next || uploadingRef.current) return
    setFile(next)
    setUploadKey(crypto.randomUUID())
    setProgress(null)
    setUploadError(null)
    setLocalMessage('')
  }

  const submit = async () => {
    if (!file || !uploadKey || uploadingRef.current) return
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
    setUploading(true)
    setUploadError(null)
    setLocalMessage('')
    setProgress(0)
    try {
      const result = await uploadEpisode(projectId, file, uploadKey, setProgress, controller.signal)
      if (result.created) {
        const last = Math.max(1, Math.ceil(((list.data?.total ?? 0) + 1) / EPISODE_PAGE_SIZE))
        setPage(last)
      }
      setPicked(result.episode)
      setFile(null)
      setUploadKey(null)
      setProgress(null)
      await queryClient.invalidateQueries({ queryKey: episodeListPrefix(projectId) })
    } catch (error) {
      if (isCancelled(error)) return
      setUploadError(error)
    } finally {
      uploadingRef.current = false
      setUploading(false)
    }
  }

  const message = localMessage || (uploadError ? episodeErrorMessage(uploadError) : '')
  const sameKeyBlocked = uploadError instanceof AuthError
    && (uploadError.code === 'VIDEO_UPLOAD_CONFLICT' || uploadError.status === 409)

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <section className="space-y-3 rounded-2xl border border-white/10 bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">集数</h3>
          <Button type="button" size="sm" variant="outline" disabled={uploading} asChild>
            <label>
              <Upload />
              选择 MP4
              <input className="sr-only" type="file" accept=".mp4,video/mp4" disabled={uploading} onChange={pickFile} />
            </label>
          </Button>
        </div>
        {file ? (
          <div className="space-y-2 rounded-xl border border-white/10 bg-background/40 p-3">
            <p className="truncate text-sm">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            {uploading ? (
              <>
                <Progress value={Math.round((progress ?? 0) * 100)} />
                <p className="text-xs text-violet-200">
                  {(progress ?? 0) >= 1 ? '文件已传完，正在保存' : `已上传 ${Math.round((progress ?? 0) * 100)}%`}
                </p>
              </>
            ) : null}
            {message ? <p className="text-xs text-rose-300">{message}</p> : null}
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={uploading || sameKeyBlocked} onClick={() => void submit()}>
                {uploading ? '正在上传' : '上传'}
              </Button>
              {uploadError && canRetryEpisodeUpload(uploadError) ? (
                <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => void submit()}>
                  使用原文件重试
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
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
        {pageCount > 1 ? (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>第 {page} / {pageCount} 页</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>上一页</Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>下一页</Button>
            </div>
          </div>
        ) : null}
      </section>
      <EpisodePreview projectId={projectId} episode={selected} />
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
  if (playback.isPending) {
    return <EmptyState title="正在获取播放地址" description={`准备播放第 ${episode.episodeNumber} 集。`} />
  }
  if (playback.isError || !url || failed) {
    return (
      <EmptyState
        title="暂时无法播放"
        description={playback.isError ? episodeErrorMessage(playback.error) : '播放地址已失效，请重新获取。'}
        action={<Button onClick={() => { setFailedUrl(null); void playback.refetch() }}>重新获取</Button>}
      />
    )
  }

  const caption = episode.durationMs === null
    ? '正在播放已保存的原视频。服务端尚未记录时长，进度以播放器读取的媒体时长为准。'
    : '正在播放已保存的原视频。'

  return (
    <div className="space-y-3">
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
      <Button type="button" variant="outline" asChild>
        <Link to={`/analysis?project=${projectId}&episode=${episode.id}`}>解析这一集</Link>
      </Button>
    </div>
  )
}
