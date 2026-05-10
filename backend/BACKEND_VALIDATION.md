# HealthMate 后端 Swagger 验证流程

本文档用于下次快速启动后端，并主要通过 Swagger 页面验证接口。PowerShell 只用于环境启动、依赖安装、测试和少量辅助检查；接口验证统一走浏览器中的 Swagger UI。

## 1. 前置条件

- MySQL 已启动。
- 项目路径：

```powershell
D:\ZhouWei\Documents\VSCodeProjects\HealthMate
```

- 后端技术栈：

```text
FastAPI + SQLAlchemy + MySQL + JWT + passlib/bcrypt
```

## 2. 准备 MySQL 数据库

进入 MySQL：

```powershell
mysql -u root -p
```

创建数据库：

```sql
CREATE DATABASE IF NOT EXISTS healthmate
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

SHOW DATABASES;

EXIT;
```

如果需要清空旧测试数据，可以重建库：

```sql
DROP DATABASE IF EXISTS healthmate;
CREATE DATABASE healthmate
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

## 3. 配置后端环境

进入后端目录：

```powershell
cd D:\ZhouWei\Documents\VSCodeProjects\HealthMate\backend
```

复制环境变量文件：

```powershell
Copy-Item .env.example .env -Force
notepad .env
```

确认 `.env` 至少包含：

```env
APP_ENV=dev
APP_NAME=HealthMate Backend
API_PREFIX=/api
JWT_SECRET=change-me-in-production
JWT_EXPIRE_MINUTES=1440
AI_MODE=mock
LLM_API_BASE=
LLM_API_KEY=
LLM_MODEL=deepseek-chat
LLM_TIMEOUT_SECONDS=5
REDIS_URL=
CACHE_TTL_SECONDS=604800

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=123456
DB_NAME=healthmate
```

如果本机 MySQL 密码不是 `123456`，修改 `DB_PASSWORD`。

## 4. 创建并激活虚拟环境

```powershell
cd D:\ZhouWei\Documents\VSCodeProjects\HealthMate\backend

python -m venv .venv
Set-ExecutionPolicy -Scope Process Bypass
.\.venv\Scripts\Activate.ps1
```

激活成功后，命令行前面会出现：

```text
(.venv)
```

如果已有坏的虚拟环境，可以删除后重建：

```powershell
deactivate
Remove-Item -Recurse -Force .venv
python -m venv .venv
Set-ExecutionPolicy -Scope Process Bypass
.\.venv\Scripts\Activate.ps1
```

## 5. 安装依赖

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

注意：`requirements.txt` 中需要固定兼容版本：

```txt
passlib[bcrypt]==1.7.4
bcrypt==4.0.1
```

如果注册时报 `password cannot be longer than 72 bytes`，执行：

```powershell
python -m pip uninstall bcrypt -y
python -m pip install -r requirements.txt
```

验证密码哈希：

```powershell
python -c "from app.core.security import hash_password, verify_password; h=hash_password('abc123456'); print(h); print(verify_password('abc123456', h))"
```

预期最后一行：

```text
True
```

## 6. 本地检查

编译检查：

```powershell
python -m compileall app tests -q
```

运行测试：

```powershell
python -m pytest
```

预期：

```text
3 passed
```

检查数据库连接：

```powershell
python -c "from app.db.session import engine; c=engine.connect(); print('db connected'); c.close()"
```

手动建表：

```powershell
python -c "from app.db.init_db import init_db; init_db(); print('tables created')"
```

## 7. 启动后端

在 `backend` 目录执行：

```powershell
uvicorn app.main:app --reload --port 8080
```

预期：

```text
Uvicorn running on http://127.0.0.1:8080
Application startup complete.
```

浏览器打开 Swagger：

```text
http://localhost:8080/docs
```

健康检查也可以在浏览器打开：

```text
http://localhost:8080/healthz
```

预期：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "status": "ok"
  }
}
```

## 8. Swagger 使用方式

每个接口按同一套操作：

1. 在 Swagger 页面展开目标接口。
2. 点击 `Try it out`。
3. 填写参数或请求体。
4. 点击 `Execute`。
5. 查看 `Server response` 中的状态码和返回 JSON。

需要登录的接口必须先完成登录，并在右上角 `Authorize` 中配置 token。

## 9. 注册

接口：

```text
POST /api/auth/register
```

