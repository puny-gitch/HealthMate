# HealthMate 后端联调改动说明（2026-05-10）

本文档给前端说明本次后端接口行为变化和需要适配的点。

## 1. 健康记录：先 AI 解析预览，再用户确认落库

新增接口：

```text
POST /api/health/record/parse-ai
```

请求体：

```json
{
  "rawInput": "中午吃了鸡胸肉沙拉，晚上跑步30分钟，昨晚睡了6小时",
  "recordedAt": "2026-05-10T20:30:00"
}
```

返回：

```json
{
  "code": 0,
  "message": "解析成功",
  "data": {
    "parseId": "uuid",
    "confidence": "medium",
    "confidenceScore": 0.76,
    "shouldSave": true,
    "failureReason": null,
    "suggestions": [],
    "warnings": ["睡眠时间可能指昨晚，请确认记录日期。"],
    "previewData": {
      "recordedAt": "2026-05-10T20:30:00",
      "recordDate": "2026-05-10",
      "recordType": "mixed",
      "rawInput": "...",
      "sleepMinutes": 360,
      "intakeCalories": null,
      "exerciseCalories": 220,
      "nutritionDetails": {"foods": ["鸡胸肉沙拉"], "mealType": "lunch"},
      "exerciseDetails": {"items": [{"type": "跑步", "durationMinutes": 30, "estimatedBurnKcal": 220}]},
      "healthTags": ["睡眠记录", "有氧训练"],
      "parseWarnings": ["睡眠时间可能指昨晚，请确认记录日期。"]
    }
  }
}
```

前端适配：

- 输入后先调 `/api/health/record/parse-ai`。
- 如果 `shouldSave === false`，不要展示确认入库按钮；弹出 `failureReason`，并展示 `suggestions` 引导用户优化输入。
- 如果 `confidence === "low"` 或 `warnings` 非空，展示提示。
- 把 `previewData` 渲染成可编辑表单。
- 用户确认后调已有接口：

```text
POST /api/health/record/confirm
```

请求体：

```json
{
  "parseId": "uuid",
  "rawInput": "原始输入",
  "previewData": {},
  "userModifiedData": {
    "sleepMinutes": 360,
    "exerciseCalories": 220,
    "healthTags": ["睡眠偏少", "跑步"]
  }
}
```

识别失败示例：

```json
{
  "code": 0,
  "message": "未识别出可落库的健康记录字段。",
  "data": {
    "parseId": "uuid",
    "confidence": "low",
    "confidenceScore": 0.25,
    "shouldSave": false,
    "failureReason": "未识别出可落库的健康记录字段。",
    "suggestions": ["补充睡眠时长、饮食内容或运动类型/时长。"],
    "warnings": ["未识别出明确睡眠、饮食或运动数据，请补充时间、数量或类型。"],
    "previewData": {}
  }
}
```

涉及病痛或高危症状时，后端会优先用大模型判断是否超出日常健康记录范畴，尤其是病痛/症状/疾病/用药/心理危机等；大模型不可用时使用正则关键词兜底。命中后拒绝保存，前端直接弹 `message`：

```json
{
  "code": 40020,
  "message": "检测到可能涉及病痛或高危症状（胸痛），本条记录不会保存，请及时就医或咨询专业医生。",
  "data": {
    "parseId": null,
    "confidence": "low",
    "confidenceScore": 0,
    "shouldSave": false,
    "failureReason": "检测到可能涉及病痛或高危症状（胸痛），本条记录不会保存，请及时就医或咨询专业医生。",
    "suggestions": ["请及时就医或咨询专业医生。", "病痛症状不作为普通健康记录保存。"],
    "warnings": ["检测到可能涉及病痛或高危症状（胸痛），本条记录不会保存，请及时就医或咨询专业医生。"],
    "previewData": {},
    "riskSource": "llm"
  }
}
```

## 2. 健康记录改为每日多条新增

`POST /api/health/data` 和 `POST /api/health/record/confirm` 现在都是新增记录，不再覆盖当天已有记录。

前端适配：

- 不要假设一天只有一条健康记录。
- `GET /api/health/record/recent` 会返回多条记录。
- Dashboard/Trends 后端已按天聚合多条记录。
- 如果页面展示“今日记录”，应使用记录列表，而不是单条对象。

### 健康记录历史与删除

