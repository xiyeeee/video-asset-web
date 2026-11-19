# Mock 数据结构

类型定义在 `src/types/domain.ts`。初始数据在 `src/services/mock/catalog.ts` 生成，三个项目彼此独立。

- 反派拿捏：8 集，苏晚、陆沉、林夏
- 网恋女友是校花：6 集，唐棠、周予、乔麦
- 高冷校花的贴身高手：5 集，沈清、裴川

已完成的集数会生成角色立绘、表情、头像、动作，以及场景、台词、音频、动作参考和分镜。解析中的集数只有少量未完成素材。失败集数保留一条失败素材。排队和未上传的集数没有素材。

## 实体

### Project

`id`、`name`、`coverUrl`、`description`、`novelName`、`novelText`、`tags`、`createdAt`、`updatedAt`。

### Episode

`id`、`projectId`、`episodeNumber`、`title`、`videoUrl`、`posterUrl`、`duration`、`resolution`、`status`、`progress`、`uploadedAt`、`errorMessage`、`logs`。

`status` 取 `PENDING | UPLOADING | QUEUED | ANALYZING | EXTRACTING | COMPLETED | FAILED`。

`duration` 在种子数据里是叙事时长 120 秒。实际可播放文件是 5 秒演示片花，或用户本次上传的本地文件。

### Character

`id`、`projectId`、`name`、`role`、`hue`、`avatarUrl`、`episodeIds`、`summary`。

同一项目里的同名角色只有一条档案。新集数生成素材时把集数 id 追加到 `episodeIds`。

### Asset

`id`、`projectId`、`episodeId`、`characterId`、`storyLineId`、`type`、`subtype`、`name`、`url`、`posterUrl`、`status`、`startTime`、`endTime`、`width`、`height`、`duration`、`fileSize`、`sceneName`、`text`、`novelMatch`、`audioAssetId`、`createdAt`、`note`。

`type` 取 `character | scene | dialogue | audio | motion | storyboard`。

`status` 取 `RAW | PROCESSING | REVIEW | READY | FAILED`，分别表示原始提取、处理中、待审核、可用于游戏、处理失败。

角色图片的 `note` 明确写明这是原始画面，不是 Live2D 模型。

### StoryLine

`id`、`projectId`、`episodeId`、`order`、`characterId`、`sceneName`、`text`、`startTime`、`endTime`、`novelExcerpt`。

台词素材通过 `storyLineId` 指向对应行。编辑台词或保存脚本时两边一起更新。

### ExportJob

`id`、`projectId`、`episodeId`（`all` 或具体集数）、`types`、`includeRaw`、`includeJson`、`format`（`files | story-json | unity`）、`status`、`progress`、`createdAt`、`fileName`。

## 关联规则

- 集数属于一个项目。
- 角色属于一个项目，可关联多集。
- 素材同时属于项目和集数；角色类、台词、音频、动作通常还有 `characterId`。
- 场景使用 `sceneName`，不强制绑定角色。
- 删除项目会同时移除它的集数、角色、素材、台词和导出任务。

刷新页面会恢复种子数据。上传文件和新建项目只保存在当前内存快照里。