请求体：

```json
{
  "username": "test051001",
  "password": "abc123456",
  "confirmPassword": "abc123456"
}
```

说明：

- 如果用户名已存在，换成新的，例如 `test051002`。
- 密码至少 6 位。

预期状态码：

```text
200
```

预期返回：

```json
{
  "code": 0,
  "message": "注册成功",
  "data": {
    "userId": 1
  }
}
```

## 10. 登录

接口：

```text
POST /api/auth/login
```

请求体：

```json
{
  "username": "test051001",
  "password": "abc123456"
}
```

预期状态码：

```text
200
```

预期返回：

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "token": "这里是一长串 JWT",
    "expireAt": "2026-05-11T...",
    "userId": 1
  }
}
```

复制 `data.token`，后续鉴权要用。

## 11. Swagger 鉴权

点击 Swagger 右上角 `Authorize`。

输入：

```text
Bearer <你的 token>
```

示例：

```text
Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

点击 `Authorize`，再点击 `Close`。

注意：

- `Bearer` 后面有一个空格。
- Swagger 的鉴权框需要带 `Bearer`。
- SSE 浏览器 URL 里只放纯 token，不带 `Bearer`。

## 12. 保存健康档案

接口：

```text
POST /api/profile
```

请求体：

```json
{
  "gender": 1,
  "height": 175,
  "weight": 68,
  "healthGoal": "减脂",
  "medicalHistory": "无"
}
```

字段说明：

- `gender`: `0` 未知，`1` 男，`2` 女。
- `height`: 身高，单位 cm。
- `weight`: 体重，单位 kg。
- `healthGoal`: 健康目标。
- `medicalHistory`: 病史或备注。

预期状态码：

```text
200
```

预期返回：

```json
{
  "code": 0,
  "message": "保存成功",
  "data": {
    "userId": 1,
    "gender": 1,
    "height": 175,
    "weight": 68,
    "healthGoal": "减脂",
    "medicalHistory": "无"
  }
}
```

## 13. 风险词拦截

接口：

```text
POST /api/health/parse
```

请求体：

```json
{
  "rawInput": "今天有胸痛和晕厥"
}
```

预期状态码：

```text
400
```

预期返回：

```json
{
  "code": 40020,
  "message": "检测到高危词汇，请立即就医",
  "data": null
}
```

这是正确结果，表示风险词拦截生效。

## 14. 正常自然语言解析

接口：

```text
POST /api/health/parse
```

请求体：

```json
{
  "rawInput": "我今天睡了7小时，运动消耗300kcal，吃了500卡"
}
```

预期状态码：

```text
200
```

预期返回：

```json
{
  "code": 0,
  "message": "解析成功",
  "data": {
    "estimatedIntakeKcal": 500,
    "estimatedBurnKcal": 300,
    "sleepMinutes": 420,
    "healthTags": [
      "有氧训练",
      "睡眠记录"
    ],
    "nutritionDetails": {},
    "confidence": "high"
  }
}
```

## 15. 提交健康数据

接口：

```text
POST /api/health/data
```

请求体：

```json
{
  "rawInput": "我今天睡了7小时，运动消耗300kcal，吃了500卡",
  "sleepMinutes": 420,
  "intakeCalories": 500,
  "exerciseCalories": 300,
  "tags": ["有氧", "睡眠记录"]
}
```

预期状态码：

```text
200
```

预期返回：

```json
{
  "code": 0,
  "message": "提交成功",
  "data": {
    "recordId": 1,
    "confidence": "high"
  }
}
```

说明：

- 同一天重复提交会按 `user_id + record_date` 更新，不会创建多条重复健康记录。
- 如果想提交指定日期，可以额外传：

```json
{
  "recordDate": "2026-05-10"
}
```

## 16. 查看仪表盘

接口：

```text
GET /api/health/dashboard
```

请求参数：

```text
无
```

预期状态码：

```text
200
```

