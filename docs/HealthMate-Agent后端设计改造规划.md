# HealthMate Agent 后端设计改造规划

> 2026-07-15 更新：后续技术路线调整为 LangGraph + Qdrant。原规划中的 Planner、Tool Registry、Memory、RAG、Guardrail、Trace 仍然保留作为核心设计概念，但实现上优先使用 LangGraph StateGraph 承载 Agent 编排，使用 Qdrant 承载健康知识库向量检索和用户长期语义记忆。详细选型见 [HealthMate Agent 技术选型与实现思路](./HealthMate-Agent技术选型与实现思路.md)。

## 1. 项目重新定位

当前 HealthMate 已经具备健康记录、健康趋势、AI 建议、RAG 知识检索、任务生成等基础能力。后续改造不再以“完整可演示产品”作为主要目标，而是将项目包装为一个适合后端 / Agent 开发方向求职讲述的系统设计项目。

新的项目定位：

> HealthMate Agent 是一个面向个人健康管理场景的后端 Agent 系统。系统围绕用户健康记录、健康目标、任务完成情况和健康知识库，完成自然语言记录解析、风险识别、RAG 知识增强、个性化建议生成、每日任务规划和行为反馈闭环。

面试时重点讲：

- 后端分层与领域建模。
- Agent 编排流程如何设计。
- 工具调用、记忆、RAG、安全边界如何协作。
- MySQL / Redis / 异步任务如何支撑系统。
- LLM 不稳定时如何兜底、追踪和评估。

不再重点讲：

- 前端页面实现。
- UI 交互细节。
- 是否完整跑通所有演示链路。
- 视觉效果和动效。

## 2. 改造原则

### 2.1 后端优先

后续所有改造都服务于后端能力表达。前端只保留为 API 调用方，不做复杂优化。接口只需要保证设计上合理、后端依赖关系清晰即可。

### 2.2 设计优先于完整实现

本项目用于简历和面试讲述，因此应优先补齐架构设计、数据模型、关键流程、异常处理和技术取舍。部分能力可以只完成核心骨架或文档化设计，不强制做成生产可用。

### 2.3 Agent 化不是简单接入 LLM

不能只说“调用大模型生成建议”。后续要把项目讲成一个可解释的 Agent 后端：

- 有 Planner 决定执行步骤。
- 有 Tools 执行业务能力。
- 有 Memory 管理用户长期上下文。
- 有 RAG 提供外部知识依据。
- 有 Guardrail 控制健康场景安全边界。
- 有 Trace 记录每次 Agent 运行过程。

### 2.4 健康场景强调安全边界

HealthMate 不做医疗诊断、处方、用药调整和急症处理。后端需要在设计上明确：

- 普通健康记录可以进入分析流程。
- 高危症状、疾病诊断、用药请求必须被拦截或降级。
- Agent 输出必须声明仅用于日常健康管理参考。
- 风险识别优先级高于建议生成。

## 3. 当前后端基础

当前后端已经具备以下可复用基础：

- FastAPI 接口层。
- SQLAlchemy + MySQL 数据持久化。
- JWT 鉴权。
- 用户档案、健康记录、每日任务、健康总结、建议历史模型。
- Redis / 内存缓存封装。
- 健康记录自然语言解析。
- 风险词和 LLM 风险检测。
- Markdown 健康知识库。
- 本地 embedding 检索和关键词 fallback。
- LLM Advice Provider 与 Mock Provider 兜底。
- SSE 流式建议输出。
- 每日任务候选生成和相似任务过滤。

这些能力可以作为 Agent Tools 的底层实现，不需要全部推倒重写。

## 4. 目标后端架构

建议将后端重构为以下逻辑架构：

```text
API Layer
  |
  v
Application Service Layer
  |
  v
Health Agent Layer
  |-- Planner
  |-- Tool Registry
  |-- Memory Manager
  |-- RAG Retriever
  |-- Guardrail
  |-- Executor
  |-- Trace Recorder
  |
  v
Domain Services
  |-- HealthRecordService
  |-- AdviceService
  |-- TaskGenerationService
  |-- SummaryService
  |-- RiskService
  |-- KnowledgeService
  |
  v
Repository + MySQL / Redis
```

