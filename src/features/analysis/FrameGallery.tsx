import { useRef, useState } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatClock } from '@/lib/format'
import { analysisErrorMessage, type FramePreview } from '@/services/analysis/api'
import { useFrames } from './use-analysis'

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FrameGallery({ projectId, episodeId }: { projectId: string; episodeId: string }) {
  const frames = useFrames(projectId, episodeId)
  const [opened, setOpened] = useState<FramePreview | null>(null)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const reloading = useRef(false)

  const reload = (url: string) => {
    if (reloading.current) {
      setFailedUrl(url)
      return
    }
    reloading.current = true
    void frames.refetch().finally(() => {
      reloading.current = false
    })
  }

  if (frames.isPending) return <p className="text-sm text-muted-foreground">正在读取分镜…</p>
  if (frames.isError) {
    return (
      <EmptyState
        title="分镜加载失败"
        description={analysisErrorMessage(frames.error)}
        action={<Button onClick={() => void frames.refetch()}>重新获取</Button>}
      />
    )
  }
  if (frames.data.length === 0) {
    return <EmptyState title="当前集还没有分镜" description="解析成功后，这一集会出现可预览的首帧。" />
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {frames.data.map((frame) => (
          <article key={frame.id} className="overflow-hidden rounded-2xl border border-white/10 bg-card">
            {failedUrl === frame.url ? (
              <div className="flex aspect-[4/3] items-center justify-center p-3">
                <Button type="button" variant="outline" onClick={() => { setFailedUrl(null); void frames.refetch() }}>重新获取图片</Button>
              </div>
            ) : (
              <button type="button" className="block w-full" onClick={() => setOpened(frame)}>
                <img
                  src={frame.url}
                  alt={frame.name}
                  referrerPolicy="no-referrer"
                  className="aspect-[4/3] w-full object-cover"
                  onError={() => reload(frame.url)}
                />
              </button>
            )}
            <div className="space-y-1 p-3">
              <p className="truncate text-sm">{frame.name}</p>
              <p className="text-xs text-muted-foreground">{formatClock(frame.timestampMs / 1000)} · {formatBytes(frame.sizeBytes)}</p>
            </div>
          </article>
        ))}
      </div>
      <Dialog open={Boolean(opened)} onOpenChange={(open) => { if (!open) setOpened(null) }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{opened?.name ?? '分镜'}</DialogTitle></DialogHeader>
          {opened && failedUrl !== opened.url ? (
            <img src={opened.url} alt={opened.name} referrerPolicy="no-referrer" className="w-full rounded-xl" onError={() => reload(opened.url)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
