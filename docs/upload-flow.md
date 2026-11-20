# 上传与自动提取

剧集上传仍使用现有接口：

`POST /api/media/v1/projects/{projectId}/episodes`

请求是 `multipart/form-data`，字段为 `file`，并携带 `Idempotency-Key`。服务端分配集数，前端不另传 `episodeNumber`。

上传区增加「上传完成后自动提取素材」，默认开启。

- 关闭时只保存视频，不创建提取任务。
- 开启时必须至少选择一种当前可用的提取类型。
- 类型来自 `GET /api/media/v1/extraction-capabilities`。该接口尚未提供时，适配层只把已有的人物提取标为可用，其余类型显示「即将支持」，不能勾选。
- 不支持的类型不会被当成已支持。

确认上传后的状态包括：待上传、上传中、上传成功、上传失败、创建任务中、任务创建成功、任务创建失败。上传过程展示浏览器实际上传进度。提交期间按钮不可再次点击，避免重复创建任务。

自动提取会先尝试 `POST /api/ai/v1/tasks`。接口不存在时，若选择了人物，则调用已有的

`POST /api/ai/v1/projects/{projectId}/episodes/{episodeId}/character-extraction/tasks`

上传成功但任务创建失败时，视频保留在剧集中，可以只重试创建任务。成功后进入任务中心。前端不会等待提取结束。
