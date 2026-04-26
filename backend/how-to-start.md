可以按下面顺序启动和测试。建议先只测后端，后端通了再联调前端。

**1. 准备 MySQL**

先确保 MySQL 正在运行，并创建数据库：

```sql
CREATE DATABASE healthmate DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

如果你的用户名/密码不是 `root/123456`，后面要改 `.env`。

**2. 启动后端**

在项目根目录开 PowerShell：

```powershell
cd backend
Copy-Item .env.example .env
notepad .env
```

确认 `.env` 里这些配置正确：

```env
AI_MODE=mock
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=123456
DB_NAME=healthmate
```

然后安装依赖并启动：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

如果 PowerShell 不让激活虚拟环境，先执行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

启动成功后打开：

```text
http://localhost:8080/docs
```

这是 Swagger，可以直接测所有接口。

**3. 后端接口测试顺序**

在 Swagger 里按这个顺序测：

1. 注册

`POST /api/auth/register`

```json
{
  "username": "test0426",
  "password": "abc123",
  "confirmPassword": "abc123"
}
```

2. 登录

`POST /api/auth/login`

```json
{
  "username": "test0426",
  "password": "abc123"
}
```

复制返回的 `data.token`。

3. Swagger 右上角点 `Authorize`

填入刚才的 token。之后需要登录的接口都能测。

4. 保存档案

`POST /api/profile`

```json
{
  "gender": 1,
  "height": 175,
  "weight": 68,
  "healthGoal": "减脂",
  "medicalHistory": "无"
}
```

5. 测风险词拦截

`POST /api/health/parse`

```json
{
  "rawInput": "今天有胸痛和晕厥"
}
```

预期：返回“检测到高危词汇，请立即就医”。

6. 测自然语言解析

`POST /api/health/parse`

```json
{
  "rawInput": "我今天睡了7小时，运动消耗300kcal，吃了500卡"
}
```

7. 提交健康数据

`POST /api/health/data`

```json
{
  "rawInput": "我今天睡了7小时，运动消耗300kcal，吃了500卡",
  "sleepMinutes": 420,
  "intakeCalories": 500,
  "exerciseCalories": 300,
  "tags": ["有氧", "睡眠记录"]
}
```

8. 看仪表盘

`GET /api/health/dashboard`

9. 看趋势

`GET /api/health/trends?dimension=week`

10. 生成 AI 建议

普通接口用 Swagger 不太适合看 SSE，建议浏览器直接打开：

```text
http://localhost:8080/api/advice/stream?token=你的token
```

或：

```text
http://localhost:8080/api/health/daily-report?token=你的token
```

你会看到类似：

```text
event: message
data: ...

event: tasks
data: [...]
```

11. 查看今日任务

`GET /api/task/today`

12. 打卡

拿上一步返回的 `taskId`：

`POST /api/task/check`

```json
{
  "taskId": 1,
  "status": 1
}
```

13. 查看任务历史

`GET /api/task/history`

14. 生成健康总结

`POST /api/health/summary/generate?startDate=2026-04-20&endDate=2026-04-26&cycle=week`

15. 查看最新总结

`GET /api/health/summary/latest`

16. 测后台任务

```text
POST /api/admin/jobs/archive-tasks
POST /api/admin/jobs/weekly-summary
POST /api/admin/jobs/pre-generate-advice
POST /api/admin/jobs/run-daily
```

**4. 启动前端**

另开一个 PowerShell：

```powershell
cd frontend
npm install
npm run dev
```

默认打开：

```text
http://localhost:5173
```

前端默认后端地址已经是：

```text
http://localhost:8080/api
```

如果要显式配置，可以在 `frontend/.env.local` 写：

```env
VITE_API_BASE_URL=http://localhost:8080/api
```

注意：当前前端 AI 建议页的 SSE URL 是通过 `VITE_SSE_ADVICE_URL` 静态配置的，没法自动拼登录后的 token；所以前端页面可能还是 mock 打字机效果。后端 SSE 建议流请先用浏览器 URL 或 Swagger/接口工具单独测。
