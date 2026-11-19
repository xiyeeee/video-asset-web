import { MediaPlayer, MediaProvider } from '@vidstack/react'
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'
import { DEMO_VIDEO_URL } from '@/lib/format'

export function VideoPlayer({
  src,
  poster,
  title,
}: {
  src: string
  poster?: string
  title: string
}) {
  const demo = src === DEMO_VIDEO_URL
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
      <MediaPlayer
        title={title}
        src={src}
        poster={poster}
        crossOrigin
        playsInline
        className="aspect-video w-full"
      >
        <MediaProvider />
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
      {demo ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">播放的是本地 5 秒演示片花，时间戳来自素材元数据，不是成片原视频。</p>
      ) : (
        <p className="px-3 py-2 text-xs text-muted-foreground">正在播放本机选择的文件，文件不会上传到服务器。</p>
      )}
    </div>
  )
}
