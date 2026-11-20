# 上传与自动提取

剧集上传使用：

`POST /api/media/videos/upload`

请求是 `multipart/form-data`，字段为 `file`、`projectId`、`episodeNumber`、`autoExtract`、`extractTypes`，并携带 `Idempotency-Key`。自动提取由这次上传直接创建任务。视频已保存但任务没建成时，响应保留剧集 ID 和 `EXTRACTION_TASK_CREATE_FAILED`。该路径不存在时才回退旧的剧集上传。

上传区增加「上传完成后自动提取素材」，默认开启。

- 关闭时只保存视频，不创建提取任务。
- 开启时必须至少选择一种当前可用的提取类型。
- 类型来自 `GET /api/media/extraction-capabilities`。接口 404 时只把人物标为可用。
- 不支持的类型不能勾选。

确认上传后展示真实上传进度。文件传完后，同一次请求会创建提取任务。提交期间不能再次点击。上传成功但任务失败时，视频保留，可以只重试创建任务。成功后进入任务中心，前端不等待提取结束。