核心变化不是新增更多接口，而是把原本分散在各 service 中的 AI 流程统一收敛到 Agent 编排层。

## 5. Agent 核心模块设计

### 5.1 HealthAgent

职责：

- 作为 Agent 入口，接收用户请求和上下文。
- 调用 Planner 决定执行哪些步骤。
- 调用 Tool Registry 中的工具。
- 汇总工具结果并生成最终响应。
- 将运行过程写入 Trace。

建议目录：

```text
backend/app/agents/
  health_agent.py
  planner.py
  tools.py
  memory.py
  guardrails.py
  trace.py
  schemas.py
```

面试讲法：

> 我没有把 LLM 调用散落在 Controller 里，而是抽象出 Agent 编排层。Controller 只负责鉴权和参数校验，Agent 负责任务规划、工具调用、上下文组织和结果归档。

### 5.2 Planner

职责：

- 根据请求类型和用户状态决定执行路径。
- 不一定一开始就做复杂 ReAct，可以先用规则型 Planner。
- 后续可以扩展为 LLM Planner。

典型执行计划：

```text
1. load_user_profile
2. load_recent_health_records
3. run_risk_guardrail
4. retrieve_health_knowledge
5. generate_health_advice
6. generate_task_candidates
7. run_output_guardrail
8. persist_result
```

设计取舍：

- 初版使用规则型 Planner，稳定、可控、便于面试解释。
- LLM 只参与建议生成和任务候选，不直接决定所有业务动作。
- 这样可以避免 Agent 不可控，也符合健康场景安全要求。

### 5.3 Tool Registry

将后端已有服务包装成 Agent Tools：

| Tool | 底层能力 | 作用 |
| --- | --- | --- |
| `load_user_profile` | UserRepository | 获取用户目标、身高体重、病史、伤病史 |
| `load_recent_records` | HealthRepository | 获取近 7 / 30 天健康记录 |
| `load_task_history` | TaskRepository | 获取任务完成率和历史任务 |
| `detect_health_risk` | RiskWordService | 拦截高危输入 |
| `retrieve_knowledge` | KnowledgeService | 检索健康知识片段 |
| `generate_advice` | AdviceService / LLMProvider | 生成个性化建议 |
| `generate_tasks` | TaskGenerationService | 生成每日任务候选 |
| `save_advice_history` | AdviceRepository | 保存建议历史 |
| `cache_daily_advice` | CacheService | 缓存每日建议 |

面试讲法：

> 我把业务 service 包装为工具，而不是让大模型直接访问数据库。这样 Agent 能利用后端已有能力，同时所有数据库访问、权限校验和安全规则仍然由后端控制。

### 5.4 Memory Manager

分为三类记忆：

| 类型 | 来源 | 用途 |
| --- | --- | --- |
| 用户长期记忆 | 用户档案、目标、病史、伤病史、过敏史 | 个性化约束 |
| 行为短期记忆 | 近 7 天健康记录、任务完成情况 | 生成当日建议 |
| 周期总结记忆 | 周总结、月总结 | 降低上下文长度，支持长期趋势判断 |

建议新增设计：

```text
t_agent_memory
- memory_id
- user_id
- memory_type
- content
- source_type
- source_id
- importance
- created_at
- updated_at
```

可以不急于完整实现复杂记忆系统，但文档和模型设计应说明：

- 近 7 天记录直接查实时数据。
- 更久远的数据通过 summary 压缩。
- 高重要度信息，如伤病史、过敏史、目标变化，进入长期记忆。

### 5.5 RAG Retriever

当前 `KnowledgeService` 已经支持 Markdown 切块、embedding 检索和关键词 fallback。后续设计上需要增强为：

