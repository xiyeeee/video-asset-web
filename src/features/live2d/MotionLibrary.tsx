import { useEffect, useState } from 'react'
import { Play, Plus } from 'lucide-react'
import { isCancelled } from '@/features/auth/auth-api'
import { Button } from '@/components/ui/button'
import { comboErrorMessage, listComboMotions, type ComboSummary } from '@/services/live2d/combo-api'
import { formatComboClock } from '@/services/live2d/combo-contract'
import type { Live2dHistoryFocus } from '@/services/live2d/contract'
import { ComboEditor } from './ComboEditor'

export type MotionEntry =
  | { kind: 'list'; focus: Live2dHistoryFocus | null }
  | { kind: 'new'; focus: Live2dHistoryFocus | null }
  | { kind: 'open'; comboId: string; autoPlay: boolean; focus: Live2dHistoryFocus | null }

export function MotionLibrary({
  projectId,
  entry,
  dirtyRef,
  presentation = 'workbench',
}: {
  projectId: string
  entry: MotionEntry
  dirtyRef: { current: boolean }
  presentation?: 'workbench' | 'reactions'
}) {
  const [mode, setMode] = useState<'single' | 'combo'>(presentation === 'reactions' ? 'combo' : 'combo')
  const [editor, setEditor] = useState<MotionEntry>(entry)
  const [items, setItems] = useState<ComboSummary[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (editor.kind !== 'list') return
    const controller = new AbortController()
    void listComboMotions(projectId, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return
        setItems(next)
        setStatus('ready')
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted || isCancelled(caught)) return
        setStatus('error')
        setError(comboErrorMessage(caught, '组合列表加载失败。'))
      })
    return () => controller.abort()
  }, [projectId, editor.kind, attempt])

  const openList = () => {
    dirtyRef.current = false
    setEditor({ kind: 'list', focus: editor.focus })
    setStatus('loading')
    setAttempt((current) => current + 1)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      {presentation === 'reactions' ? null : (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button type="button" variant={mode === 'single' ? 'default' : 'outline'} onClick={() => setMode('single')}>单个动作</Button>
          <Button type="button" variant={mode === 'combo' ? 'default' : 'outline'} onClick={() => setMode('combo')}>组合动作</Button>
        </div>
      )}
      {mode === 'single' ? (
        <div className="grid flex-1 place-items-center rounded-2xl border border-white/10 bg-card p-6 text-center">
          <div>
            <p className="font-medium">单个动作将在后续接入</p>
            <p className="mt-1 text-sm text-muted-foreground">当前可以在组合动作里编排微笑、点头、口型和台词。</p>
          </div>
        </div>
      ) : editor.kind === 'list' ? (
        <ComboList
          items={items}
          status={status}
          error={error}
          onRetry={() => {
            setStatus('loading')
            setError('')
            setAttempt((current) => current + 1)
          }}
          onCreate={() => setEditor({ kind: 'new', focus: editor.focus })}
          onOpen={(comboId, autoPlay) => setEditor({ kind: 'open', comboId, autoPlay, focus: editor.focus })}
        />
      ) : (
        <ComboEditor
          projectId={projectId}
          comboId={editor.kind === 'open' ? editor.comboId : null}
          focus={editor.focus}
          autoPlay={editor.kind === 'open' && editor.autoPlay}
          dirtyRef={dirtyRef}
          onBack={openList}
        />
      )}
    </div>
  )
}

function ComboList({
  items,
  status,
  error,
  onRetry,
  onCreate,
  onOpen,
}: {
  items: ComboSummary[]
  status: 'loading' | 'ready' | 'error'
  error: string
  onRetry: () => void
  onCreate: () => void
  onOpen: (comboId: string, autoPlay: boolean) => void
}) {
  if (status === 'loading') return <p className="grid flex-1 place-items-center text-sm text-muted-foreground">正在读取组合动作…</p>
  if (status === 'error') {
    return (
      <div className="grid flex-1 place-items-center gap-3 text-center">
        <p className="text-sm text-rose-300">{error}</p>
        <Button type="button" variant="outline" onClick={onRetry}>重试</Button>
      </div>
    )
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">已保存的组合</h2>
        <Button type="button" onClick={onCreate}><Plus />新建组合</Button>
      </div>
      {items.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-2xl border border-white/10 bg-card text-center">
          <div>
            <p className="font-medium">还没有组合动作</p>
            <p className="mt-1 text-sm text-muted-foreground">新建后可以把微笑、点头和台词排在同一条时间轴上。</p>
            <Button type="button" className="mt-3" onClick={onCreate}>新建组合</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 overflow-y-auto md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.comboId} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-card p-4">
              <div>
                <h3 className="font-medium">{item.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">已绑定模型 · {formatComboClock(item.durationMs)}</p>
              </div>
              <div className="mt-auto flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpen(item.comboId, false)}>打开</Button>
                <Button type="button" onClick={() => onOpen(item.comboId, true)}><Play />播放</Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
