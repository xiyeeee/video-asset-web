# 前端提取接口适配

目标接口与当前 Java 接口还没有完全对齐。前端先走适配层，只展示真实接口返回的数据。

| 目标 | 当前行为 |
| --- | --- |
| `GET /api/media/v1/extraction-capabilities` | 成功时使用返回值，并补齐六种类型里缺失的项为不支持。404 时只将 `CHARACTER` 标为支持，因为它对应已上线的人物提取 |
| `POST /api/media/v1/projects/{projectId}/episodes` | 继续用于上传视频。不改用尚未存在的 `/api/media/videos/upload` |
| `POST /api/ai/v1/tasks` | 自动提取和手动发起时优先调用。404 后再调用人物提取 |
| `GET /api/ai/v1/tasks` | 任务中心优先调用。404 或空列表时，扫描项目、剧集和每集最新人物任务 |
| `POST /api/ai/v1/tasks/{taskId}/retry` | 优先调用。404 后使用人物任务重试 |
| 分镜结果 | `GET /api/ai/v1/projects/{projectId}/episodes/{episodeId}/frames` |
| 人物结果 | `GET /api/ai/v1/projects/{projectId}/episodes/{episodeId}/character-assets` |

人物任务状态 `SUCCEEDED` 在任务中心显示为 `SUCCESS`。没有 `PARTIAL_SUCCESS` 或 `CANCELLED` 的现有响应时，不会自行生成这两种状态。

签名图片地址只用于当次预览和下载，不写入本地存储或日志。