- 知识块增加 topic、tags、source、risk_level。
- 检索结果返回 score 和 source。
- Agent 输出建议时附带引用依据。
- 对 RAG 命中率、知识覆盖率做离线评估。

建议新增数据结构：

```text
KnowledgeHit
- chunk_id
- source
- title
- content
- score
- tags
```

面试讲法：

> RAG 在这里不是为了做开放问答，而是作为建议生成的知识约束层。它给 LLM 提供日常健康管理边界，减少模型凭空发挥，并且让建议可以解释来源。

### 5.6 Guardrail

健康场景必须把安全边界作为亮点。

输入侧 Guardrail：

- 识别胸痛、呼吸困难、晕厥、出血、自伤等高危描述。
- 识别疾病诊断、处方、用药调整等越界请求。
- 高危输入不进入普通健康记录保存和建议生成流程。

输出侧 Guardrail：

- 检查 Agent 输出是否包含诊断、处方、药物剂量建议。
- 检查是否缺少就医提醒。
- 检查任务是否与伤病史冲突，比如膝盖不适却推荐跑步。

面试讲法：

> 我把 Guardrail 放在 Agent 流程前后两侧：输入侧决定是否允许进入 Agent，输出侧决定建议能否返回给用户。这比只在 prompt 里写一句“不要诊断”更可靠。

### 5.7 Trace Recorder

这是让项目像 Agent 项目的关键。

建议新增表：

```text
t_agent_run
- run_id
- user_id
- run_type
- status
- input_snapshot
- output_snapshot
- model_name
- prompt_tokens
- completion_tokens
- latency_ms
- fallback_used
- error_message
- created_at

t_agent_step
- step_id
- run_id
- step_name
- step_type
- status
- input_json
- output_json
- latency_ms
- error_message
- created_at

t_agent_tool_call
- call_id
- run_id
- step_id
- tool_name
- arguments_json
- result_json
- latency_ms
- success
- created_at

t_agent_retrieval_hit
- hit_id
- run_id
- source
- title
- score
- content_preview
- created_at
```

面试讲法：

> Agent 系统最大的问题是不可解释。我设计了 run、step、tool_call、retrieval_hit 四类轨迹表。每次生成建议都能追溯用了哪些用户数据、检索了哪些知识、调用了哪些工具、是否发生 fallback。

## 6. 核心业务流程设计

### 6.1 自然语言健康记录解析

流程：

```text
用户输入自然语言
 -> 输入风险检测
 -> LLM 结构化解析
 -> Pydantic schema 校验
 -> 低置信度返回 preview
 -> 用户确认后入库
```

重点设计：

- 高危输入不保存为普通记录。
- LLM 失败时使用规则解析兜底。
- 解析结果必须带 confidence 和 warnings。
- 入库前做 schema 校验和字段归一化。

可讲亮点：

- 结构化抽取。
- 风险拦截。
- 置信度机制。
- LLM fallback。

### 6.2 每日健康建议 Agent

流程：

```text
触发生成建议
 -> 创建 agent_run
 -> Planner 生成执行计划
 -> 加载用户档案
 -> 加载近 7 天健康记录
 -> 加载任务完成情况
 -> 加载最近健康总结
 -> 风险和约束检查
 -> 构造 RAG query
 -> 检索健康知识
 -> 生成建议
 -> 输出侧安全检查
 -> 写建议历史和缓存
 -> SSE 流式返回
```

可讲亮点：

- 多源上下文融合。
- RAG 知识约束。
- SSE 流式响应。
- Redis 缓存每日建议。
- Agent Trace 可观测。

### 6.3 每日任务规划 Agent

流程：

```text
读取健康建议和用户状态
 -> 读取今日已完成 / 未完成任务
 -> 读取历史完成率
 -> 生成任务候选
 -> 与已完成任务做相似度去重
 -> 与未完成任务做难度调整
 -> 返回候选任务
 -> 用户选择后写入任务表
```

重点设计：

- 不自动强行写任务，先生成候选。
- 已完成任务不重复生成。
- 未完成任务不简单覆盖，而是生成低难度优化版。
- 根据历史完成率调整任务数量和难度。

