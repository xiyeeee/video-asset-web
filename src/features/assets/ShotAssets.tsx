import { useRef, useState } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { useFrames } from '@/features/analysis/use-analysis'
import { analysisErrorMessage, type FramePreview } from '@/services/analysis/api'

const formatStart = (timestampMs: number) => {
  const minutes = Math.floor(timestampMs / 60000)
  const seconds = Math.floor(timestampMs / 1000) % 60
  const milliseconds = timestampMs % 1000
  const clock = `${minutes}:${seconds.toString().padStart(2, '0')}`
  return milliseconds === 0 ? clock : `${clock}.${milliseconds.toString().padStart(3, '0')}`
}

export function ShotAssets({ projectId, episodeId }: { projectId: string; episodeId: string }) {
  const frames = useFrames(projectId, episodeId)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const reloading = useRef(false)
  const reload = (frame: FramePreview) => {
    if (reloading.current) {
      setFailedUrl(frame.url)
      return
    }
    reloading.current = true
    void frames.refetch().finally(() => {
      reloading.current = false
    })
  }

  if (frames.isPending) return <p className="text-sm text-muted-foreground">正在读取分镜…</p>
  if (frames.isError) {
    return <EmptyState title="分镜加载失败" description={analysisErrorMessage(frames.error)} action={<Button onClick={() => void frames.refetch()}>重新获取</Button>} />
  }
  if (frames.data.length === 0) {
    return <EmptyState title="当前集还没有分镜" description="已有的首帧结果会显示在这里。镜头切分尚未提供独立接口。" />
  }

  return (
    <div className="space-y-3">
      <h2 className="font-medium">分镜 · {frames.data.length} 条</h2>
      <p className="text-xs text-muted-foreground">当前接口返回首帧分镜。结束时间和关联人物数量尚未提供，不会用估算值填上。</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {frames.data.map((frame, index) => (
          <article key={frame.id} className="overflow-hidden rounded-2xl border border-white/10 bg-card">
            {failedUrl === frame.url ? (
              <div className="flex aspect-[4/3] items-center justify-center p-3">
                <Button type="button" variant="outline" onClick={() => { setFailedUrl(null); void frames.refetch() }}>重新获取图片</Button>
              </div>
            ) : (
              <img src={frame.url} alt={frame.name} referrerPolicy="no-referrer" className="aspect-[4/3] w-full object-cover" onError={() => reload(frame)} />
            )}
            <div className="space-y-1 p-3 text-xs text-muted-foreground">
              <p className="text-sm text-foreground">分镜 {index + 1}</p>
              <p>开始时间 {formatStart(frame.timestampMs)}</p>
              <p>视频位置 {formatStart(frame.timestampMs)}</p>
              <p>结束时间 未提供</p>
              <p>关联人物 未提供</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
