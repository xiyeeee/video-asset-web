import { useEffect, useRef, useState } from 'react'
import { Download, Maximize2, RotateCcw } from 'lucide-react'
import { AuthError, isCancelled } from '@/features/auth/auth-api'
import { Button } from '@/components/ui/button'
import {
  fetchLive2dPackage,
  getLive2dVersion,
  listLive2dCharacters,
  listLive2dVersions,
  live2dErrorMessage,
  type Live2dVersionDetail,
} from '@/services/live2d/api'
import {
  characterForModel,
  isCurrentLive2dRequest,
  live2dPackageName,
  orderLive2dVersions,
  versionForSelection,
  type Live2dLibraryCharacter,
  type Live2dLibraryVersion,
} from '@/services/live2d/contract'
import { Live2DViewport, type Live2DViewportHandle, type ModelPreview } from './Live2DViewport'

const savedTime = (value: string) => {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Date(parsed).toLocaleString('zh-CN', { hour12: false })
}

const libraryMessage = (error: unknown, fallback: string) => {
  if (error instanceof AuthError && error.status === 404) return '历史模型接口尚未接入，或记录不存在。'
  const message = live2dErrorMessage(error)
  return message || fallback
}

export function ModelLibrary({
  projectId,
  focusModelId,
  onCreate,
}: {
  projectId: string
  focusModelId: string | null
  onCreate: () => void
}) {
  const [characters, setCharacters] = useState<Live2dLibraryCharacter[]>([])
  const [characterId, setCharacterId] = useState<string | null>(null)
  const [preferredModelId, setPreferredModelId] = useState<string | null>(focusModelId)
  const [characterStatus, setCharacterStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [characterError, setCharacterError] = useState('')
  const [characterAttempt, setCharacterAttempt] = useState(0)
  const [versions, setVersions] = useState<Live2dLibraryVersion[]>([])
  const [versionId, setVersionId] = useState<string | null>(null)
  const [versionStatus, setVersionStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [versionError, setVersionError] = useState('')
  const [versionAttempt, setVersionAttempt] = useState(0)
  const [detail, setDetail] = useState<Live2dVersionDetail | null>(null)
  const [preview, setPreview] = useState<ModelPreview | null>(null)
  const [detailError, setDetailError] = useState('')
  const [detailAttempt, setDetailAttempt] = useState(0)
  const [notice, setNotice] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const viewportRef = useRef<Live2DViewportHandle>(null)
  const downloadAbortRef = useRef<AbortController | null>(null)
  const characterRequestRef = useRef(0)
  const versionRequestRef = useRef(0)
  const detailRequestRef = useRef(0)
  const versionIdRef = useRef<string | null>(null)

  useEffect(() => () => downloadAbortRef.current?.abort(), [])

  useEffect(() => {
    const controller = new AbortController()
    const requestId = characterRequestRef.current + 1
    characterRequestRef.current = requestId
    void listLive2dCharacters(projectId, controller.signal)
      .then((items) => {
        if (!isCurrentLive2dRequest(requestId, characterRequestRef.current)) return
        const selection = characterForModel(items, focusModelId)
        setCharacters(items)
        setVersionStatus(selection.character ? 'loading' : 'idle')
        setVersions([])
        setVersionId(null)
        setDetail(null)
        setPreview(null)
        setCharacterId(selection.character?.characterId ?? null)
        setPreferredModelId(selection.matched ? focusModelId : null)
        setCharacterStatus(items.length === 0 ? 'empty' : 'ready')
        if (focusModelId && !selection.matched && items.length > 0) {
          setNotice('没有在历史列表里找到刚保存的版本，已打开最新记录。')
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isCancelled(error)) return
        if (!isCurrentLive2dRequest(requestId, characterRequestRef.current)) return
        setCharacterStatus('error')
        setCharacterError(libraryMessage(error, '角色列表加载失败。'))
      })
    return () => controller.abort()
  }, [projectId, focusModelId, characterAttempt])

  useEffect(() => {
    if (!characterId) return
    const controller = new AbortController()
    const requestId = versionRequestRef.current + 1
    versionRequestRef.current = requestId
    void listLive2dVersions(projectId, characterId, controller.signal)
      .then((items) => {
        if (!isCurrentLive2dRequest(requestId, versionRequestRef.current)) return
        const ordered = orderLive2dVersions(items)
        const picked = versionForSelection(ordered, preferredModelId)
        setVersions(ordered)
        setDetail(null)
        setPreview(null)
        setDetailError('')
        setDownloadError('')
        setVersionId(picked?.versionId ?? null)
        setVersionStatus('ready')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isCancelled(error)) return
        if (!isCurrentLive2dRequest(requestId, versionRequestRef.current)) return
        setVersionStatus('error')
        setVersionError(libraryMessage(error, '历史版本加载失败。'))
      })
    return () => controller.abort()
  }, [projectId, characterId, preferredModelId, versionAttempt])

  useEffect(() => {
    downloadAbortRef.current?.abort()
    versionIdRef.current = versionId
    if (!versionId) return
    const controller = new AbortController()
    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId
    const selectedVersionId = versionId
    void getLive2dVersion(projectId, selectedVersionId, controller.signal)
      .then((next) => {
        if (!isCurrentLive2dRequest(requestId, detailRequestRef.current)) return
        if (next.versionId !== selectedVersionId) return
        setDetail(next)
        setPreview({ id: `${next.versionId}:${detailAttempt}`, kind: 'url', url: next.modelEntryUrl, sample: false })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isCancelled(error)) return
        if (!isCurrentLive2dRequest(requestId, detailRequestRef.current)) return
        setDetail(null)
        setPreview(null)
        setDetailError(libraryMessage(error, '模型预览加载失败。'))
      })
    return () => controller.abort()
  }, [projectId, versionId, detailAttempt])

  const chooseCharacter = (nextCharacterId: string) => {
    if (nextCharacterId === characterId) return
    setPreferredModelId(null)
    setVersionStatus('loading')
    setVersions([])
    setVersionId(null)
    setDetail(null)
    setPreview(null)
    setDetailError('')
    setDownloadError('')
    setCharacterId(nextCharacterId)
  }

  const chooseVersion = (nextVersionId: string) => {
    if (nextVersionId === versionId) return
    setDetail(null)
    setPreview(null)
    setDetailError('')
    setDownloadError('')
    setVersionId(nextVersionId)
  }

  const retryPreview = () => {
    setDetailError('')
    setPreview(null)
    setDetailAttempt((current) => current + 1)
  }

  const downloadPackage = async () => {
    if (!versionId || !detail || detail.versionId !== versionId || downloading) return
    const selectedVersionId = versionId
    const controller = new AbortController()
    downloadAbortRef.current?.abort()
    downloadAbortRef.current = controller
    setDownloading(true)
    setDownloadError('')
    try {
      let current = detail
      let file = await readPackage(current.packageUrl, controller.signal)
      if (versionIdRef.current !== selectedVersionId) return
      if (file === null) {
        current = await getLive2dVersion(projectId, selectedVersionId, controller.signal)
        if (versionIdRef.current !== selectedVersionId || current.versionId !== selectedVersionId) return
        setDetail(current)
        file = await fetchLive2dPackage(current.packageUrl, controller.signal)
      }
      if (versionIdRef.current !== selectedVersionId) return
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = live2dPackageName(current.versionNumber, current.name)
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      if (controller.signal.aborted || isCancelled(error)) return
      if (versionIdRef.current !== selectedVersionId) return
      setDownloadError(libraryMessage(error, '模型包下载失败。'))
    } finally {
      if (downloadAbortRef.current === controller) setDownloading(false)
    }
  }

  const toggleFullscreen = async () => {
    const frame = viewportRef.current?.frameElement()
    if (!frame) return
    try {
      if (document.fullscreenElement === frame) await document.exitFullscreen()
      else await frame.requestFullscreen()
    } catch {
      setNotice('当前环境不能进入全屏。')
    }
  }

  if (characterStatus === 'loading') {
    return <p className="grid flex-1 place-items-center text-sm text-muted-foreground">正在读取已保存的模型…</p>
  }
  if (characterStatus === 'error') {
    return (
      <div className="grid flex-1 place-items-center gap-3 text-center">
        <p className="text-sm text-rose-300">{characterError}</p>
        <Button type="button" variant="outline" onClick={() => {
          setCharacterStatus('loading')
          setCharacterError('')
          setCharacterAttempt((current) => current + 1)
        }}>重试</Button>
      </div>
    )
  }
  if (characterStatus === 'empty') {
    return (
      <div className="grid flex-1 place-items-center gap-3 text-center">
        <div>
          <p className="font-medium">还没有已保存的模型</p>
          <p className="mt-1 text-sm text-muted-foreground">生成成功并保存后，会出现在这里。</p>
        </div>
        <Button type="button" onClick={onCreate}>生成新模型</Button>
      </div>
    )
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[220px_280px_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-white/10 bg-card p-4">
        <h2 className="font-medium">角色</h2>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {characters.map((character) => {
            const selected = character.characterId === characterId
            return (
              <button
                key={character.characterId}
                type="button"
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${selected ? 'border-violet-400 bg-violet-500/15' : 'border-white/10'}`}
                onClick={() => chooseCharacter(character.characterId)}
              >
                <Avatar name={character.name} url={character.avatarUrl} />
                <span className="min-w-0 truncate text-sm">{character.name}</span>
              </button>
            )
          })}
        </div>
      </section>
      <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-white/10 bg-card p-4">
        <h2 className="font-medium">历史版本</h2>
        {versionStatus === 'loading' ? <p className="text-sm text-muted-foreground">正在读取历史版本…</p> : null}
        {versionStatus === 'error' ? (
          <div className="space-y-3">
            <p className="text-sm text-rose-300">{versionError}</p>
            <Button type="button" variant="outline" onClick={() => {
              setVersionStatus('loading')
              setVersionError('')
              setVersionAttempt((current) => current + 1)
            }}>重试</Button>
          </div>
        ) : null}
        {versionStatus === 'ready' && versions.length === 0 ? <p className="text-sm text-muted-foreground">这个角色还没有历史版本。</p> : null}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {versions.map((version) => {
            const selected = version.versionId === versionId
            return (
              <button
                key={version.versionId}
                type="button"
                className={`flex w-full gap-3 rounded-xl border p-2 text-left ${selected ? 'border-violet-400 bg-violet-500/15' : 'border-white/10'}`}
                onClick={() => chooseVersion(version.versionId)}
              >
                <Avatar name={`V${version.versionNumber}`} url={version.thumbnailUrl} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">V{version.versionNumber}</span>
                  {version.name ? <span className="block truncate text-xs text-violet-100">{version.name}</span> : null}
                  <span className="block text-xs text-muted-foreground">{savedTime(version.savedAt)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>
      <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-white/10 bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">模型预览</h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => viewportRef.current?.resetView()}>
              <RotateCcw />重置视角
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void toggleFullscreen()}>
              <Maximize2 />全屏
            </Button>
            <Button type="button" size="sm" disabled={!detail || detail.versionId !== versionId || downloading} onClick={() => void downloadPackage()}>
              <Download />{downloading ? '正在下载' : '下载模型包'}
            </Button>
          </div>
        </div>
        {detailError ? (
          <div className="grid min-h-64 flex-1 place-items-center gap-3 text-center">
            <p className="text-sm text-rose-300">{detailError}</p>
            <Button type="button" variant="outline" onClick={retryPreview}>重试</Button>
          </div>
        ) : (
          <Live2DViewport
            ref={viewportRef}
            preview={preview}
            showCenter={false}
            emptyText="选择一个历史版本后，这里会显示模型。"
            onRetry={retryPreview}
          />
        )}
        {downloadError ? <p className="text-sm text-rose-300">{downloadError}</p> : null}
        {notice ? <p className="text-sm text-violet-100">{notice}</p> : null}
      </section>
    </div>
  )
}

const readPackage = async (url: string, signal: AbortSignal) => {
  try {
    return await fetchLive2dPackage(url, signal)
  } catch (error) {
    if (error instanceof AuthError && error.status === 404) return null
    throw error
  }
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (!url) {
    return <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-violet-500/20 text-xs text-violet-100">{name.slice(0, 1)}</span>
  }
  return <img src={url} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
}