可讲亮点：

- 任务去重。
- 任务难度自适应。
- 用户行为反馈闭环。

### 6.4 周期总结和长期记忆

流程：

```text
定时任务触发
 -> 聚合一周健康记录
 -> 统计睡眠、摄入、消耗、标签分布
 -> 生成健康总结
 -> 写入 summary
 -> 重要信息进入 memory
```

可讲亮点：

- 长上下文压缩。
- 周期性记忆。
- 降低 LLM 上下文成本。
- 支撑长期趋势分析。

## 7. 后端技术栈规划

建议最终简历技术栈：

```text
FastAPI + SQLAlchemy + MySQL + Redis + Alembic
+ JWT + SSE + APScheduler/Celery
+ RAG + Embedding + LLM Function/JSON Output
+ Agent Trace + Guardrail
```

其中：

- FastAPI：后端 API 和 SSE。
- MySQL：核心业务数据、Agent 运行轨迹。
- Redis：每日建议缓存、幂等 key、任务锁。
- Alembic：数据库版本迁移。
- APScheduler / Celery：每日建议预生成、周总结、任务归档。
- Embedding：知识库语义检索。
- LLM：解析、建议生成、任务候选生成。

## 8. 不需要优化的内容

明确不投入精力：

- 前端 UI 改造。
- 前端状态管理重构。
- 页面动效。
- 移动端适配。
- 完整演示流程打磨。
- 真实生产级医疗知识库。
- 复杂多轮聊天前端。

前端只需作为后端接口调用方存在。面试中如果被问到前端，可以一句带过：

> 前端只是为了验证接口和展示结果，项目重点在后端 Agent 编排、数据建模、RAG 和安全边界设计。

## 9. 后续修改路线

### 阶段一：文档和架构定稿

目标：先让项目“能讲”。

任务：

- 输出 Agent 架构图。
- 输出核心流程图。
- 整理数据库模型设计。
- 整理 Agent Run / Step / ToolCall / RetrievalHit 表设计。
- 重写 README，突出后端 Agent 项目定位。
- 整理简历项目描述。

交付物：

- `docs/HealthMate-Agent后端设计改造规划.md`
- `docs/HealthMate-Agent架构设计.md`
- `docs/HealthMate-Agent面试讲述稿.md`
- 更新后的 `README.md`

### 阶段二：最小代码骨架

目标：让代码结构支撑设计说法。

任务：

- 新增 `app/agents` 目录。
- 新增 `HealthAgent`、`Planner`、`ToolRegistry`、`TraceRecorder` 骨架。
- 将现有 `AdviceService`、`KnowledgeService`、`TaskGenerationService` 包装成 tools。
- 新增 Agent trace 相关 ORM model。
- 增加 Alembic migration 设计或基础迁移。

说明：

- 不要求所有路径完整调通。
- 但核心类、方法、数据表要能体现设计。
- 关键流程可以通过单元测试或伪运行示例证明。

### 阶段三：核心亮点补强

目标：让项目有后端深度。

任务：

- Redis 幂等和每日建议缓存设计。
- LLM 调用失败 fallback 记录。
- RAG 检索结果持久化。
- 输出侧 Guardrail。
- 任务生成去重和难度调整策略文档化。
- Agent 运行 trace 查询接口设计。

可选接口：

```text
GET /api/agent/runs
GET /api/agent/runs/{runId}
GET /api/agent/runs/{runId}/steps
GET /api/agent/runs/{runId}/retrieval-hits
```

### 阶段四：简历和面试材料

目标：让项目能转化为求职表达。

任务：

- 写 4 到 5 条简历 bullet。
- 准备项目整体介绍。
- 准备 10 个高频面试问答。
- 准备架构取舍说明。
- 准备“为什么不用 LangChain / 为什么自研 Agent 编排”的回答。

## 10. 简历描述草案

项目名称：

