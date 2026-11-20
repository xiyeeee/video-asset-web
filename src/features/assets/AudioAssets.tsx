import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { z } from 'zod'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { authorizedRequest } from '@/features/auth/auth-api'
import { useExtractionCapabilities } from '@/features/extraction/use-extraction'
import { formatMediaTime } from '@/features/shots/timeline'
import { shotErrorMessage } from '@/services/shots/api'
import { UnavailableAssets } from './UnavailableAssets'

const audioSchema = z.object({
  assetId: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  expiresInSeconds: z.number().positive(),
  details: z.object({
    audioType: z.string(),
    startMs: z.number().int().nullable(),
    endMs: z.number().int().nullable(),
    audioUrl: z.string().url(),
  }),
})

const pageSchema = z.object({
  items: z.array(audioSchema),
  total: z.number().int().nonnegative(),
  status: z.enum(['NOT_STARTED', 'UNSUPPORTED', 'PENDING', 'RUNNING', 'SUCCESS', 'FAILED']),
})

const http = axios.create({ timeout: 15_000 })

const audioTypeName = (type: string) => (type === 'ORIGINAL_TRACK' ? '原音轨' : type)

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AudioAssets({ episodeId }: { episodeId: string }) {
  const capabilities = useExtractionCapabilities()
  const supported = capabilities.data?.some((item) => item.type === 'AUDIO' && item.supported) === true
  const audio = useQuery({
    queryKey: ['audio-assets', episodeId],
    enabled: supported && /^[1-9]\d*$/.test(episodeId),
    queryFn: ({ signal }) => authorizedRequest(
      (authorization) => http.get(`/api/media/episodes/${episodeId}/assets`, {
        signal,
        headers: { Authorization: authorization },
        params: { type: 'AUDIO', pageNum: 1, pageSize: 20 },
      }),
      pageSchema,
    ).then((result) => result.data),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'PENDING' || status === 'RUNNING' ? 2_500 : false
    },
  })

  if (capabilities.isPending) return <p className="text-sm text-muted-foreground">正在确认音频是否已支持…</p>
  if (!supported) {
    return (
      <UnavailableAssets
        type="AUDIO"
        title="音频"
        description="人物语音、音乐、音效和环境声还不能提取。当前可提取的是原音轨。"
      />
    )
  }
  if (audio.isPending) return <p className="text-sm text-muted-foreground">正在读取音频…</p>
  if (audio.isError) {
    return <EmptyState title="音频加载失败" description={shotErrorMessage(audio.error)} action={<Button onClick={() => void audio.refetch()}>重新获取</Button>} />
  }
  if (!audio.data || audio.data.items.length === 0) {
    const description = audio.data?.status === 'PENDING' || audio.data?.status === 'RUNNING'
      ? '原音轨正在提取。'
      : audio.data?.status === 'FAILED'
        ? '原音轨提取失败。'
        : '这一集还没有可播放的音频。'
    return <EmptyState title="暂无音频" description={description} />
  }

  return (
    <div className="space-y-3">
      <h2 className="font-medium">音频 · {audio.data.total} 条</h2>
      {audio.data.items.map((item) => {
        const start = item.details.startMs
        const end = item.details.endMs
        return (
          <article key={item.assetId} className="space-y-2 rounded-2xl border border-white/10 bg-card p-4">
            <p className="text-sm">{audioTypeName(item.details.audioType)}</p>
            <p className="text-xs text-muted-foreground">
              {start !== null && end !== null ? `${formatMediaTime(start)} – ${formatMediaTime(end)} · ` : ''}
              {formatBytes(item.sizeBytes)}
            </p>
            <audio controls preload="none" src={item.details.audioUrl} className="w-full" />
            <Button type="button" size="sm" variant="outline" asChild>
              <a href={item.details.audioUrl} download referrerPolicy="no-referrer">下载</a>
            </Button>
          </article>
        )
      })}
    </div>
  )
}
