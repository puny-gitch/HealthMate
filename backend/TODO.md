# HealthMate 后端开发备忘（截至 2026-04-06）

> 用途：给后续对话快速恢复上下文。  
> 当前结论：`backend` 已从 0 搭好 FastAPI + MySQL + JWT 的 V1 骨架，核心接口可用，但仍有若干联调与完善工作未完成。

---

## 1. 本次已完成内容（Done）

### 1.1 工程骨架与基础设施
- 已在 `backend` 下建立完整后端分层结构：
  - `app/api`
  - `app/core`
  - `app/db`
  - `app/models`
  - `app/repositories`
  - `app/schemas`
  - `app/services`
  - `tests`
- 新增依赖文件：
  - `backend/requirements.txt`
- 新增环境变量模板：
  - `backend/.env.example`
- 新增后端说明文档：
  - `backend/README.md`

### 1.2 配置、统一响应、异常处理、鉴权
- 已实现配置管理（含 `API_PREFIX`、`JWT`、`DB`、`AI_MODE`）：
  - `backend/app/core/config.py`
- 已实现统一成功响应格式：
  - `backend/app/core/response.py`
- 已实现业务异常类与全局异常处理：
  - `backend/app/core/exceptions.py`
  - `backend/app/main.py` 中注册了异常处理器
- 已实现 JWT + bcrypt：
  - `backend/app/core/security.py`
  - 通过 `Authorization: Bearer <token>` 获取当前用户

### 1.3 数据库与模型
- 已接入 SQLAlchemy + MySQL，提供会话管理：
  - `backend/app/db/session.py`
- 已实现启动时建表：
  - `backend/app/db/init_db.py`
  - `backend/app/main.py` `startup` 中调用 `init_db()`
- 已实现模型：
  - `t_user` -> `backend/app/models/user.py`
  - `t_health_record` -> `backend/app/models/health_record.py`
  - `t_daily_task` -> `backend/app/models/daily_task.py`
  - `t_health_summary` -> `backend/app/models/health_summary.py`
  - 额外补充：`t_advice_history` -> `backend/app/models/advice_history.py`

### 1.4 仓储层（Repository）
- 已实现常用读写仓储：
  - 用户：`user_repository.py`
  - 健康记录：`health_repository.py`
  - 任务：`task_repository.py`
  - 建议历史：`advice_repository.py`

### 1.5 服务层（Service）
- 风险词检测（高危词拦截）：
  - `backend/app/services/risk.py`
- 简单规则解析（自然语言提取睡眠/热量等）：
  - `backend/app/services/parse.py`
- AI 建议服务（Mock 可用 + LLM 占位接口）：
  - `backend/app/services/advice.py`
  - 已定义 `IAdviceProvider`，`LLMAdviceProvider` 目前 `NotImplemented`
- 趋势聚合：
  - `backend/app/services/trend.py`
- 任务完成率：
  - `backend/app/services/task.py`

### 1.6 API 路由（已对齐当前前端主路径）
- 路由聚合：
  - `backend/app/api/router.py`
- 鉴权依赖：
  - `backend/app/api/deps.py`