预期返回重点：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "completionRate": 0,
    "categories": ["2026-05-04", "...", "2026-05-10"],
    "sleepSeries": [0, 0, 0, 0, 0, 0, 420],
    "intakeSeries": [0, 0, 0, 0, 0, 0, 500],
    "burnSeries": [0, 0, 0, 0, 0, 0, 300]
  }
}
```

## 17. 查看趋势

接口：

```text
GET /api/health/trends
```

Query 参数：

```text
dimension=week
```

可选值：

```text
week
month
```

预期状态码：

```text
200
```

预期返回重点：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "dimension": "week",
    "categories": ["2026-05-04", "...", "2026-05-10"],
    "sleepSeries": [0, 0, 0, 0, 0, 0, 420],
    "intakeSeries": [0, 0, 0, 0, 0, 0, 500],
    "burnSeries": [0, 0, 0, 0, 0, 0, 300],
    "tagDistribution": {
      "有氧": 1,
      "睡眠记录": 1
    }
  }
}
```

## 18. 生成 AI 建议流

Swagger 不适合查看 SSE 流。使用浏览器新标签打开：

```text
http://localhost:8080/api/advice/stream?token=<你的纯 token>
```

示例：

```text
http://localhost:8080/api/advice/stream?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

注意：

- 这里不要加 `Bearer`。
- `.env` 中 `AI_MODE=mock` 时不需要 API key。
- 如果 `AI_MODE=llm` 但没有配置 `LLM_API_BASE` 或 `LLM_API_KEY`，系统会自动回退 Mock。

预期页面内容类似：

```text
event: message
data: 维

event: message
data: 持

event: tasks
data: [{"taskId":1,"taskContent":"23:30 前入睡","aiReason":"稳定睡眠有助于恢复和代谢"}]

event: done
data: [DONE]
```

生成建议后，系统会同步写入：

- 建议历史 `t_advice_history`
- 今日任务 `t_daily_task`

## 19. 查看今日任务

回到 Swagger。

接口：

```text
GET /api/task/today
```

请求参数：

```text
无
```

预期状态码：

```text
200
```

预期返回：

```json
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "tasks": [
      {
        "taskId": 1,
        "taskDate": "2026-05-10",
        "taskContent": "23:30 前入睡",
        "status": 0,
        "aiReason": "稳定睡眠有助于恢复和代谢",
        "updatedAt": "2026-05-10T..."
      }
    ],
    "completionRate": 0
  }
}
```

记录其中的 `taskId`，下一步打卡使用。

## 20. 打卡任务

接口：

```text
POST /api/task/check
```

请求体：

```json
{
  "taskId": 1,
  "status": 1
}
```

说明：

- `taskId` 换成上一步真实返回的值。
- `status=1` 表示完成。
- `status=0` 表示未完成。

预期状态码：

```text
200
```

预期返回：

```json
{
  "code": 0,
  "message": "更新成功",
  "data": {
    "taskId": 1,
    "status": 1,
    "updatedAt": "2026-05-10T..."
  }
}
```

## 21. 查看任务历史

接口：

```text
GET /api/task/history
```

Query 参数：

```text
date 可选，例如 2026-05-10
```

不填 `date` 时查询当前用户的任务列表。

预期状态码：

```text
200
```

预期返回：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "tasks": [
      {
        "taskId": 1,
        "taskDate": "2026-05-10",
        "taskContent": "23:30 前入睡",
        "status": 1,
        "aiReason": "稳定睡眠有助于恢复和代谢"
      }
    ],
    "completionRate": 100
  }
}
```

## 22. 查看建议历史

接口：

```text
GET /api/advice/history
```

请求参数：

```text
无
```

预期状态码：

```text
200
```

