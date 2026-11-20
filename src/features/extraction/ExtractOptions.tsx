import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { characterErrorMessage } from '@/services/characters/api'
import {
  extractTypeName,
  extractTypes,
  type ExtractType,
  type ExtractionCapability,
} from '@/services/extraction/api'

const descriptions: Record<ExtractType, string> = {
  SHOT: '镜头切分、关键帧',
  CHARACTER: '人物检测、人物素材',
  DIALOGUE: '台词、说话人、时间戳',
  BACKGROUND: '场景背景、人物移除',
  AUDIO: '人物语音、音乐、音效',
  STORY: '剧情事件、人物动作',
}

export function ExtractOptions({
  capabilities,
  loading,
  error,
  onRetry,
  autoExtract,
  onAutoExtract,
  selected,
  onSelected,
  disabled,
}: {
  capabilities: ExtractionCapability[] | undefined
  loading: boolean
  error: unknown
  onRetry: () => void
  autoExtract: boolean
  onAutoExtract: (value: boolean) => void
  selected: ExtractType[]
  onSelected: (types: ExtractType[]) => void
  disabled: boolean
}) {
  const supported = (capabilities ?? []).filter((item) => item.supported).map((item) => item.type)
  const toggle = (type: ExtractType, checked: boolean) => {
    if (!supported.includes(type)) return
    const next = checked ? [...selected, type] : selected.filter((item) => item !== type)
    onSelected(extractTypes.filter((item) => next.includes(item)))
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-background/40 p-3">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={autoExtract}
          disabled={disabled}
          onCheckedChange={(checked) => onAutoExtract(checked === true)}
        />
        上传完成后自动提取素材
      </label>
      {autoExtract ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={disabled || supported.length === 0} onClick={() => onSelected(supported)}>全选</Button>
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onSelected([])}>取消全选</Button>
          </div>
          {loading ? <p className="text-xs text-muted-foreground">正在读取可提取的素材类型…</p> : null}
          {error ? (
            <div className="space-y-2">
              <p className="text-xs text-rose-300">无法确认提取能力。{characterErrorMessage(error)}</p>
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>重新读取</Button>
            </div>
          ) : null}
          <div className="grid gap-2">
            {extractTypes.map((type) => {
              const capability = capabilities?.find((item) => item.type === type)
              const enabled = capability?.supported === true
              return (
                <label key={type} className={`flex items-start gap-2 rounded-lg border border-white/10 px-2 py-2 text-sm ${enabled ? '' : 'opacity-60'}`}>
                  <Checkbox
                    className="mt-0.5"
                    checked={enabled && selected.includes(type)}
                    disabled={disabled || !enabled}
                    onCheckedChange={(checked) => toggle(type, checked === true)}
                  />
                  <span>
                    <span className="block">{extractTypeName(type)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {descriptions[type]}{enabled ? '' : ' · 即将支持'}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">关闭后只保存视频。之后可以在任务中心手动发起提取。</p>
      )}
    </div>
  )
}
