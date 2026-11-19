import { DEMO_AUDIO_URL, DEMO_VIDEO_URL } from '@/lib/format'
import { characterArt, sceneArt } from '@/services/mock/artwork'
import type {
  AnalysisLog,
  AnalysisStatus,
  Asset,
  AssetStatus,
  AssetType,
  Catalog,
  Character,
  Episode,
  ExportFormat,
  ExportJob,
  Project,
  StoryLine,
} from '@/types/domain'

const expressions = ['smile', 'surprise', 'angry', 'shy', 'neutral', 'side'] as const
const sceneNames = ['教室', '走廊', '天台', '校门口', '宿舍', '咖啡馆']
const dialogueBank = [
  '这节课的走向，不该再按你的剧本走。',
  '你看我的眼神，已经不在原来的计划里了。',
  '把下一场的主动权交出来。',
  '原文里她没有退开，她先问了一句为什么。',
  '别用旁白替我做决定。',
  '这一集的结尾，我想自己说。',
]
const novelMatches = ['与原文一致', '语义接近，用词不同', '原文未出现该句', '可对上原文开篇']
const statusCycle: AssetStatus[] = ['READY', 'READY', 'REVIEW', 'READY', 'PROCESSING', 'READY', 'RAW', 'FAILED']

let sequence = 1