新增接口：

```text
GET /api/health/record/history
```

返回当前登录用户保存过的全部健康记录，按 `recordedAt` 倒序排列：

```json
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "records": [
      {
        "recordId": 12,
        "recordDate": "2026-05-12",
        "recordedAt": "2026-05-12T20:30:00",
        "recordType": "mixed",
        "rawInput": "中午吃了鸡胸肉沙拉，晚上跑步30分钟",
        "sleepMinutes": null,
        "estimatedIntakeKcal": 480,
        "estimatedBurnKcal": 220,
        "nutritionDetails": {},
        "exerciseDetails": {},
        "healthTags": ["有氧训练"],
        "confidence": "medium",
        "parseWarnings": [],
        "updatedAt": "2026-05-12T20:31:00"
      }
    ],
    "total": 1
  }
}
```

删除接口：

```text
DELETE /api/health/record/{recordId}
```

返回：

```json
{
  "code": 0,
  "message": "删除成功",
  "data": {
    "recordId": 12
  }
}
```

前端适配：

- 做一个健康记录历史列表，展示 `rawInput`、结构化字段、时间、可信度和警告。
- 删除前建议二次确认，提示“删除后将不再参与趋势、建议和任务生成”。
- 删除成功后刷新历史列表、Dashboard、Trends，以及后续建议/任务生成所依赖的数据。
- 删除只能删除当前登录用户自己的记录；如果后端返回 `40430`，提示记录不存在或无权删除。

## 3. AI 建议不再自动生成任务

`GET /api/advice/stream?token=...` 现在只输出建议并保存建议历史，不再自动写入今日任务。

SSE 事件：

```text
event: message
data: 单字或片段

event: advice
data: {"adviceText":"完整建议"}

event: done
data: [DONE]
```

前端适配：

- 不再监听 `tasks` 事件作为已创建任务。
- 建议生成完成后，如果用户点击“生成任务”，再调任务预览接口。

## 4. 任务改为候选预览 + 用户选择加入

新增接口：

```text
POST /api/task/generate-preview
```

请求体：

```json
{
  "targetDate": "2026-05-10",
  "maxTasks": 3
}
```

返回：

```json
{
  "code": 0,
  "message": "候选任务生成成功",
  "data": {
    "targetDate": "2026-05-10",
    "candidates": [
      {
        "draftId": "uuid",
        "taskContent": "晚饭后快走 20 分钟，避免跑跳动作",
        "aiReason": "结合减脂目标和伤病史，优先选择低冲击运动",
        "difficulty": "easy",
        "similarityWarning": false
      }
    ],
    "skippedReasons": ["已完成任务中已有相似任务：23:30 前入睡"]
  }
}
```

用户勾选后调用：

```text
POST /api/task/add-selected
```

请求体：

```json
{
  "targetDate": "2026-05-10",
  "tasks": [
    {
      "taskContent": "晚饭后快走 20 分钟，避免跑跳动作",
      "aiReason": "结合减脂目标和伤病史，优先选择低冲击运动",
      "difficulty": "easy"
    }
  ]
}
```

返回会给出真正入库后的 `taskId`。

前端适配：

- 任务候选使用 checkbox/多选，不要直接加入今日任务。
- 提交后，后端会先归档当天所有未完成任务，再写入用户选中的新任务。返回中的 `archivedUnfinishedTaskCount` 表示被覆盖的未完成任务数量。
- 提交后用 `/api/task/today` 刷新今日任务列表。
- 展示 `skippedReasons`，用于解释为什么没有生成某些方向的任务。

## 5. Profile 拆分过敏史和伤病史

`GET /api/profile` 现在稳定返回：

```json
{
  "injuryHistory": "膝盖偶尔不适",
  "allergyHistory": "无明确食物过敏",
  "medicalHistory": "伤病史：膝盖偶尔不适；过敏史：无明确食物过敏"
}
```

`POST /api/profile` / `PUT /api/profile` 支持：

```json
{
  "healthGoal": "减脂",
  "injuryHistory": "膝盖偶尔不适",
  "allergyHistory": "无明确食物过敏"
}
```

前端适配：

- 表单拆成两个输入项：伤病史、过敏史。
- `medicalHistory` 仅作为旧字段兼容或摘要展示，不建议继续作为编辑主字段。
