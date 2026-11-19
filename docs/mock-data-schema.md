# Mock 数据结构

类型定义在 `src/types/domain.ts`，本地目录由 `src/services/mock/catalog.ts` 维护。
初始目录为空。项目管理和工作台的「我的项目」由后端项目接口提供。

## 实体

### Project

`id`、`name`、`coverUrl`、`description`、`novelName`、`novelText`、`tags`、`createdAt`、`updatedAt`。

### Episode

`id`、`projectId`、`episodeNumber`、`title`、`videoUrl`、`posterUrl`、`duration`、`resolution`、`status`、`progress`、`uploadedAt`、`errorMessage`、`logs`。

`status` 取 `PENDING | UPLOADING | QUEUED | ANALYZING | EXTRACTING | COMPLETED | FAILED`。

`duration` 以秒为单位。本地演示使用浏览器读取的视频时长。

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

本地演示操作保存在当前内存快照中，刷新页面会恢复为空。真实项目通过后端保存。
