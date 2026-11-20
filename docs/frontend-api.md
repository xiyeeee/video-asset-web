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
