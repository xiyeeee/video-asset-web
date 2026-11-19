import { useState } from 'react'
import { LayoutGrid, List, Search } from 'lucide-react'
import { toast } from 'sonner'
import { EpisodeSwitcher } from '@/components/common/EpisodeSwitcher'
import { EmptyState, PageSkeleton } from '@/components/common/EmptyState'
import { AssetBadge } from '@/components/common/StatusBadge'
import { Waveform } from '@/components/asset/Waveform'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AssetDrawer } from '@/features/assets/AssetDrawer'
import { useCatalog, usePublishCatalog } from '@/hooks/use-catalog'
import { useSelection } from '@/hooks/use-selection'
import { formatClock } from '@/lib/format'
import { assetStatusLabel, assetTypeLabel, assetTypeOrder, characterSubtypes, subtypeLabel } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { addCharacter, updateDialogue } from '@/services/mock/catalog'
import { countByType, filterAssets, sceneNamesOf } from '@/services/view'
import type { Asset, AssetStatus } from '@/types/domain'

export function AssetLibraryPage() {
  const { data, isLoading, isError, refetch } = useCatalog()
  const publish = usePublishCatalog()
  const selection = useSelection(data)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [addingCharacter, setAddingCharacter] = useState(false)
  const [characterName, setCharacterName] = useState('')
  const [characterRole, setCharacterRole] = useState('配角')
  const [editing, setEditing] = useState<Asset | null>(null)
  const [draftText, setDraftText] = useState('')
  const [draftSpeaker, setDraftSpeaker] = useState('')

  if (isLoading) return <PageSkeleton />
  if (isError || !data || !selection.project) {
    return <EmptyState title="素材库加载失败" description="请重新读取演示数据。" action={<Button onClick={() => void refetch()}>重试</Button>} />
  }

  const project = selection.project
  const characterFilter = selection.assetType === 'scene' ? null : selection.characterId
  const assets = filterAssets(data, {
    projectId: project.id,
    episodeId: selection.episodeId,
    type: selection.assetType,
    characterId: characterFilter,
    scene: selection.assetType === 'scene' ? selection.scene : null,
    subtype: selection.assetType === 'character' ? selection.subtype : null,
    status: selection.status,
    keyword: selection.keyword,
  })
  const selectedAsset = data.assets.find((item) => item.id === selection.assetId) ?? null
  const scenes = sceneNamesOf(data, project.id, selection.episodeId)

  const saveCharacter = () => {
    if (characterName.trim().length < 1) {
      toast.error('请填写角色名')
      return
    }
    const created = addCharacter(project.id, { name: characterName, role: characterRole })
    publish()
    selection.update({ character: created.id })
    setAddingCharacter(false)
    setCharacterName('')
    toast.success('角色档案已建立')
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-card p-4">
        <img src={project.coverUrl} alt="" className="size-16 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <Select value={project.id} onValueChange={selection.setProject}>
            <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {data.projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
        </div>
      </section>
      <EpisodeSwitcher episodes={selection.episodes} value={selection.episodeId} onChange={selection.setEpisode} />
      <div className="grid gap-4 xl:grid-cols-[220px_1fr]">
        <aside className="space-y-2 rounded-2xl border border-white/10 bg-card p-2">
          {assetTypeOrder.map((type) => (
            <button
              key={type}
              type="button"
              className={cn('flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm', selection.assetType === type ? 'bg-primary text-white' : 'hover:bg-white/5')}
              onClick={() => selection.setAssetType(type)}
            >
              <span>{assetTypeLabel[type]}</span>
              <span>{countByType(data, project.id, selection.episodeId, type)}</span>
            </button>
          ))}
        </aside>
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input className="pl-9" value={selection.keyword} placeholder="搜索素材、台词或角色" onChange={(event) => selection.update({ q: event.target.value || null })} />
            </div>
            <Select value={selection.status} onValueChange={(value) => selection.update({ status: value === 'all' ? null : value })}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {(Object.keys(assetStatusLabel) as AssetStatus[]).map((status) => <SelectItem key={status} value={status}>{assetStatusLabel[status]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="icon-sm" variant={view === 'grid' ? 'default' : 'outline'} onClick={() => setView('grid')} aria-label="网格"><LayoutGrid /></Button>
            <Button size="icon-sm" variant={view === 'list' ? 'default' : 'outline'} onClick={() => setView('list')} aria-label="列表"><List /></Button>
          </div>
          {selection.assetType === 'character' ? (
            <div className="space-y-3">
              <div className="flex gap-2 overflow-x-auto">
                <button type="button" className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm', selection.characterId === null ? 'border-primary bg-primary/20' : 'border-white/10')} onClick={() => selection.update({ character: 'all' })}>全部角色</button>
                {selection.characters.map((character) => (
                  <button key={character.id} type="button" className={cn('flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left', selection.characterId === character.id ? 'border-primary bg-primary/20' : 'border-white/10')} onClick={() => selection.update({ character: character.id })}>
                    <img src={character.avatarUrl} alt="" className="size-8 rounded-full object-cover" />
                    <span>
                      <span className="block text-sm">{character.name}</span>
                      <span className="block text-xs text-muted-foreground">{character.role} · {character.episodeIds.length} 集</span>
                    </span>
                  </button>
                ))}
                <Button variant="outline" onClick={() => setAddingCharacter(true)}>新增角色</Button>
              </div>
              <div className="flex gap-2">
                {characterSubtypes.map((subtype) => (
                  <button key={subtype} type="button" className={cn('rounded-full px-3 py-1 text-sm', selection.subtype === subtype ? 'bg-primary text-white' : 'bg-card text-muted-foreground')} onClick={() => selection.update({ subtype: subtype === 'all' ? null : subtype })}>
                    {subtype === 'all' ? '全部' : subtypeLabel[subtype]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {selection.assetType === 'scene' ? (
            <div className="flex gap-2 overflow-x-auto">
              <button type="button" className={cn('rounded-full px-3 py-1 text-sm', !selection.scene ? 'bg-primary text-white' : 'bg-card')} onClick={() => selection.update({ scene: null })}>全部场景</button>
              {scenes.map((scene) => (
                <button key={scene} type="button" className={cn('rounded-full px-3 py-1 text-sm', selection.scene === scene ? 'bg-primary text-white' : 'bg-card')} onClick={() => selection.update({ scene })}>{scene}</button>
              ))}
            </div>
          ) : null}
          {selection.assetType !== 'character' && selection.assetType !== 'scene' && selection.characters.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto">
              <button type="button" className={cn('rounded-full px-3 py-1 text-sm', selection.characterId === null ? 'bg-primary text-white' : 'bg-card')} onClick={() => selection.update({ character: 'all' })}>全部角色</button>
              {selection.characters.map((character) => (
                <button key={character.id} type="button" className={cn('rounded-full px-3 py-1 text-sm', selection.characterId === character.id ? 'bg-primary text-white' : 'bg-card')} onClick={() => selection.update({ character: character.id })}>{character.name}</button>
              ))}
            </div>
          ) : null}
          {assets.length === 0 ? (
            <EmptyState title="当前筛选下没有素材" description="换一集、换一个分类，或清除搜索和状态。" action={<Button variant="outline" onClick={() => selection.update({ q: null, status: null, subtype: null, scene: null })}>清除筛选</Button>} />
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
              {assets.map((asset) => {
                const character = data.characters.find((item) => item.id === asset.characterId)
                return (
                  <article key={asset.id} className="overflow-hidden rounded-2xl border border-white/10 bg-card">
                    {asset.type === 'audio' ? <div className="p-3"><Waveform url={asset.url} compact /></div> : null}
                    <button type="button" className="block w-full text-left" onClick={() => selection.update({ asset: asset.id })}>
                      {asset.type === 'audio' ? null : (
                        <img src={asset.posterUrl || asset.url} alt="" className="aspect-[4/3] w-full object-cover" />
                      )}
                      <div className="space-y-1 p-3">
                        <p className="truncate text-sm">{asset.text || asset.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{character?.name ?? asset.sceneName ?? subtypeLabel[asset.subtype ?? ''] ?? asset.type}{asset.startTime !== undefined ? ` · ${formatClock(asset.startTime)}` : ''}</p>
                        <AssetBadge status={asset.status} />
                      </div>
                    </button>
                    {asset.type === 'dialogue' ? (
                      <div className="px-3 pb-3">
                        <Button size="sm" variant="outline" onClick={() => { setEditing(asset); setDraftText(asset.text ?? ''); setDraftSpeaker(asset.characterId ?? '') }}>编辑台词</Button>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-card text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">名称</th>
                    <th className="px-3 py-2">角色 / 场景</th>
                    <th className="px-3 py-2">时间</th>
                    <th className="px-3 py-2">状态</th>
                    <th className="px-3 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => {
                    const character = data.characters.find((item) => item.id === asset.characterId)
                    return (
                      <tr key={asset.id} className="border-t border-white/10">
                        <td className="px-3 py-2">{asset.text || asset.name}</td>
                        <td className="px-3 py-2">{character?.name ?? asset.sceneName ?? '—'}</td>
                        <td className="px-3 py-2">{asset.startTime !== undefined ? `${formatClock(asset.startTime)}-${formatClock(asset.endTime ?? asset.startTime)}` : '—'}</td>
                        <td className="px-3 py-2"><AssetBadge status={asset.status} /></td>
                        <td className="px-3 py-2">
                          <Button size="sm" variant="outline" onClick={() => selection.update({ asset: asset.id })}>预览</Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <AssetDrawer catalog={data} asset={selectedAsset} onOpenChange={(open) => { if (!open) selection.update({ asset: null }) }} />
      <Dialog open={addingCharacter} onOpenChange={setAddingCharacter}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增角色</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="character-name">角色名</Label><Input id="character-name" value={characterName} onChange={(event) => setCharacterName(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="character-role">身份</Label><Input id="character-role" value={characterRole} onChange={(event) => setCharacterRole(event.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingCharacter(false)}>取消</Button>
            <Button onClick={saveCharacter}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑台词</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>说话角色</Label>
              <Select value={draftSpeaker} onValueChange={setDraftSpeaker}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {selection.characters.map((character) => <SelectItem key={character.id} value={character.id}>{character.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dialogue-text">台词</Label>
              <Input id="dialogue-text" value={draftText} onChange={(event) => setDraftText(event.target.value)} />
            </div>
            {editing?.novelMatch ? <p className="text-sm text-muted-foreground">原著匹配：{editing.novelMatch}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
            <Button onClick={() => {
              if (!editing || !draftText.trim() || !draftSpeaker) return
              updateDialogue(editing.id, { text: draftText, characterId: draftSpeaker })
              publish()
              toast.success('台词已更新，并同步到剧情脚本')
              setEditing(null)
            }}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

