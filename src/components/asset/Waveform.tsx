import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Waveform({ url, compact = false }: { url: string; compact?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<WaveSurfer | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const player = WaveSurfer.create({
      container: host,
      url,
      height: compact ? 36 : 64,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      cursorWidth: 0,
      waveColor: '#8b5cf6',
      progressColor: '#c4b5fd',
    })
    player.on('play', () => setPlaying(true))
    player.on('pause', () => setPlaying(false))
    player.on('finish', () => setPlaying(false))
    playerRef.current = player
    return () => {
      player.destroy()
      playerRef.current = null
    }
  }, [compact, url])

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        onClick={(event) => {
          event.stopPropagation()
          void playerRef.current?.playPause()
        }}
      >
        {playing ? <Pause /> : <Play />}
        <span className="sr-only">{playing ? '暂停' : '试听'}</span>
      </Button>
      <div ref={hostRef} className="min-w-0 flex-1" />
    </div>
  )
}
