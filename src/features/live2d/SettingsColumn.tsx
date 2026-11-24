import { Box, PersonStanding } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { live2dStageLabel, live2dStatusLabel, type Live2dStatus } from '@/services/live2d/contract'

export function SettingsColumn({
  modelName,
  onModelName,
  busy,
  status,
  stage,
  failure,
  notice,
  onGenerate,
  onImport,
  onSample,
}: {
  modelName: string
  onModelName: (value: string) => void
  busy: boolean
  status: Live2dStatus | null
  stage: string | null
  failure: string
  notice: string
  onGenerate: () => void
  onImport: (files: File[]) => void
  onSample: () => void
}) {
  const stageText = live2dStageLabel(stage)
  const statusText = status ? live2dStatusLabel(status) : ''
  return (
    <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-white/10 bg-card p-4">
      <h2 className="font-medium">生成设置</h2>
      <label className="block text-sm">
        模型名称
        <input
          className="mt-1 w-full rounded-lg border border-white/10 bg-background/40 px-3 py-2"
          value={modelName}
          maxLength={255}
          disabled={busy}
          placeholder="例如：许宁"
          onChange={(event) => onModelName(event.target.value)}
        />
      </label>
      <Button type="button" className="h-10 w-full" disabled={busy} onClick={onGenerate}>
        <Box />
        {busy ? '正在生成' : '生成 Live2D 模型'}
      </Button>
      <Button type="button" variant="outline" className="w-full" disabled title="动作生成将在后续接入">
        <PersonStanding />
        生成动作
      </Button>
      <p className="text-xs text-muted-foreground">动作生成将在后续接入。当前可以用预览区里的参数按钮测试眨眼、张嘴和转头。</p>
      {statusText ? (
        <p className="text-sm text-violet-100">
          {statusText}{stageText ? ` · ${stageText}` : ''}
        </p>
      ) : null}
      {failure ? <p className="text-sm text-rose-300">{failure}</p> : null}
      {notice ? <p className="text-sm text-rose-300">{notice}</p> : null}
      <div className="mt-auto flex flex-col items-start gap-2 pt-2">
        <Button type="button" variant="link" className="h-auto px-0" asChild>
          <label>
            导入已有模型
            <input
              className="sr-only"
              type="file"
              multiple
              onChange={(event) => {
                const files = event.target.files ? Array.from(event.target.files) : []
                event.target.value = ''
                if (files.length > 0) onImport(files)
              }}
              {...{ webkitdirectory: '', directory: '' }}
            />
          </label>
        </Button>
        <Button type="button" variant="link" className="h-auto px-0" onClick={onSample}>加载示例模型</Button>
      </div>
    </section>
  )
}
