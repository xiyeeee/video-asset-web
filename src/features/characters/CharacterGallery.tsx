import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { characterErrorMessage, type CharacterAsset } from '@/services/characters/api'
import { useCharacterAssets, useCharacterTask } from './use-characters'

const cutoutBackground = {
  backgroundColor: '#d5d8e2',
  backgroundImage:
    'linear-gradient(45deg, #9aa3b8 25%, transparent 25%), linear-gradient(-45deg, #9aa3b8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #9aa3b8 75%), linear-gradient(-45deg, transparent 75%, #9aa3b8 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatSourceTime = (timestampMs: number) => {
  const minutes = Math.floor(timestampMs / 60000)
  const seconds = Math.floor(timestampMs / 1000) % 60
  const milliseconds = timestampMs % 1000
  const clock = `${minutes}:${seconds.toString().padStart(2, '0')}`
  return milliseconds === 0 ? clock : `${clock}.${milliseconds.toString().padStart(3, '0')}`
}

const saveBlob = (href: string, filename: string) => {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.rel = 'noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

const downloadAsset = async (asset: CharacterAsset) => {
  const filename = `character-${asset.timestampMs}-${asset.frameCharacterNumber}.png`
  try {
    const response = await fetch(asset.url, { referrerPolicy: 'no-referrer' })
    if (!response.ok) throw new Error('download failed')
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    saveBlob(objectUrl, filename)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  } catch {
    const anchor = document.createElement('a')
    anchor.href = asset.url
    anchor.target = '_blank'
    anchor.rel = 'noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }
}

export function CharacterGallery({
  projectId,
  episodeId,
  onSeek,
  episodeLabel,
}: {
  projectId: string
  episodeId: string
  onSeek?: (timestampMs: number) => void
  episodeLabel?: string
}) {
  const task = useCharacterTask(projectId, episodeId)
  const [page, setPage] = useState(1)
  const assets = useCharacterAssets(projectId, episodeId, page)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState('')
  const reloading = useRef(false)
  const extracting = task.data?.status === 'PENDING' || task.data?.status === 'RUNNING'
  const scrollerRef = useRef<HTMLDivElement>(null)
  const pageCount = assets.data ? Math.max(1, Math.ceil(assets.data.total / assets.data.size)) : 1

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: 0 })
  }, [page])

  const reload = (url: string) => {
    if (reloading.current) {
      setFailedUrl(url)
      return
    }
    reloading.current = true
    void assets.refetch().finally(() => {
      reloading.current = false
    })
  }

  const download = (asset: CharacterAsset) => {
    setDownloadError('')
    void downloadAsset(asset).catch(() => {
      setDownloadError('下载失败，请稍后重新获取图片。')
    })
  }

  if (assets.isPending || task.isPending) return <p className="text-sm text-muted-foreground">正在读取人物素材…</p>
  if (assets.isError) {
    return (
      <EmptyState
        title="人物素材加载失败"
        description={characterErrorMessage(assets.error)}
        action={<Button onClick={() => void assets.refetch()}>重新获取</Button>}
      />
    )
  }
  if (assets.data.items.length === 0 && task.isError) {
    return (
      <EmptyState
        title="人物素材状态读取失败"
        description={characterErrorMessage(task.error)}
        action={<Button onClick={() => void task.refetch()}>重新获取</Button>}
      />
    )
  }
  if (assets.data.items.length === 0) {
    if (extracting) {
      return <EmptyState title="正在提取人物素材" description="完成后，这一集会出现可预览的透明图片。" />
    }
    const detectedNone = task.data?.status === 'SUCCEEDED' && task.data.assetCount === 0
    return (
      <EmptyState
        title="未提取到人物素材"
        description={detectedNone ? '此视频未检测到人物。' : '当前集没有可预览的人物图片。'}
      />
    )
  }

  return (
    <div className="flex flex-col xl:h-full xl:min-h-0">
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">人物素材{assets.data ? ` · ${assets.data.total} 张` : ''}</h2>
        {assets.data && pageCount > 1 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>第 {page} / {pageCount} 页</span>
            <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>上一页</Button>
            <Button type="button" variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>下一页</Button>
          </div>
        ) : null}
      </div>
      <div ref={scrollerRef} className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
      {downloadError ? <p className="mb-3 text-sm text-rose-300">{downloadError}</p> : null}
      <div className={`grid grid-cols-3 gap-3 xl:grid-cols-5 ${assets.isPlaceholderData ? 'opacity-60' : ''}`}>
        {assets.data.items.map((asset) => {
          const sourceTime = formatSourceTime(asset.timestampMs)
          return (
            <article key={asset.id} className="overflow-hidden rounded-2xl border border-white/10 bg-card">
              {failedUrl === asset.url ? (
                <div className="flex h-36 items-center justify-center p-2">
                  <Button type="button" variant="outline" onClick={() => { setFailedUrl(null); void assets.refetch() }}>重新获取图片</Button>
                </div>
              ) : (
                <div className="flex h-36 items-center justify-center p-2" style={cutoutBackground}>
                  <img
                    src={asset.url}
                    alt={`人物素材 ${sourceTime}`}
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain"
                    onError={() => reload(asset.url)}
                  />
                </div>
              )}
              <div className="space-y-2 p-3">
                {onSeek ? (
                  <button
                    type="button"
                    className="text-sm text-violet-100 underline-offset-2 hover:underline"
                    onClick={() => onSeek(asset.timestampMs)}
                  >
                    来源时间 {sourceTime}
                  </button>
                ) : (
                  <p className="text-sm text-violet-100">出现时间 {sourceTime}</p>
                )}
                <p className="text-xs text-muted-foreground">{episodeLabel ? `${episodeLabel} · ` : ''}来源帧 {asset.sourceFrame}</p>
                <p className="text-xs text-muted-foreground">名称未识别 · 帧内第 {asset.frameCharacterNumber} 人 · {formatBytes(asset.sizeBytes)} · 待归组</p>
                <Button type="button" size="sm" variant="outline" onClick={() => download(asset)}>下载</Button>
              </div>
            </article>
          )
        })}
      </div>
      </div>
    </div>
  )
}
