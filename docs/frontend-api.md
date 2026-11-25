# 前端提取接口适配

能力、任务和分镜素材走网关文档中的完整路径。网关去掉 `/api/media` 或 `/api/ai` 后，服务上的路径不带 `/v1`。

| 接口 | 当前行为 |
| --- | --- |
| `GET /api/media/extraction-capabilities` | 使用返回值，并补齐缺失类型为不支持。404 时仍只把人物标为可用 |
| `POST /api/ai/tasks` | 请求体是 `episodeId` 和 `extractTypes`。404 且选择了人物时，再调用原人物提取 |
| `GET /api/ai/tasks` | 按 `{items,pageNum,pageSize,total}` 读取。列表步骤为空时，详情再请求 `GET /api/ai/tasks/{taskId}`。接口 404 时扫描原人物任务 |
| `POST /api/ai/tasks/{taskId}/retry` | 优先调用。404 后使用人物任务重试 |
| `GET /api/media/episodes/{episodeId}/assets?type=SHOT` | 正式分镜。超过一页时用第一条的 `sourceTaskId` 固定后续页 |
| 历史首帧 | 没有正式分镜时仍读 `GET /api/ai/v1/projects/{projectId}/episodes/{episodeId}/frames` |
| `POST /api/media/videos/upload` | 一次提交文件、集号、`autoExtract` 和 `extractTypes`。任务创建失败时保留 `episodeId` 和 `taskErrorCode`。该路径 404 时才回退旧上传 |
| 人物图片 | 优先 `GET /api/media/episodes/{episodeId}/assets?type=CHARACTER`。404 时回退旧人物分页 |
| 音频 | `GET /api/media/episodes/{episodeId}/assets?type=AUDIO`，当前类型为 `ORIGINAL_TRACK` |
| `GET /api/media/episodes/{episodeId}/assets?type=DIALOGUE` | 对白文本和时间。超过一页时用第一条的 `sourceTaskId` 固定后续页。`expiresInSeconds` 为 0 |
| `GET /api/media/episodes/{episodeId}/assets?type=BACKGROUND` | 按镜头返回背景候选。超过一页时用第一条的 `sourceTaskId` 固定后续页。签名图片过期后重新获取 |

进度只在接口返回 `100` 时显示百分之百。签名地址只用于当次预览，不写入本地存储或日志。

## Live2D

图片上传和生成任务走网关信封 `{code,message,data}` 与 Bearer。本地图使用下面的上传路径，不复用会创建剧集的视频上传。

| 接口 | 行为 |
| --- | --- |
| `POST /api/projects/{projectId}/files` | multipart 字段 `file`。成功 `data.uploadFileId`。只接受 PNG、JPEG、WebP，不超过 10 MiB |
| `POST /api/projects/{projectId}/live2d/tasks` | `{modelName, uploadFileId}` 或 `{modelName, sourceAssetId}`，两者只提交一个 |
| `GET /api/projects/{projectId}/live2d/tasks/{taskId}` | 读取当前快照。成功时含 `result.modelId`、`result.modelEntryUrl`、`saveStatus`。保存完成后还有 `result.characterId` 与 `result.versionId` |
| `WebSocket /api/projects/{projectId}/live2d/tasks/{taskId}/events` | 提交后的状态推送。子协议为 `video-asset.bearer` 和访问令牌。生成失败，或成功且保存结束为 `SAVED` / `FAILED` 后关闭 |
| `GET /api/projects/{projectId}/live2d/characters?page=&size=` | 有已保存模型的角色。`items[]` 含 `characterId`、`name`、`avatarUrl`、`latestVersionId`，并带 `page`、`size`、`total` |
| `GET /api/projects/{projectId}/live2d/characters/{characterId}/versions?page=&size=` | 该角色的历史版本。`items[]` 含 `versionId`、`versionNumber`、`modelName`、`savedAt`、`status`、`thumbnailUrl` |
| `GET /api/projects/{projectId}/live2d/characters/{characterId}/versions/{versionId}` | 版本详情。`version` 为版本摘要，另有 `modelEntryUrl`、`previewExpiresInSeconds`、`downloadUrl`。预览票据过期时重新调用 |
| `GET /api/projects/{projectId}/live2d/characters/{characterId}/versions/{versionId}/download` | 带 Bearer 下载 ZIP。文件名取 `Content-Disposition` |
| `GET /api/projects/{projectId}/live2d/combo-motions/catalog?modelVersionId=&page=&size=` | 当前模型的预设、动作和台词。预设含 `supported`、`parameterIds`、`missingParameterIds`；动作含 `sourceId`、`group`、`durationMs`；台词分页返回 |
| `POST /api/projects/{projectId}/live2d/combo-motions/compile` | 编译当前草稿。同一 `requestId` 只对应同一时间轴。`status` 为 `READY` 或 `CONFLICT`，并返回 `compilationId`、`issues`、`missingCapabilities`、`modelEntryUrl`、`playbackManifest` |
| `GET /api/projects/{projectId}/live2d/combo-motions?page=&size=` | 已保存组合。列表项主键是 `id`，另有 `modelVersionId`、`name`、`durationMs`、`status` |
| `POST /api/projects/{projectId}/live2d/combo-motions` | 新建组合。请求体重复当前时间轴，并带本次编译的 `compilationId` 和另一个 `requestId` |
| `GET/PUT /api/projects/{projectId}/live2d/combo-motions/{comboId}` | 读取或更新已保存组合。更新不能更换模型版本，请求体同样带 `compilationId` |
| `POST /api/projects/{projectId}/live2d/combo-motions/save-requests/{requestId}/retry` | 保存失败后用同一次 `requestId` 重试 |

`modelEntryUrl` 指向 `.model3.json`。相对引用按该文件所在目录解析并沿用路径中的项目模型票据，无需附带 Bearer。票据 10 分钟过期，届时重新获取版本详情。保存状态为 `SAVED` 后才显示「已保存」，并用 `result.characterId`、`result.versionId` 打开对应历史。头像和缩略图只用于当次展示。
