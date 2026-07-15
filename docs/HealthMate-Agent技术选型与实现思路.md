# HealthMate Agent 技术选型与实现思路

## 1. 选型目标

HealthMate 后续不再以完整产品演示为核心目标，而是作为后端 / Agent 开发方向的简历项目。因此技术选型的判断标准不是“最快做出页面效果”，而是：

- 能体现后端系统设计能力。
- 能体现 Agent 编排、记忆、RAG、工具调用等核心概念。
- 能在面试中讲清楚每个组件的职责和取舍。
- 不为了堆技术而引入过重组件。
- 保留健康场景的安全边界和可控性。

最终推荐选型：

```text
FastAPI + MySQL + Redis + LangGraph + Qdrant + Embedding + OpenAI-compatible LLM
```

核心思路：

> LangGraph 做 Agent 状态图编排，Qdrant 做向量检索和长期语义记忆，MySQL 做业务数据和 Agent Trace，Redis 做缓存、短期状态和幂等控制。

## 2. 总体技术栈

| 层              | 选型                  | 职责                                         |
| --------------- | --------------------- | -------------------------------------------- |
| Web 后端        | FastAPI               | API、鉴权、SSE、后端服务入口                 |
| 关系型数据库    | MySQL                 | 用户、健康记录、任务、建议历史、Agent Trace  |
| 缓存 / 短期状态 | Redis                 | 每日建议缓存、幂等 key、短期上下文、分布式锁 |
| Agent 编排      | LangGraph             | 用状态图编排健康建议和任务规划流程           |
| LLM 基础抽象    | LangChain Core        | Tool、Message、Runnable 等轻量抽象           |
| 向量数据库      | Qdrant                | 健康知识库 RAG、用户长期语义记忆             |
| Embedding       | bge-m3 / bge-small-zh | 中文健康文本向量化                           |
| LLM Provider    | OpenAI-compatible API | DeepSeek、Qwen、Kimi 等模型可切换            |
| 异步任务        | APScheduler / Celery  | 周总结、记忆压缩、建议预生成、任务归档       |
| 可观测性        | 自研 Agent Trace      | run、step、tool_call、retrieval_hit 追踪     |

## 3. 技术选型思考过程

### 3.1 为什么引入现成 Agent 框架

一开始可以考虑自研轻量 Agent 编排层，因为自研方案的优点是：

- 流程完全可控。
- 代码结构简单。
- 容易结合现有 service。
- 不引入额外学习成本。

但从求职项目角度看，完全自研有一个问题：它更像普通后端 service orchestration，不够突出 Agent 工程经验。面试官看到 LangGraph、工具调用、状态图、记忆和检查点，会更容易把项目理解为 Agent 后端项目。

因此最终选择：

> 使用 LangGraph 作为 Agent 编排框架，但不使用黑盒 AgentExecutor。

这样既能体现成熟 Agent 框架经验，又不会牺牲后端业务可控性。

### 3.2 为什么选 LangGraph，而不是传统 LangChain Agent

传统 LangChain Agent 更偏向“模型决定下一步调用什么工具”，适合开放式问答和探索型任务。但 HealthMate 是健康管理场景，流程应该明确、稳定、可审计：

```text
加载用户画像
 -> 加载健康记录
 -> 风险识别
 -> 检索长期记忆
 -> 检索健康知识
 -> 生成健康建议
 -> 输出安全检查
 -> 生成任务候选
 -> 持久化 Trace
```

这个流程天然适合用 LangGraph 的状态图建模。

选择 LangGraph 的原因：

- 用 StateGraph 显式表达 Agent 流程。
- 每个节点都可以对应一个后端可控能力。
- 支持状态传递，适合保存上下文、检索结果、模型输出。
- 支持 checkpoint / persistence 思路，便于扩展短期记忆。
- 比传统黑盒 Agent 更容易做 trace、debug 和安全控制。

面试讲法：

> 我没有直接使用 LangChain 的黑盒 AgentExecutor，而是用 LangGraph 把健康建议流程建模成显式状态图。每个节点对应一个可控的后端能力，比如加载用户画像、风险拦截、知识检索、建议生成和任务规划。这样既利用了成熟 Agent 框架，又保证健康场景下的可解释和可控。

### 3.3 为什么引入向量数据库

当前项目已有 Markdown 知识库和本地 embedding 检索，但它更像 demo 级 RAG。为了让简历项目更完整，应该引入真正的向量数据库，用于：

- 健康知识库语义检索。
- 用户长期语义记忆。
- 基于 metadata 的过滤检索。
- 后续支持记忆更新、删除、分组、权限隔离。

