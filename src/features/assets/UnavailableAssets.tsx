import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { useExtractionCapabilities } from '@/features/extraction/use-extraction'
import { characterErrorMessage } from '@/services/characters/api'
import { type ExtractType } from '@/services/extraction/api'

export function UnavailableAssets({
  type,
  title,
  description,
}: {
  type: ExtractType
  title: string
  description: string
}) {
  const capabilities = useExtractionCapabilities()
  if (capabilities.isPending) return <p className="text-sm text-muted-foreground">正在确认{title}是否已支持…</p>
  if (capabilities.isError) {
    return (
      <EmptyState
        title={`${title}状态读取失败`}
        description={characterErrorMessage(capabilities.error)}
        action={<Button onClick={() => void capabilities.refetch()}>重新获取</Button>}
      />
    )
  }
  const supported = capabilities.data?.find((item) => item.type === type)?.supported === true
  if (!supported) {
    return <EmptyState title={`${title}即将支持`} description={description} />
  }
  return <EmptyState title={`暂无${title}素材`} description="提取能力已开放，但这一集还没有可展示的结果。" />
}
