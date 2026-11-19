# 后端接口需求

前端现在调用 `src/services/mock/catalog.ts`。对接 Java 后端时，建议保持下面的资源划分，并用 Axios 替换这些函数。上传使用 `multipart/form-data`。解析进度使用 SSE，不要改成前端轮询作为唯一方案。

鉴权、用户和存储配额可以后补。当前界面上的用户只是会话展示。

## 项目

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/projects` | 项目列表，含集数、完成数和素材数 |
| POST | `/api/projects` | 创建项目，字段 `name`、`description` |
| GET | `/api/projects/{projectId}` | 项目详情，含原著文件名和摘录 |
| PATCH | `/api/projects/{projectId}` | 修改名称和简介 |
| DELETE | `/api/projects/{projectId}` | 删除项目及其集数、角色、素材 |

## 原著与视频

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/projects/{projectId}/novel` | 上传 TXT，返回文件名和文本 |
| POST | `/api/projects/{projectId}/episodes` | 上传一个或多个视频，创建集数并进入 `UPLOADING` |
| GET | `/api/projects/{projectId}/episodes` | 集数列表，含状态、进度、时长、分辨率、素材数 |

上传响应不要把不存在的素材标记为已提取。文件保存完成后状态应为 `QUEUED`。

## 解析

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/episodes/{episodeId}/analyze` | 从 `PENDING` 或 `QUEUED` 开始解析 |
| POST | `/api/episodes/{episodeId}/retry` | 失败任务重新进入 `ANALYZING` |
| GET | `/api/episodes/{episodeId}/events` | SSE。事件携带 `status`、`progress`、`log` |

状态机保持 `PENDING -> UPLOADING -> QUEUED -> ANALYZING -> EXTRACTING -> COMPLETED`，失败进入 `FAILED`。SSE 日志字段与前端 `AnalysisLog` 一致：`id`、`time`、`level`、`message`。

## 角色与素材

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/projects/{projectId}/characters` | 项目角色档案和 `episodeIds` |
| POST | `/api/projects/{projectId}/characters` | 手动新增角色 |
| GET | `/api/projects/{projectId}/assets` | 按 `episodeId`、`type`、`characterId`、`scene`、`subtype`、`status`、`q` 筛选 |
| GET | `/api/assets/{assetId}` | 素材详情 |
| PATCH | `/api/assets/{assetId}` | 修改台词文本和说话角色，并同步剧情行 |
| GET | `/api/assets/{assetId}/file` | 下载真实文件 |

角色必须按项目去重。同一人物出现在多集时返回同一个 `characterId`。原始截图、立绘和表情的状态可以是 `RAW`、`PROCESSING`、`REVIEW` 或 `READY`，但接口不能把它们标成 Live2D 模型。

## 剧情

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/episodes/{episodeId}/script` | 按 `order` 返回台词行和原著摘录 |
| PUT | `/api/episodes/{episodeId}/script` | 保存台词、角色、场景和顺序 |

请求体是 `StoryLine` 数组。第一阶段不需要分支、选项或事件节点。

## 导出

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/exports` | 创建任务。字段见 `ExportJob` |
| GET | `/api/projects/{projectId}/exports` | 导出历史和进度 |
| GET | `/api/exports/{jobId}/file` | 下载结果 |

`episodeId` 为 `all` 表示全部集数。`includeRaw` 为 false 时排除 `RAW` 和 `PROCESSING`。`includeJson` 决定是否写入剧情行。`format` 为 `files`、`story-json` 或 `unity`。

在真实文件尚未生成时，接口应返回任务状态，不能返回一个看起来像完整 Unity 包的空压缩文件。
