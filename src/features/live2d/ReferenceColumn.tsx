import { ImageUp, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ReferenceColumn({
  previewUrl,
  label,
  disabled,
  onUpload,
  onChooseAsset,
}: {
  previewUrl: string
  label: string
  disabled: boolean
  onUpload: (file: File) => void
  onChooseAsset: () => void
}) {
  return (
    <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-white/10 bg-card p-4">
      <h2 className="font-medium">角色参考图</h2>
      <div className="grid min-h-48 flex-1 place-items-center overflow-hidden rounded-xl border border-white/10 bg-background/40">
        {previewUrl ? (
          <img src={previewUrl} alt={label || '角色参考图'} className="max-h-full max-w-full object-contain" referrerPolicy="no-referrer" />
        ) : (
          <p className="px-4 text-center text-sm text-muted-foreground">上传本地图片，或从当前项目的人物素材里选择。</p>
        )}
      </div>
      {label ? <p className="truncate text-xs text-muted-foreground">{label}</p> : null}
      <Button type="button" disabled={disabled} asChild>
        <label>
          <ImageUp />
          上传图片
          <input
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) onUpload(file)
            }}
          />
        </label>
      </Button>
      <Button type="button" variant="outline" disabled={disabled} onClick={onChooseAsset}>
        <UserRound />
        从人物素材选择
      </Button>
    </section>
  )
}