向量数据库不仅能写在简历上，更重要的是它能支撑“长期记忆”和“RAG 知识增强”这两个 Agent 关键概念。

### 3.4 为什么选 Qdrant

候选方案：

| 方案     | 优点                                                    | 不足                                             | 结论               |
| -------- | ------------------------------------------------------- | ------------------------------------------------ | ------------------ |
| FAISS    | 本地简单、性能好                                        | 不适合多用户记忆管理，缺少服务化和 metadata 管理 | 不推荐作为最终方案 |
| pgvector | 与 PostgreSQL 集成好，关系数据和向量数据统一            | 当前项目主库是 MySQL，切库成本高                 | 暂不采用           |
| Milvus   | 功能强，适合大规模向量检索                              | 部署较重，对本项目偏复杂                         | 不作为首选         |
| Qdrant   | 部署轻、API 清晰、metadata filter 友好、适合 RAG 和记忆 | 需要额外服务                                     | 推荐               |

最终选择 Qdrant：

- 不需要替换现有 MySQL。
- Docker 部署简单。
- 支持 payload metadata 过滤，适合按 `user_id`、`memory_type`、`topic`、`risk_level` 检索。
- 对简历表达友好：可以明确写“向量数据库 + RAG + 长期记忆”。

面试讲法：

> 我没有把向量检索塞进 MySQL，也没有为了 pgvector 切换主库，而是选择 Qdrant 独立承载语义检索。MySQL 保留强结构化业务数据，Qdrant 负责健康知识和用户语义记忆，两者职责清晰。

## 4. 最终后端架构

```text
FastAPI API Layer
  |
  v
HealthAgentService
  |
  v
LangGraph StateGraph
  |-- load_profile
  |-- load_recent_records
  |-- risk_guardrail
  |-- retrieve_user_memory
  |-- retrieve_health_knowledge
  |-- generate_advice
  |-- output_guardrail
  |-- generate_tasks
  |-- persist_result
  |-- save_trace
  |
  v
Domain Services
  |-- UserService
  |-- HealthRecordService
  |-- KnowledgeService
  |-- MemoryService
  |-- AdviceService
  |-- TaskGenerationService
  |-- RiskService
  |
  v
MySQL + Redis + Qdrant
```

## 5. 记忆层设计

HealthMate Agent 的记忆层分为四类：

| 记忆类型                    | 技术组件                     | 内容                                           | 作用                 |
| --------------------------- | ---------------------------- | ---------------------------------------------- | -------------------- |
| Working Memory              | LangGraph State              | 单次运行中的中间状态                           | 节点间传递上下文     |
| Short-term Memory           | Redis / LangGraph Checkpoint | 最近会话、短期状态、断点信息                   | 支持短期连续上下文   |
| Structured Long-term Memory | MySQL                        | 用户档案、健康目标、病史、任务完成率、周期总结 | 支持稳定业务查询     |
| Semantic Long-term Memory   | Qdrant                       | 用户偏好、长期习惯、高频问题、健康知识片段     | 支持语义检索和个性化 |

### 5.1 Working Memory

由 LangGraph State 承载，只在一次 Agent 运行中存在。

示例字段：

```python
class HealthAgentState(TypedDict):
    user_id: int
    request_type: str
    profile: dict
    recent_records: list[dict]
    task_history: list[dict]
    user_memories: list[dict]
    knowledge_hits: list[dict]
    advice_text: str
    task_candidates: list[dict]
    warnings: list[str]
    trace: dict
```

### 5.2 Short-term Memory

由 Redis 或 LangGraph checkpoint 承载。

用途：

- 保存短时间内的 Agent 状态。
- 避免用户刷新后重复生成。
- 支持同一天建议幂等。
- 为后续多轮对话预留基础。

示例 key：

```text
agent:checkpoint:{thread_id}
agent:daily_advice:{user_id}:{date}
agent:idempotency:{user_id}:{request_hash}
```

### 5.3 Structured Long-term Memory

由 MySQL 承载。

来源：

- 用户档案。
- 健康目标。
- 病史、伤病史、过敏史。
- 健康记录。
- 任务完成率。
- 周总结 / 月总结。

这些数据强结构化、需要事务和审计，因此适合放 MySQL。

### 5.4 Semantic Long-term Memory

由 Qdrant 承载。

存储内容：

- 用户长期偏好，如“更容易接受晚饭后散步”。
- 用户长期限制，如“膝盖不适，避免高冲击运动”。
- 行为模式，如“连续三周睡眠不足”。
- 从周期总结中抽取的高价值记忆。

建议 collection：

```text
user_health_memory
```

payload 示例：

