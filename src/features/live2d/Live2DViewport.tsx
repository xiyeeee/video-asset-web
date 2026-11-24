import { useEffect, useRef, useState } from 'react'
import { Eye, RotateCw, Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  availableMotionTests,
  motionTarget,
  type MotionTest,
  type MotionTestId,
  type ModelSettingsJson,
} from '@/services/live2d/contract'
import { prepareDirectoryModel, prepareRemoteModel } from './prepare-model'

const CORE_URL = '/live2d/live2dcubismcore.min.js'

let corePromise: Promise<void> | null = null

const loadCubismCore = () => {
  if (typeof Live2DCubismCore !== 'undefined') return Promise.resolve()
  corePromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CORE_URL
    script.async = true
    script.onload = () => {
      if (typeof Live2DCubismCore === 'undefined') {
        reject(new Error('Live2D 运行时核心没有正确加载。'))
        return
      }
      resolve()
    }
    script.onerror = () => reject(new Error('没有找到 Live2D 运行时核心。请把官方 live2dcubismcore.min.js 放到 public/live2d/ 后刷新。'))
    document.head.appendChild(script)
  })
  return corePromise
}

export type ModelPreview =
  | { id: string; kind: 'url'; url: string; sample: boolean }
  | { id: string; kind: 'files'; files: readonly File[]; sample: boolean }

type ParameterRange = { id: string; min: number; max: number; fallback: number }

type CubismCoreModel = {
  getModel: () => {
    parameters: {
      ids: string[]
      minimumValues: ArrayLike<number>
      maximumValues: ArrayLike<number>
      defaultValues: ArrayLike<number>
    }
  }
  setParameterValueById: (parameterId: string, value: number, weight?: number) => void
}

const isCubismCoreModel = (core: object): core is CubismCoreModel => {
  if (!('getModel' in core) || !('setParameterValueById' in core)) return false
  return typeof core.getModel === 'function' && typeof core.setParameterValueById === 'function'
}

const iconFor = (id: MotionTestId) => {
  if (id === 'blink') return Eye
  if (id === 'mouth') return Smile
  return RotateCw
}

const previewErrorText = (error: unknown) => {
  if (error instanceof DOMException && error.name === 'AbortError') return ''
  if (error instanceof Error && error.message) return error.message
  return '模型预览加载失败。'
}

export function Live2DViewport({ preview }: { preview: ModelPreview | null }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rangesRef = useRef<ParameterRange[]>([])
  const motionRef = useRef<MotionTest | null>(null)
  const [tests, setTests] = useState<MotionTest[]>([])
  const [active, setActive] = useState<MotionTestId | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host || !preview) {
      setTests([])
      setError('')
      setLoading(false)
      return
    }
    const controller = new AbortController()
    let disposed = false
    let application: import('pixi.js').Application | null = null
    const blobUrls: string[] = []
    const releaseBlobs = () => {
      for (const url of blobUrls) URL.revokeObjectURL(url)
      blobUrls.length = 0
    }
    setLoading(true)
    setError('')
    setTests([])
    setActive(null)

    const run = async () => {
      await loadCubismCore()
      if (disposed) return
      const prepared = preview.kind === 'url'
        ? await prepareRemoteModel(preview.url, controller.signal)
        : await prepareDirectoryModel(preview.files)
      blobUrls.push(...prepared.blobUrls)
      if (disposed) {
        releaseBlobs()
        return
      }
      const PIXI = await import('pixi.js')
      const { Live2DModel } = await import('pixi-live2d-display/cubism4')
      Live2DModel.registerTicker(PIXI.Ticker)
      const view = new PIXI.Application({
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })
      application = view
      host.appendChild(view.view as HTMLCanvasElement)
      const model = await Live2DModel.from(prepared.json satisfies ModelSettingsJson, { autoInteract: false })
      if (disposed) {
        model.destroy()
        releaseBlobs()
        return
      }
      const place = () => {
        const width = view.renderer.width
        const height = view.renderer.height
        const scale = Math.min((width * 0.86) / model.width, (height * 0.86) / model.height)
        model.scale.set(Number.isFinite(scale) && scale > 0 ? scale : 1)
        model.x = (width - model.width) / 2
        model.y = (height - model.height) / 2
      }
      place()
      view.renderer.on('resize', place)
      view.stage.addChild(model)
      const core = model.internalModel.coreModel
      if (!isCubismCoreModel(core)) throw new Error('模型核心没有可测试的参数。')
      const parameters = core.getModel().parameters
      rangesRef.current = parameters.ids.map((id, index) => ({
        id,
        min: parameters.minimumValues[index] ?? 0,
        max: parameters.maximumValues[index] ?? 1,
        fallback: parameters.defaultValues[index] ?? 0,
      }))
      setTests(availableMotionTests(parameters.ids))
      view.ticker.add(() => {
        const motion = motionRef.current
        if (!motion) return
        for (const parameterId of motion.parameters) {
          const range = rangesRef.current.find((item) => item.id === parameterId)
          if (!range) continue
          core.setParameterValueById(parameterId, motionTarget(motion.id, range.min, range.max, range.fallback))
        }
      }, undefined, PIXI.UPDATE_PRIORITY.LOW)
      setLoading(false)
    }

    void run().catch((caught: unknown) => {
      if (disposed || controller.signal.aborted) return
      setLoading(false)
      setError(previewErrorText(caught))
    })

    return () => {
      disposed = true
      controller.abort()
      motionRef.current = null
      application?.destroy(true, { children: true, texture: true, baseTexture: true })
      releaseBlobs()
      host.replaceChildren()
    }
  }, [preview])

  const play = (test: MotionTest) => {
    motionRef.current = test
    setActive(test.id)
    window.setTimeout(() => {
      if (motionRef.current?.id === test.id) {
        motionRef.current = null
        setActive(null)
      }
    }, 900)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative min-h-64 flex-1 overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(45deg,#24304a_25%,transparent_25%),linear-gradient(-45deg,#24304a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#24304a_75%),linear-gradient(-45deg,transparent_75%,#24304a_75%)] bg-[length:28px_28px] bg-[position:0_0,0_14px,14px_-14px,-14px_0] bg-[#12182c]">
        <div ref={hostRef} className="absolute inset-0" />
        {preview?.sample ? (
          <span className="absolute top-3 left-3 rounded-full bg-violet-500/80 px-2 py-0.5 text-xs text-white">示例模型</span>
        ) : null}
        {!preview && !loading ? (
          <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted-foreground">
            生成成功后，这里会渲染实际的 Live2D 模型。也可以先导入模型或加载示例。
          </div>
        ) : null}
        {loading ? <div className="absolute inset-0 grid place-items-center text-sm text-violet-100">正在加载模型…</div> : null}
        {error ? <div className="absolute inset-x-4 bottom-4 rounded-lg bg-rose-950/80 px-3 py-2 text-sm text-rose-100">{error}</div> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {tests.map((test) => {
          const Icon = iconFor(test.id)
          return (
            <Button key={test.id} type="button" variant="outline" className="flex-1" disabled={active !== null} onClick={() => play(test)}>
              <Icon />
              {test.label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