预期返回：

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "adviceId": 1,
      "adviceText": "维持当前作息，避免熬夜...",
      "createdAt": "2026-05-10T..."
    }
  ]
}
```

## 23. 生成健康总结

接口：

```text
POST /api/health/summary/generate
```

Query 参数：

```text
startDate=2026-05-04
endDate=2026-05-10
cycle=week
```

可选 `cycle`：

```text
week
month
```

预期状态码：

```text
200
```

预期返回：

```json
{
  "code": 0,
  "message": "总结生成成功",
  "data": {
    "summaryId": 1,
    "summaryCycle": "week",
    "summaryDate": "2026-05-10",
    "summaryContent": "本周期记录1天，平均睡眠420分钟...",
    "healthTrend": {
      "recordDays": 1,
      "avgSleepMinutes": 420,
      "avgIntakeKcal": 500,
      "avgBurnKcal": 300
    }
  }
}
```

## 24. 查看最新健康总结

接口：

```text
GET /api/health/summary/latest
```

Query 参数：

```text
cycle=week
```

预期状态码：

```text
200
```

预期返回：

```json
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "summaryId": 1,
    "summaryCycle": "week",
    "summaryDate": "2026-05-10",
    "summaryContent": "本周期记录1天，平均睡眠420分钟...",
    "healthTrend": {
      "recordDays": 1,
      "avgSleepMinutes": 420,
      "avgIntakeKcal": 500,
      "avgBurnKcal": 300
    },
    "createdAt": "2026-05-10T..."
  }
}
```

如果还没有生成过总结，预期：

```json
{
  "code": 0,
  "message": "暂无总结",
  "data": null
}
```

## 25. 可选：导出 CSV

接口：

```text
GET /api/health/export
```

Query 参数：

```text
startDate 可选，例如 2026-05-04
endDate 可选，例如 2026-05-10
```

Swagger 中点击 `Execute` 后，会返回 CSV 文件响应。

预期响应头包含：

```text
Content-Disposition: attachment; filename="healthmate_export_....csv"
Content-Type: text/csv; charset=utf-8
```

## 26. 可选：后台维护任务

这些接口目前需要登录鉴权，但没有管理员角色区分。

### 26.1 归档历史任务

接口：

```text
POST /api/admin/jobs/archive-tasks
```

Query 参数：

```text
today 可选，例如 2026-05-10
```

预期 `code = 0`。

### 26.2 批量生成周总结

接口：

```text
POST /api/admin/jobs/weekly-summary
```

Query 参数：

```text
endDate 可选，例如 2026-05-10
```

预期 `code = 0`。

### 26.3 预生成每日建议

接口：

```text
POST /api/admin/jobs/pre-generate-advice
```

Query 参数：

```text
targetDate 可选，例如 2026-05-10
```

预期 `code = 0`。

### 26.4 执行每日维护任务

接口：

```text
POST /api/admin/jobs/run-daily
```

Query 参数：

```text
today 可选，例如 2026-05-10
```

预期 `code = 0`。

## 27. 完整通过标准

后端窗口应看到类似：

```text
GET /healthz 200
POST /api/auth/register 200
POST /api/auth/login 200
POST /api/profile 200
POST /api/health/parse 400
POST /api/health/parse 200
POST /api/health/data 200
GET /api/health/dashboard 200
GET /api/health/trends 200
GET /api/advice/stream 200
GET /api/task/today 200
POST /api/task/check 200
GET /api/task/history 200
GET /api/advice/history 200
POST /api/health/summary/generate 200
GET /api/health/summary/latest 200
```

业务上确认：

- 注册成功。
- 登录拿到 token。
- Swagger `Authorize` 配置成功。
- 档案保存成功。
- 风险词输入返回 `40020`。
- 正常健康输入解析成功。
- 健康数据提交成功。
- Dashboard/Trends 能看到睡眠 `420`、摄入 `500`、消耗 `300`。
- AI 建议 SSE 返回 `event: message`、`event: tasks`、`event: done`。
- 今日任务生成成功。
- 打卡后任务历史完成率为 `100`。
- 建议历史有记录。
- 周健康总结有记录，统计值正确。

## 附录：PowerShell 接口调用方式

日常建议优先用 Swagger。本附录只在需要命令行自动化或排查时使用。

### A. 设置变量

```powershell
$base = "http://localhost:8080/api"
$username = "test" + (Get-Date -Format "MMddHHmmss")
$password = "abc123456"
```

### B. 登录保存 Token

```powershell
$loginBody = @{
  username = $username
  password = $password
} | ConvertTo-Json

$loginResp = Invoke-RestMethod "$base/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body $loginBody

$token = $loginResp.data.token
$headers = @{ Authorization = "Bearer $token" }
```

### C. 中文请求体编码

Windows PowerShell 5 对中文 JSON 容易乱码。新开窗口后可以先执行：

```powershell
chcp 65001
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()
```

发送中文请求体时建议转换为 UTF-8 bytes：

```powershell
$body = @{
  rawInput = "我今天睡了7小时，运动消耗300kcal，吃了500卡"
} | ConvertTo-Json

$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)

Invoke-RestMethod "$base/health/parse" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json; charset=utf-8" `
  -Body $bytes
```

### D. SSE 命令行查看

```powershell
Invoke-WebRequest "$base/advice/stream?token=$token"
```

