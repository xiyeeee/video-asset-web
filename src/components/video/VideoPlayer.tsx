import { useEffect, useRef, useState } from 'react'
import { MediaPlayer, MediaProvider, type MediaPlayerInstance } from '@vidstack/react'
import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'
import { DEMO_VIDEO_URL } from '@/lib/format'

const videoTypes = ['video/mp4', 'video/webm', 'video/3gp', 'video/ogg', 'video/avi', 'video/mpeg', 'video/object'] as const

const isVideoType = (value: string): value is (typeof videoTypes)[number] =>
  videoTypes.some((item) => item === value)

export function VideoPlayer({
  src,
  type,
  poster,
  title,
  caption,
  seekTo,
  onError,
}: {
  src: string
  type?: string
  poster?: string
  title: string
  caption?: string
  seekTo?: { id: number; seconds: number } | null
  onError?: () => void
}) {
  const playerRef = useRef<MediaPlayerInstance>(null)
  const [positionableSrc, setPositionableSrc] = useState(src)
  const [positionable, setPositionable] = useState(false)
  if (positionableSrc !== src) {
    setPositionableSrc(src)
    setPositionable(false)
  }
  useEffect(() => {
    const player = playerRef.current
    if (!seekTo || !positionable || !player?.state.canSeek) return
    player.currentTime = seekTo.seconds
  }, [positionable, seekTo])
  const demo = src === DEMO_VIDEO_URL
  const local = src.startsWith('blob:')
  const source = type && isVideoType(type) ? { src, type } : src
  const note = demo
    ? '播放的是本地 5 秒演示片花，时间戳来自素材元数据，不是成片原视频。'
    : local
      ? '正在播放本机选择的文件，文件不会上传到服务器。'
      : caption
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
      <MediaPlayer
        ref={playerRef}
        key={src}
        title={title}
        src={source}
        poster={poster}
        crossOrigin
        playsInline
        load="eager"
        className="aspect-video w-full"
        onCanPlay={() => {
          if (playerRef.current?.state.canSeek) setPositionable(true)
        }}
        onError={onError}
      >
        <MediaProvider />
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
      {note ? <p className="px-3 py-2 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  )
}