function uid(prefix: string) {
  sequence += 1
  return `${prefix}-${sequence}`
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function log(level: AnalysisLog['level'], message: string, time = daysAgo(0)): AnalysisLog {
  return { id: uid('log'), time, level, message }
}

function pickStatus(index: number) {
  return statusCycle[index % statusCycle.length] ?? 'READY'
}

interface CharacterSeed {
  id: string
  name: string
  role: string
  hue: number
  summary: string
}

interface EpisodeSeed {
  number: number
  status: AnalysisStatus
  progress: number
  error?: string
}

interface ProjectSeed {
  id: string
  name: string
  description: string
  tags: string[]
  novelName: string
  novelText: string
  characters: CharacterSeed[]
  episodes: EpisodeSeed[]
}

const novels = {
  fanpai: `苏晚把校服领口抚平，才抬头看向讲台边的陆沉。原文这一段写的是她先退开，可镜头里她没有退。她问：“如果剧本已经被人看完了，反派还算反派吗？”教室后排的林夏把小说合上，纸页里的名字和屏幕上的人第一次对上。`,
  xiaohua: `聊天框停在一句“明天见”。第二天校门口的风把她的长发吹起来，他才发现网线对面的人就站在公告栏下面。原文只写了心跳，没有写她先叫出了他的名字。`,
  tiegao: `她把作业本推回来，声音很轻：“跟紧可以，但别挡我的光。”他点头的时候，走廊的灯刚好一盏一盏亮起来。原文把这场戏放在雨天，成片改成了晴天的放学。`,
}

const projectSeeds: ProjectSeed[] = [
  {
    id: 'p-fanpai',
    name: '反派拿捏',
    description: '女主识破校园反派剧本，把每一集的对峙拆成可进游戏的角色、场景和台词。',
    tags: ['校园', '恋爱', '现代'],
    novelName: '反派拿捏.txt',
    novelText: novels.fanpai,
    characters: [
      { id: 'c-suwan', name: '苏晚', role: '女主', hue: 282, summary: '识破剧本的女主，表情和立绘按集复用。' },
      { id: 'c-luchen', name: '陆沉', role: '男主', hue: 222, summary: '表面按剧本走、实际被女主改写选择的男主。' },
      { id: 'c-linxia', name: '林夏', role: '配角', hue: 330, summary: '拿着原著对台词的同班同学。' },
    ],
    episodes: [
      { number: 1, status: 'COMPLETED', progress: 100 },
      { number: 2, status: 'COMPLETED', progress: 100 },
      { number: 3, status: 'COMPLETED', progress: 100 },
      { number: 4, status: 'COMPLETED', progress: 100 },
      { number: 5, status: 'ANALYZING', progress: 68 },
      { number: 6, status: 'FAILED', progress: 41, error: '关键帧提取中断，可重试。' },
      { number: 7, status: 'QUEUED', progress: 0 },
      { number: 8, status: 'PENDING', progress: 0 },
    ],
  },
  {
    id: 'p-xiaohua',
    name: '网恋女友是校花',
    description: '网聊身份和校园实拍对照，整理角色外观、放学场景和对话音频。',
    tags: ['校园', '甜宠'],
    novelName: '网恋女友是校花.txt',
    novelText: novels.xiaohua,
    characters: [
      { id: 'c-tang', name: '唐棠', role: '女主', hue: 198, summary: '公告栏前被认出来的校花。' },
      { id: 'c-zhou', name: '周予', role: '男主', hue: 250, summary: '先在聊天框里认识她的男生。' },
      { id: 'c-qiao', name: '乔麦', role: '配角', hue: 12, summary: '负责起哄、也负责拆穿身份的朋友。' },
    ],
    episodes: [
      { number: 1, status: 'COMPLETED', progress: 100 },
      { number: 2, status: 'COMPLETED', progress: 100 },
      { number: 3, status: 'COMPLETED', progress: 100 },
      { number: 4, status: 'EXTRACTING', progress: 52 },
      { number: 5, status: 'QUEUED', progress: 0 },
      { number: 6, status: 'PENDING', progress: 0 },
    ],
  },
  {
    id: 'p-tiegao',
    name: '高冷校花的贴身高手',
    description: '围绕护送与并肩走路的动作，提取角色距离、走廊场景和短句对白。',
    tags: ['校园', '动作'],
    novelName: '高冷校花的贴身高手.txt',
    novelText: novels.tiegao,
    characters: [
      { id: 'c-shen', name: '沈清', role: '女主', hue: 262, summary: '走路不回头、台词很短的女主。' },
      { id: 'c-pei', name: '裴川', role: '男主', hue: 205, summary: '跟在半步之外的男主。' },
    ],
    episodes: [
      { number: 1, status: 'COMPLETED', progress: 100 },
      { number: 2, status: 'COMPLETED', progress: 100 },
      { number: 3, status: 'ANALYZING', progress: 24 },
      { number: 4, status: 'FAILED', progress: 18, error: '音频分离失败。' },
      { number: 5, status: 'PENDING', progress: 0 },
    ],
  },
]

function initialLogs(status: AnalysisStatus, error?: string): AnalysisLog[] {
  const logs: AnalysisLog[] = [log('info', '已登记集数', daysAgo(2))]
  if (status === 'PENDING') return logs
  logs.unshift(log('info', '视频文件已登记', daysAgo(1)))
  if (status === 'QUEUED' || status === 'UPLOADING') return logs
  logs.unshift(log('info', '开始拆分镜头与台词', daysAgo(1)))
  if (status === 'FAILED') logs.unshift(log('error', error ?? '解析失败', daysAgo(0)))
  if (status === 'COMPLETED') logs.unshift(log('info', '素材已写入角色档案', daysAgo(0)))
  return logs
}

let db: Catalog = createSeed()

function createSeed(): Catalog {
  const projects: Project[] = []
  const episodes: Episode[] = []
  const characters: Character[] = []
  const assets: Asset[] = []
  const storyLines: StoryLine[] = []

  projectSeeds.forEach((seed, projectIndex) => {
    const lead = seed.characters[0]
    const project: Project = {
      id: seed.id,
      name: seed.name,
      description: seed.description,
      tags: seed.tags,
      novelName: seed.novelName,
      novelText: seed.novelText,
      coverUrl: lead ? characterArt(lead.name, lead.hue, 'smile', 'bust') : sceneArt(seed.name, projectIndex),
      createdAt: daysAgo(12 - projectIndex),
      updatedAt: daysAgo(projectIndex),
    }
    projects.push(project)
    const cast = seed.characters.map<Character>((item) => ({
      ...item,
      projectId: seed.id,
      avatarUrl: characterArt(item.name, item.hue, 'neutral', 'avatar'),
      episodeIds: [],
    }))
    characters.push(...cast)
    seed.episodes.forEach((episodeSeed) => {
      const episode = makeEpisode(project, episodeSeed)
      episodes.push(episode)
      if (episode.status === 'COMPLETED') fillEpisode(project, episode, cast, assets, storyLines, 'full')
      if (episode.status === 'ANALYZING' || episode.status === 'EXTRACTING') {
        fillEpisode(project, episode, cast, assets, storyLines, 'partial')
      }
      if (episode.status === 'FAILED') fillEpisode(project, episode, cast, assets, storyLines, 'failed')
    })
  })

  const exportJobs: ExportJob[] = [
    {
      id: 'job-fanpai-files',
      projectId: 'p-fanpai',
      episodeId: 'all',
      types: ['character', 'scene', 'audio'],
      includeRaw: false,
      includeJson: true,
      format: 'unity',
      status: 'completed',
      progress: 100,
      createdAt: daysAgo(1),
      fileName: '反派拿捏-演示清单.json',
    },
  ]

  return {
    user: { name: '洛明希', email: 'luomingxi@studio.local', storageUsedGb: 68, storageTotalGb: 200 },
    projects,
    episodes,
    characters,
    assets,
    storyLines,
    exportJobs,
  }
}

function makeEpisode(project: Project, seed: EpisodeSeed): Episode {
  const scene = sceneNames[(seed.number - 1) % sceneNames.length] ?? '教室'
  return {
    id: `${project.id}-e${seed.number}`,
    projectId: project.id,
    episodeNumber: seed.number,
    title: `第${seed.number}集`,
    videoUrl: DEMO_VIDEO_URL,
    posterUrl: sceneArt(`${project.name} · ${scene}`, seed.number),
    duration: 120,
    resolution: '1920×1080',
    status: seed.status,
    progress: seed.progress,
    uploadedAt: seed.status === 'PENDING' ? undefined : daysAgo(6 - (seed.number % 5)),
    errorMessage: seed.error,
    logs: initialLogs(seed.status, seed.error),
  }
}

function fillEpisode(
  project: Project,
  episode: Episode,
  cast: Character[],
  assets: Asset[],
  storyLines: StoryLine[],
  mode: 'full' | 'partial' | 'failed',
) {
  const scene = sceneNames[(episode.episodeNumber - 1) % sceneNames.length] ?? '教室'
  if (mode === 'failed') {
    const character = cast[0]
    if (!character) return
    assets.push(makeCharacterAsset(project, episode, character, 'illustration', 0, 'FAILED'))
    rememberEpisode(character, episode.id)
    return
  }
  const limitedCast = mode === 'partial' ? cast.slice(0, 1) : cast
  limitedCast.forEach((character, index) => {
    rememberEpisode(character, episode.id)
    const subtypes = mode === 'partial' ? (['illustration'] as const) : (['illustration', 'expression', 'expression', 'avatar', 'action'] as const)
    subtypes.forEach((subtype, subtypeIndex) => {
      assets.push(
        makeCharacterAsset(
          project,
          episode,
          character,
          subtype,
          index * 5 + subtypeIndex + episode.episodeNumber,
          mode === 'partial' ? 'RAW' : pickStatus(index + subtypeIndex + episode.episodeNumber),
        ),
      )
    })
  })
  const sceneCount = mode === 'partial' ? 1 : 2
  for (let index = 0; index < sceneCount; index += 1) {
    const name = sceneNames[(episode.episodeNumber + index) % sceneNames.length] ?? scene
    assets.push({
      id: `${episode.id}-scene-${index}`,
      projectId: project.id,
      episodeId: episode.id,
      type: 'scene',
      subtype: index === 0 ? 'indoor' : 'outdoor',
      name: `${name}_${episode.episodeNumber}.png`,
      sceneName: name,
      url: sceneArt(name, episode.episodeNumber + index),
      status: mode === 'partial' ? 'PROCESSING' : pickStatus(index + 3),
      startTime: 6 + index * 18,
      endTime: 12 + index * 18,
      width: 1920,
      height: 1080,
      fileSize: '3.1 MB',
      createdAt: daysAgo(1),
    })
  }
  if (mode === 'partial') return
  const speakers = cast.length > 0 ? cast : []
  speakers.slice(0, 3).forEach((character, index) => {
    const text = dialogueBank[(episode.episodeNumber + index) % dialogueBank.length] ?? '……'
    const audioId = `${episode.id}-audio-${index}`
    const lineId = `${episode.id}-line-${index}`
    const start = 8 + index * 9
    assets.push({
      id: audioId,
      projectId: project.id,
      episodeId: episode.id,
      characterId: character.id,
      type: 'audio',
      subtype: index === 2 ? 'bgm' : 'voice',
      name: `${character.name}_台词_${episode.episodeNumber}_${index + 1}.wav`,
      url: DEMO_AUDIO_URL,
      status: 'READY',
      startTime: start,
      endTime: start + 3,
      duration: 3,
      fileSize: '420 KB',
      createdAt: daysAgo(1),
      note: '试听文件是本地生成的演示音色，不是成片原声。',
    })
    assets.push({
      id: `${episode.id}-dialogue-${index}`,
      projectId: project.id,
      episodeId: episode.id,
      characterId: character.id,
      storyLineId: lineId,
      audioAssetId: audioId,
      type: 'dialogue',
      name: `${character.name} · 第${index + 1}句`,
      text,
      novelMatch: novelMatches[(episode.episodeNumber + index) % novelMatches.length],
      url: character.avatarUrl,
      status: index === 1 ? 'REVIEW' : 'READY',
      startTime: start,
      endTime: start + 3,
      sceneName: scene,
      fileSize: '2 KB',
      createdAt: daysAgo(1),
    })
    storyLines.push({
      id: lineId,
      projectId: project.id,
      episodeId: episode.id,
      order: index + 1,
      characterId: character.id,
      sceneName: scene,
      text,
      startTime: start,
      endTime: start + 3,
      novelExcerpt: project.novelText ?? '',
    })
  })
  const mover = cast[0]
  if (mover) {
    assets.push(makeMotion(project, episode, mover, scene, '走路'))
    assets.push(makeMotion(project, episode, cast[1] ?? mover, scene, '回头'))
  }
  assets.push(makeStoryboard(project, episode, scene, 0, cast[0]?.id))
  assets.push(makeStoryboard(project, episode, sceneNames[(episode.episodeNumber + 2) % sceneNames.length] ?? scene, 1, cast[1]?.id ?? cast[0]?.id))
}

function rememberEpisode(character: Character, episodeId: string) {
  if (!character.episodeIds.includes(episodeId)) character.episodeIds.push(episodeId)
}

function makeCharacterAsset(
  project: Project,
  episode: Episode,
  character: Character,
  subtype: 'illustration' | 'expression' | 'avatar' | 'action',
  salt: number,
  status: AssetStatus,
): Asset {
  const expression = expressions[salt % expressions.length] ?? 'neutral'
  const kind = subtype === 'avatar' ? 'avatar' : subtype === 'illustration' || subtype === 'action' ? 'full' : 'bust'
  const image = characterArt(character.name, character.hue, expression, kind)
  const isVideo = subtype === 'action'
  return {
    id: `${episode.id}-${character.id}-${subtype}-${salt}`,
    projectId: project.id,
    episodeId: episode.id,
    characterId: character.id,
    type: 'character',
    subtype,
    name: isVideo ? `${character.name}_动作_${episode.episodeNumber}.mp4` : `${character.name}_${subtypeLabelName(subtype)}_${episode.episodeNumber}.png`,
    url: isVideo ? episode.videoUrl : image,
    posterUrl: image,
    status,
    startTime: isVideo ? 2 : undefined,
    endTime: isVideo ? 5 : undefined,
    duration: isVideo ? 3 : undefined,
    width: isVideo ? 1280 : 768,
    height: isVideo ? 720 : subtype === 'avatar' ? 768 : 1152,
    fileSize: isVideo ? '8.4 MB' : '1.6 MB',
    createdAt: daysAgo(1),
    note: '原始提取画面，不是 Live2D 模型，不能标记为 Live2D 可用素材。',
  }
}

function subtypeLabelName(subtype: string) {
  if (subtype === 'illustration') return '立绘'
  if (subtype === 'expression') return '表情'
  if (subtype === 'avatar') return '头像'
  return '动作'
}

function makeMotion(project: Project, episode: Episode, character: Character, scene: string, action: string): Asset {
  return {
    id: `${episode.id}-motion-${character.id}-${action}`,
    projectId: project.id,
    episodeId: episode.id,
    characterId: character.id,
    type: 'motion',
    subtype: 'clip',
    name: `${character.name}_${action}.mp4`,
    sceneName: scene,
    url: episode.videoUrl,
    posterUrl: sceneArt(action, episode.episodeNumber + character.hue),
    status: 'READY',
    startTime: 1,
    endTime: 4,
    duration: 3,
    width: 1280,
    height: 720,
    fileSize: '12 MB',
    createdAt: daysAgo(1),
    note: '动作参考使用本地演示片花，时间戳来自素材元数据。',
  }
}

function makeStoryboard(project: Project, episode: Episode, scene: string, index: number, characterId?: string): Asset {
  const start = 4 + index * 16
  return {
    id: `${episode.id}-board-${index}`,
    projectId: project.id,
    episodeId: episode.id,
    characterId,
    type: 'storyboard',
    subtype: 'clip',
    name: `${scene}_分镜_${index + 1}.mp4`,
    sceneName: scene,
    url: episode.videoUrl,
    posterUrl: sceneArt(scene, episode.episodeNumber + index + 3),
    status: index === 0 ? 'READY' : 'REVIEW',
    startTime: start,
    endTime: start + 5,
    duration: 5,
    width: 1920,
    height: 1080,
    fileSize: '16 MB',
    createdAt: daysAgo(1),
  }
}

function touch(projectId: string) {
  const project = db.projects.find((item) => item.id === projectId)
  if (project) project.updatedAt = new Date().toISOString()
}

function pushLog(episode: Episode, level: AnalysisLog['level'], message: string) {
  if (episode.logs.some((item) => item.message === message)) return
  episode.logs.unshift(log(level, message))
  episode.logs = episode.logs.slice(0, 12)
}

export function getSnapshot(): Catalog {
  return structuredClone(db)
}

export function tick() {
  let changed = false
  db.episodes.forEach((episode) => {
    if (episode.status === 'UPLOADING') {
      episode.progress = Math.min(100, episode.progress + 28)
      changed = true
      if (episode.progress >= 100) {
        episode.status = 'QUEUED'
        episode.progress = 0
        pushLog(episode, 'info', '上传完成，已进入解析队列')
      }
    } else if (episode.status === 'ANALYZING') {
      episode.progress = Math.min(100, episode.progress + 8)
      pushLog(episode, 'info', `内容解析 ${episode.progress}%`)
      changed = true
      if (episode.progress >= 100) {
        episode.status = 'EXTRACTING'
        episode.progress = 8
        pushLog(episode, 'info', '开始提取角色、场景和台词')
      }
    } else if (episode.status === 'EXTRACTING') {
      episode.progress = Math.min(100, episode.progress + 12)
      changed = true
      if (episode.progress >= 100) {
        episode.status = 'COMPLETED'
        episode.progress = 100
        episode.errorMessage = undefined
        pushLog(episode, 'info', '解析完成，素材已关联到角色档案')
        const project = db.projects.find((item) => item.id === episode.projectId)
        const cast = db.characters.filter((item) => item.projectId === episode.projectId)
        if (project && !db.assets.some((asset) => asset.episodeId === episode.id && asset.status === 'READY')) {
          db.assets = db.assets.filter((asset) => asset.episodeId !== episode.id)
          db.storyLines = db.storyLines.filter((line) => line.episodeId !== episode.id)
          fillEpisode(project, episode, cast, db.assets, db.storyLines, 'full')
        }
      }
    }
  })
  db.exportJobs.forEach((job) => {
    if (job.status === 'running') {
      job.progress = Math.min(100, job.progress + 16)
      if (job.progress >= 100) job.status = 'completed'
      changed = true
    }
  })
  return changed
}

export function createProject(input: { name: string; description: string }) {
  const hue = [...input.name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360
  const project: Project = {
    id: uid('project'),
    name: input.name.trim(),
    description: input.description.trim(),
    coverUrl: characterArt(input.name.trim().slice(0, 4), hue, 'smile', 'bust'),
    tags: ['新建'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  db.projects.unshift(project)
  return project
}

export function updateProject(id: string, input: { name: string; description: string }) {
  const project = db.projects.find((item) => item.id === id)
  if (!project) return
  project.name = input.name.trim()
  project.description = input.description.trim()
  project.updatedAt = new Date().toISOString()
}

export function deleteProject(id: string) {
  db.projects = db.projects.filter((item) => item.id !== id)
  db.episodes = db.episodes.filter((item) => item.projectId !== id)
  db.characters = db.characters.filter((item) => item.projectId !== id)
  db.assets = db.assets.filter((item) => item.projectId !== id)
  db.storyLines = db.storyLines.filter((item) => item.projectId !== id)
  db.exportJobs = db.exportJobs.filter((item) => item.projectId !== id)
}

export function addCharacter(projectId: string, input: { name: string; role: string }) {
  const hue = [...input.name].reduce((sum, char) => sum + char.charCodeAt(0), 40) % 360
  const character: Character = {
    id: uid('character'),
    projectId,
    name: input.name.trim(),
    role: input.role.trim() || '配角',
    hue,
    summary: '手动建立的角色档案，等待后续集数关联。',
    avatarUrl: characterArt(input.name.trim(), hue, 'neutral', 'avatar'),
    episodeIds: [],
  }
  db.characters.push(character)
  touch(projectId)
  return character
}

export function addUploadedEpisodes(projectId: string, files: { name: string; url: string; duration: number }[]) {
  const numbers = db.episodes.filter((item) => item.projectId === projectId).map((item) => item.episodeNumber)
  let nextNumber = numbers.length > 0 ? Math.max(...numbers) : 0
  const created: Episode[] = []
  files.forEach((file) => {
    nextNumber += 1
    const episode: Episode = {
      id: uid('episode'),
      projectId,
      episodeNumber: nextNumber,
      title: file.name.replace(/\.[^.]+$/, '') || `第${nextNumber}集`,
      videoUrl: file.url,
      posterUrl: sceneArt('待解析', nextNumber),
      duration: file.duration > 0 ? Math.round(file.duration) : DEMO_VIDEO_URL.length,
      resolution: '本地文件',
      status: 'UPLOADING',
      progress: 12,
      uploadedAt: new Date().toISOString(),
      logs: [log('info', `已接收本地文件 ${file.name}。文件留在浏览器里，不会上传到服务器。`)],
    }
    if (!(file.duration > 0)) episode.duration = 5
    db.episodes.push(episode)
    created.push(episode)
  })
  db.user.storageUsedGb = Math.min(db.user.storageTotalGb, Number((db.user.storageUsedGb + files.length * 0.4).toFixed(1)))
  touch(projectId)
  return created
}

export function importNovel(projectId: string, fileName: string, text: string) {
  const project = db.projects.find((item) => item.id === projectId)
  if (!project) return
  project.novelName = fileName
  project.novelText = text
  project.updatedAt = new Date().toISOString()
  db.storyLines.forEach((line) => {
    if (line.projectId === projectId) line.novelExcerpt = text
  })
}

export function startAnalysis(episodeId: string) {
  const episode = db.episodes.find((item) => item.id === episodeId)
  if (!episode) return
  if (episode.status !== 'QUEUED' && episode.status !== 'PENDING') return
  episode.status = 'ANALYZING'
  episode.progress = 6
  episode.errorMessage = undefined
  pushLog(episode, 'info', '已从队列开始解析')
}

export function retryAnalysis(episodeId: string) {
  const episode = db.episodes.find((item) => item.id === episodeId)
  if (!episode || episode.status !== 'FAILED') return
  episode.status = 'ANALYZING'
  episode.progress = 10
  episode.errorMessage = undefined
  pushLog(episode, 'info', '已重新排队并开始解析')
}

export function updateDialogue(assetId: string, input: { text: string; characterId: string }) {
  const asset = db.assets.find((item) => item.id === assetId)
  if (!asset || asset.type !== 'dialogue') return
  asset.text = input.text.trim()
  asset.characterId = input.characterId
  asset.status = 'REVIEW'
  const line = db.storyLines.find((item) => item.id === asset.storyLineId)
  if (line) {
    line.text = asset.text
    line.characterId = input.characterId
  }
  touch(asset.projectId)
}

export function updateStory(lines: { id: string; text: string; characterId: string; sceneName: string }[]) {
  lines.forEach((draft) => {
    const line = db.storyLines.find((item) => item.id === draft.id)
    if (!line) return
    line.text = draft.text.trim()
    line.characterId = draft.characterId
    line.sceneName = draft.sceneName.trim() || line.sceneName
    const asset = db.assets.find((item) => item.storyLineId === line.id)
    if (asset) {
      asset.text = line.text
      asset.characterId = line.characterId
      asset.sceneName = line.sceneName
      asset.status = 'REVIEW'
    }
  })
  const first = db.storyLines.find((item) => item.id === lines[0]?.id)
  if (first) touch(first.projectId)
}

export function moveStory(lineId: string, direction: -1 | 1) {
  const line = db.storyLines.find((item) => item.id === lineId)
  if (!line) return
  const siblings = db.storyLines
    .filter((item) => item.episodeId === line.episodeId)
    .sort((a, b) => a.order - b.order)
  const index = siblings.findIndex((item) => item.id === lineId)
  const target = siblings[index + direction]
  if (!target) return
  const order = line.order
  line.order = target.order
  target.order = order
  touch(line.projectId)
}

export function createExport(input: {
  projectId: string
  episodeId: string
  types: AssetType[]
  includeRaw: boolean
  includeJson: boolean
  format: ExportFormat
}) {
  const project = db.projects.find((item) => item.id === input.projectId)
  const job: ExportJob = {
    id: uid('export'),
    ...input,
    status: 'running',
    progress: 8,
    createdAt: new Date().toISOString(),
    fileName: `${project?.name ?? '项目'}-演示清单.json`,
  }
  db.exportJobs.unshift(job)
  return job
}

export function buildExportDocument(job: ExportJob) {
  const project = db.projects.find((item) => item.id === job.projectId)
  const episodes = db.episodes.filter((item) => item.projectId === job.projectId && (job.episodeId === 'all' || item.id === job.episodeId))
  const episodeIds = new Set(episodes.map((item) => item.id))
  const assets = db.assets.filter((asset) => {
    if (!episodeIds.has(asset.episodeId) || !job.types.includes(asset.type)) return false
    if (!job.includeRaw && (asset.status === 'RAW' || asset.status === 'PROCESSING')) return false
    return true
  })
  const lines = db.storyLines.filter((line) => episodeIds.has(line.episodeId))
  return {
    disclaimer: '这是演示导出清单，只包含当前浏览器中的 Mock 元数据。不包含可直接导入 Unity 的真实图片、音频或模型文件。',
    format: job.format,
    project: project ? { id: project.id, name: project.name } : null,
    episodeId: job.episodeId,
    generatedAt: new Date().toISOString(),
    script: job.includeJson
      ? lines
          .sort((a, b) => a.order - b.order)
          .map((line) => ({
            id: line.id,
            episodeId: line.episodeId,
            order: line.order,
            speakerId: line.characterId,
            scene: line.sceneName,
            text: line.text,
            start: line.startTime,
            end: line.endTime,
          }))
      : [],
    files:
      job.format === 'story-json'
        ? []
        : assets.map((asset) => ({
            path:
              job.format === 'unity'
                ? `Assets/VideoToGame/${project?.name ?? 'Project'}/${asset.type}/${asset.name}`
                : `files/${asset.type}/${asset.name}`,
            name: asset.name,
            type: asset.type,
            status: asset.status,
            episodeId: asset.episodeId,
            characterId: asset.characterId ?? null,
            startTime: asset.startTime ?? null,
            endTime: asset.endTime ?? null,
            preview: asset.url.startsWith('/mock/') ? asset.url : '浏览器内联预览，未写入清单文件',
          })),
  }
}