> HealthMate Agent：基于 RAG 与工具调用的个性化健康管理智能体

技术栈：

> FastAPI、MySQL、Redis、SQLAlchemy、Alembic、JWT、SSE、RAG、Embedding、LLM、Agent Trace

简历 bullet 草案：

- 基于 FastAPI + MySQL + Redis 设计个人健康管理 Agent 后端，支持自然语言健康记录解析、RAG 知识增强建议、每日任务规划和健康行为反馈闭环。
- 设计 Agent 编排层，将用户画像查询、健康记录聚合、风险识别、知识检索、建议生成、任务规划封装为工具调用，并通过 Planner 统一调度。
- 构建 Agent Run / Step / ToolCall / RetrievalHit 运行轨迹模型，记录每次建议生成的上下文、工具调用、检索命中、模型耗时和 fallback 状态，提升 Agent 可解释性和可排查性。
- 基于 Markdown 健康知识库和中文 embedding 实现 RAG 检索，并提供关键词 fallback、知识引用和离线评估脚本，增强建议生成的依据性和稳定性。
- 设计健康场景 Guardrail，对高危症状、诊断、用药等越界输入进行拦截，并在输出侧过滤处方化、诊断化建议，保证系统定位在日常健康管理范围内。

## 11. 面试讲述主线

建议按以下顺序讲：

1. 这个项目不是普通健康管理 CRUD，而是围绕用户健康数据构建 Agent 决策闭环。
2. Agent 的输入来自用户档案、健康记录、历史任务、周期总结和知识库。
3. Planner 负责编排执行步骤，Tools 负责访问后端受控能力。
4. RAG 负责提供健康知识依据，避免 LLM 只靠参数记忆生成。
5. Guardrail 负责健康安全边界，输入输出都做限制。
6. Trace 负责记录 Agent 每一步，解决可解释性和排障问题。
7. Redis 和异步任务用于优化响应速度、缓存每日建议和做周期总结。
8. 最后形成建议生成、任务规划、任务完成反馈、下一轮建议调整的闭环。

## 12. 重点技术取舍

### 为什么不直接用 LangChain

可以回答：

> 这个项目的业务流程比较固定，而且健康场景对可控性要求高，所以我没有一开始引入重框架，而是自研轻量 Agent 编排层。这样能明确控制每一步工具调用、权限校验、风险拦截和 trace 记录。后续如果流程复杂度上升，可以再把 Tool、Memory、Retriever 接口适配到 LangChain 或 LangGraph。

### 为什么 Planner 初版用规则而不是 LLM

可以回答：

> 健康建议场景不适合让 LLM 完全自由决定业务动作。初版用规则型 Planner 保证流程稳定，LLM 主要负责结构化解析和自然语言生成。这样既能利用模型能力，也能保证后端流程可控。

### 为什么要保存 Agent Trace

可以回答：

> Agent 结果不可解释是工程落地中的核心问题。保存 run、step、tool call 和 retrieval hit 后，可以知道一次建议用了哪些数据、检索了哪些知识、模型是否 fallback、哪一步耗时高或失败，这对调试、评估和后续优化都很重要。

### 为什么健康场景需要 Guardrail

可以回答：

> 健康管理和医疗诊断边界很近，如果只依赖 prompt，很容易出现越界建议。所以我设计了输入侧和输出侧两层 Guardrail：输入侧拦截高危症状和用药诊断请求，输出侧过滤处方化、诊断化内容，保证系统只做日常健康建议。

## 13. 最终目标

最终这个项目不追求成为完整商业产品，而是成为一个面试中可以深入展开的后端 Agent 项目。它应该能体现：

- 后端分层能力。
- Agent 系统设计能力。
- RAG 工程理解。
- LLM 可靠性处理。
- 数据建模能力。
- 缓存、异步任务、幂等、可观测性等后端工程素养。

一句话总结：

> HealthMate Agent 的价值不是“能生成一句健康建议”，而是展示如何把 LLM 放进一个可控、可追踪、可扩展的后端业务系统里。