```json
{
  "user_id": 1001,
  "memory_type": "constraint",
  "source_type": "weekly_summary",
  "source_id": "summary_88",
  "importance": 5,
  "created_at": "2026-07-15T10:00:00"
}
```

## 6. Qdrant Collection 设计

### 6.1 健康知识库

collection：

```text
health_knowledge
```

用途：

- 存储通用健康知识片段。
- 支撑每日建议生成时的 RAG 检索。
- 输出建议时提供引用依据。

payload：

```json
{
  "source": "sleep",
  "title": "睡眠不足与恢复",
  "topic": "sleep",
  "tags": ["sleep", "recovery"],
  "risk_level": "normal"
}
```

检索条件示例：

```text
query = "睡眠不足 减脂 晚间运动"
filter = {
  "risk_level": "normal"
}
top_k = 5
```

### 6.2 用户长期语义记忆

collection：

```text
user_health_memory
```

用途：

- 存储用户长期偏好和限制。
- 在生成建议和任务时注入个性化上下文。
- 支持按用户隔离检索。

payload：

```json
{
  "user_id": 1001,
  "memory_type": "preference",
  "importance": 4,
  "source_type": "task_feedback",
  "created_at": "2026-07-15T10:00:00"
}
```

检索条件示例：

```text
query = "今天生成运动任务"
filter = {
  "user_id": 1001,
  "memory_type": ["preference", "constraint"]
}
top_k = 5
```

## 7. LangGraph 工作流设计

### 7.1 每日建议图

```text
START
  |
  v
load_profile
  |
  v
load_recent_records
  |
  v
risk_guardrail
  |
  +-- high_risk --> emergency_response --> save_trace --> END
  |
  v
retrieve_user_memory
  |
  v
retrieve_health_knowledge
  |
  v
generate_advice
  |
  v
output_guardrail
  |
  +-- unsafe --> fallback_advice
  |
  v
generate_tasks
  |
  v
persist_result
  |
  v
save_trace
  |
  v
END
```

关键点：

- 高危输入直接走 emergency_response，不进入普通建议生成。
- RAG 和长期记忆分别检索，避免混在一起。
- 输出侧 Guardrail 不通过时走 fallback_advice。
- 每个节点都写入 Agent Trace。

### 7.2 健康记录解析图

```text
START
  |
  v
input_guardrail
  |
  +-- high_risk --> reject_record --> save_trace --> END
  |
  v
parse_with_llm
  |
  +-- failed --> parse_with_rules
  |
  v
normalize_schema
  |
  v
confidence_check
  |
  +-- low_confidence --> return_preview
  |
  v
save_record
  |
  v
update_memory_if_needed
  |
  v
END
```

### 7.3 任务规划图

```text
START
  |
  v
load_profile
  |
  v
load_task_history
  |
  v
retrieve_user_memory
  |
  v
generate_task_candidates
  |
  v
deduplicate_tasks
  |
  v
adjust_difficulty
  |
  v
return_candidates
  |
  v
END
```

## 8. Agent Trace 设计

即使用了 LangGraph，也需要自研 Agent Trace。原因是：

- LangGraph 负责流程执行。
- 业务系统需要自己的可观测数据。
- 面试中可以清楚讲解每次 Agent 运行如何追踪。

建议保留以下表：

```text
t_agent_run
t_agent_step
t_agent_tool_call
t_agent_retrieval_hit
t_agent_memory
```

Trace 记录内容：

- 这次运行是什么类型。
- 每个节点是否成功。
- 每个工具输入输出是什么。
- 检索命中了哪些知识和记忆。
- 模型调用是否 fallback。
- 总耗时和各节点耗时。

面试讲法：

> LangGraph 解决的是 Agent 流程编排，但线上排查还需要业务侧可观测性。因此我额外设计了 Agent Trace 表，记录 run、step、tool_call 和 retrieval_hit，方便追踪每次建议生成到底用了什么数据和知识。

## 9. 最新实现路线

### 阶段一：依赖和基础设施

目标：先把项目的技术底座定下来。

任务：

- 在 `requirements.txt` 加入 LangGraph、LangChain Core、Qdrant Client。
- 在 Docker Compose 设计中加入 Qdrant 和 Redis。
- 新增 Qdrant 配置项。
- 设计 `VectorStoreService`。
- 设计 `MemoryService`。

建议新增配置：

```env
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_KNOWLEDGE_COLLECTION=health_knowledge
QDRANT_MEMORY_COLLECTION=user_health_memory
EMBEDDING_MODEL=BAAI/bge-small-zh-v1.5
```

### 阶段二：LangGraph Agent 骨架

目标：让代码结构体现 Agent 状态图。

建议目录：

```text
backend/app/agents/
  health_graph.py
  state.py
  nodes.py
  edges.py
  service.py
```