- 已实现接口：
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/profile`
  - `PUT /api/profile`
  - `POST /api/health/data`
  - `POST /api/health/parse`（额外补充，便于后续 DataEntry 解析联调）
  - `GET /api/health/dashboard`
  - `GET /api/health/trends`
  - `GET /api/health/export`（CSV 导出）
  - `GET /api/advice/history`
  - `GET /api/advice/stream`（SSE）
  - `POST /api/task/check`
  - `GET /api/task/history`

### 1.7 测试与静态检查
- 已新增基础服务测试：
  - `backend/tests/test_services.py`
- 已做全量语法编译检查（compile）：通过。

---

## 2. 关键现状与差异说明（Important Current State）

### 2.1 与设计文档路径存在命名差异（已按前端优先）
- 文档中有些接口与前端调用不一致，本次优先按前端路径实现：
  - 文档 `POST /api/user/profile`，当前实现 `POST /api/profile`
  - 文档 `GET /api/health/trend`，当前实现 `GET /api/health/trends`
  - 文档 `GET /api/health/daily-report`，当前由 `GET /api/advice/stream` 承担

### 2.2 SSE 鉴权现状
- `GET /api/advice/stream` 目前使用 `Depends(get_current_user_id)`，要求带 Bearer token。
- 但浏览器原生 `EventSource` 不能方便地自定义 `Authorization` header（前端当前 hook 也未走标准鉴权通道）。
- 代码里留了 query 参数 `token` 占位，但暂未正式接入“query token 鉴权逻辑”。

### 2.3 AI 现状
- 当前 `AI_MODE=mock` 默认可用。
- `LLMAdviceProvider` 未实现真实调用，仅留占位类。

### 2.4 持久化策略
- 当前用 SQLAlchemy 直接建表（`create_all`），未上 Alembic migration。
- 适合课程阶段快速推进，但后续迭代建议改迁移体系。

---

## 3. 后续待办（按优先级）

## P0（建议先做，直接影响联调）

1. 前端接入真实后端 API（替换本地 mock store 逻辑）
- 当前前端很多页面在 `AppStore` 本地维护任务/建议，未真正调用后端。
- 需要逐步替换：
  - `AuthPage` -> 调 `authApi.login/register`
  - `ProfileSetupPage` -> 调 `profileApi.saveProfile/updateProfile`
  - `DataEntryPage` -> 调 `healthApi.submitData` + `POST /api/health/parse`
  - `Dashboard/Trends/Tasks/AIAdvice` -> 调对应后端接口

2. 解决 SSE 鉴权落地方案（二选一）
- 方案 A：`/api/advice/stream?token=...`，后端解析 query token 并校验 JWT。
- 方案 B：前端改用 fetch + ReadableStream（可带 Authorization header），后端保留 event-stream。
- 该项不解决会导致 AI 建议页很难“标准鉴权 + SSE”同时成立。

3. 修复/统一前端字段映射
- 前端字段名和后端 schema 存在中英混用（如 `goal` vs `healthGoal`，`account` vs `username`）。
- 需要明确最终契约并统一，减少适配层复杂度。

4. 真机联调一轮主流程
- 流程：注册 -> 登录 -> 完善档案 -> 提交数据 -> 看 dashboard/trends -> 生成建议 -> 打卡 -> 查看历史
- 当前代码已具备基础能力，但未在本地完整跑通记录（尤其含 MySQL + 前端联调）。

## P1（提升稳定性和可维护性）

5. 引入 Alembic
- 将 `create_all` 迁移为可版本化 migration，避免后续字段调整混乱。

6. 完善接口测试
- 目前只有服务层基础测试，缺 API 集成测试。
- 建议新增：
  - `auth` 注册登录成功/失败
  - token 失效/缺失
  - `health/data` 参数边界与风险词拦截
  - `task/check` 状态流转
  - `advice/stream` 事件格式断言

7. 统一错误码规范
- 当前已有业务码，但未形成完整错误码表。
- 建议落一份 `ERROR_CODE.md`，并与前端约定 toast 文案映射。

8. 完善输入校验与业务约束
- 如用户名规则、密码强度、任务重复生成去重、同日多条记录冲突策略等。

9. 导出接口增强
- 当前 `health/export` 是基础 CSV。
- 可增加：
  - 指定日期范围
  - UTF-8 BOM（兼容 Excel 中文）
  - 导出字段选择

## P2（能力增强）

10. 实现真实 LLM Provider
- 在 `LLMAdviceProvider` 中接入实际模型（DeepSeek/Kimi/GLM 等之一）
- 增加超时、重试、兜底切换和响应解析。

11. Redis 缓存
- 缓存每日建议、周总结、热点趋势查询，降低建议生成延迟。

12. 定时任务（Celery/APScheduler）
- 次日建议预生成、周记忆压缩、任务归档等。

13. 文档接口双轨兼容（别名路由）
- 在保留当前前端路径的情况下，补齐文档路径别名，方便课程答辩展示一致性。

---

## 4. 已知风险/问题（Known Issues）

1. `EventSource` 默认不便带 `Authorization` header，SSE 鉴权待统一方案。
2. 当前 ORM 字段类型与文档大体一致，但未经过 migration 流程验证。
3. `t_health_summary` 目前仅建模，业务上尚未被实际写入/读取。
4. 任务生成逻辑现在每次建议流可能插入新任务，缺“同日去重/覆盖策略”。
5. ParseService 为规则法，仅能覆盖简单语句，复杂输入识别能力有限。

---

## 5. 运行与联调参考

1. 安装依赖
- `cd backend`
- `pip install -r requirements.txt`

2. 配置环境
- 复制 `.env.example` 为 `.env`
- 填写可用 MySQL 参数（确保数据库已创建）

3. 启动后端
- `uvicorn app.main:app --reload --port 8080`
- 文档：`http://localhost:8080/docs`

4. 前端联调关键点
- `frontend/src/services/http.js` 默认 `baseURL` 是 `http://localhost:8080/api`，可直接对接
- 仍需把页面中 mock 逻辑替换为真实 API 调用

---

## 6. 建议下次对话优先处理顺序

1. 先定 SSE 鉴权方案并一次性改通（前后端各改一处）。
2. 再把前端 `Auth + ProfileSetup + DataEntry + Dashboard` 四条链路接上真实接口。
3. 跑通主流程后，补 API 自动化测试与 Alembic。
4. 最后再接真实 LLM 与 Redis/Celery。