职责：

- `state.py`：定义 Agent State。
- `nodes.py`：定义各节点函数。
- `health_graph.py`：组装 LangGraph StateGraph。
- `service.py`：提供给 FastAPI route 调用。

### 阶段三：Qdrant 知识库和记忆层

目标：让 RAG 和长期记忆从“本地 demo”升级为“组件化设计”。

任务：

- 将 `app/data/knowledge/*.md` 导入 Qdrant。
- 每个知识块带 source、title、topic、tags。
- 将用户长期记忆写入 `user_health_memory` collection。
- Agent 生成建议前同时检索知识库和用户记忆。

### 阶段四：Trace 和 Guardrail

目标：强化后端工程亮点。

任务：

- 每个 LangGraph node 记录 AgentStep。
- 每次工具调用记录 AgentToolCall。
- 每次 Qdrant 检索记录 AgentRetrievalHit。
- 输入侧和输出侧 Guardrail 均写入 Trace。
- LLM fallback 写入 `fallback_used` 和 error_message。

### 阶段五：简历材料

目标：将实现转化为求职表达。

任务：

- 更新 README 架构图。
- 输出面试讲述稿。
- 输出高频问答。
- 输出简历 bullet。

## 10. 简历表达版本

项目名称：

> HealthMate Agent：基于 LangGraph 与 Qdrant 的个性化健康管理智能体

技术栈：

> FastAPI、MySQL、Redis、LangGraph、Qdrant、SQLAlchemy、JWT、SSE、RAG、Embedding、LLM、Agent Trace

简历 bullet：

- 基于 FastAPI + LangGraph 设计个人健康管理 Agent 后端，将用户画像加载、健康记录聚合、风险识别、长期记忆检索、RAG 检索、建议生成和任务规划建模为显式状态图。
- 引入 Qdrant 向量数据库，分别构建健康知识库和用户长期语义记忆，支持基于 `user_id`、`memory_type`、`topic` 等 metadata filter 的个性化检索。
- 设计多层记忆体系：LangGraph State 承载工作记忆，Redis 承载短期状态和幂等缓存，MySQL 保存结构化长期记忆，Qdrant 保存语义长期记忆。
- 自研 Agent Trace 模型，记录 run、step、tool call、retrieval hit、fallback 状态和节点耗时，提升 Agent 决策链路的可解释性和可排查性。
- 设计健康场景 Guardrail，对高危症状、诊断、用药等越界输入进行输入侧拦截，并在输出侧过滤处方化、诊断化建议，保证系统定位于日常健康管理。

## 11. 面试回答要点

### 为什么用 LangGraph

HealthMate 的流程不是开放式问答，而是有固定业务步骤的健康建议生成。LangGraph 可以把这些步骤建模为状态图，每个节点都由后端控制，适合健康场景的安全和可解释要求。

### 为什么不用 LangChain AgentExecutor

AgentExecutor 更偏黑盒，模型有较大自由度决定调用工具。健康场景中不能让模型随意决定流程，所以我只使用 LangGraph 做显式编排，业务工具、权限、数据访问和 Guardrail 都由后端控制。

### 为什么用 Qdrant

项目已有 MySQL，不适合为了 pgvector 切换主库。Qdrant 独立承载向量检索，支持 metadata filter，适合同时做通用知识库 RAG 和用户长期语义记忆。

### MySQL 和 Qdrant 怎么分工

MySQL 存强结构化、需要事务和审计的数据，例如用户、记录、任务、建议历史、Agent Trace。Qdrant 存语义检索数据，例如知识片段和用户长期偏好。两者通过 `source_id`、`user_id` 等字段关联。

### Redis 在这里做什么

Redis 主要做短期状态、每日建议缓存、幂等 key 和分布式锁。比如同一用户同一天重复请求建议时，可以直接返回缓存，避免重复调用 LLM。

## 12. 最终选型结论

最终采用：

```text
FastAPI + MySQL + Redis + LangGraph + Qdrant + Embedding + OpenAI-compatible LLM
```

这个组合的优势是：

- 后端主线清晰。
- Agent 编排有成熟框架支撑。
- RAG 和 Memory 有真实组件承载。
- MySQL / Redis / Qdrant 分工明确。
- 面试可讲性强。
- 不会为了追求复杂度而牺牲健康场景的可控性。

一句话总结：

> HealthMate Agent 不是简单调用大模型生成建议，而是用 LangGraph 编排健康管理状态图，用 Qdrant 承载知识库和长期语义记忆，用 MySQL 和 Redis 支撑业务数据、Trace、缓存和幂等，最终形成一个可控、可追踪、可解释的后端 Agent 系统。
