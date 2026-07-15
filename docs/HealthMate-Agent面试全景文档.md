# HealthMate Agent 面试全景文档

> 目标读者：有 Java 后端经验，但 Python 和 Agent 经验较浅的开发者。
> 目标用途：让你能把 HealthMate Agent 放到简历上，并在后端 / Agent 开发方向面试中讲清楚项目背景、架构设计、核心实现、技术取舍、难点和扩展方向。
> 项目定位：这不是一个重点展示 UI 的产品项目，而是一个面向后端 / Agent 求职场景的系统设计与工程实践项目。

---

## 目录

1. 项目一句话介绍
2. 项目适合写在简历上的原因
3. 项目整体功能
4. 技术栈总览
5. Java 后端视角下如何理解这个项目
6. 当前代码结构
7. 整体后端架构
8. Agent 架构设计
9. LangGraph 在项目中的作用
10. Qdrant 和向量检索设计
11. Memory 记忆层设计
12. RAG 知识增强设计
13. Guardrail 健康安全边界
14. Agent Trace 可观测性设计
15. 核心业务流程
16. 数据库表设计
17. API 接口设计
18. 关键代码模块讲解
19. Python / FastAPI 基础理解
20. 与 Java 后端技术的类比
21. 简历写法
22. 面试讲述主线
23. 高频面试问答
24. 当前实现边界和后续优化

---

## 1. 项目一句话介绍

**HealthMate Agent 是一个基于 FastAPI、LangGraph、Qdrant、MySQL 和 Redis 设计的个性化健康管理智能体后端系统。**

它围绕用户的健康档案、日常健康记录、历史任务完成情况和健康知识库，完成：

- 自然语言健康记录解析。
- 高危健康输入识别。
- RAG 知识增强健康建议生成。
- 用户长期语义记忆检索。
- 个性化每日任务规划。
- Agent 运行轨迹追踪。

面试时可以用这一版介绍：

> 我做的是一个个人健康管理 Agent 后端。它不是简单调用大模型生成一句建议，而是用 LangGraph 把用户画像加载、健康记录聚合、长期记忆检索、健康知识库 RAG、建议生成、任务规划和安全审查建模成一个状态图。同时使用 Qdrant 承载向量知识库和用户长期语义记忆，MySQL 保存业务数据和 Agent Trace，Redis 做缓存和幂等控制。

---

## 2. 项目适合写在简历上的原因

这个项目不是普通 CRUD 项目，而是具备后端 / Agent 求职方向比较有价值的几个点：

### 2.1 有明确业务闭环

不是孤立的聊天机器人，而是有完整业务闭环：

```text
用户记录健康数据
 -> 后端结构化解析
 -> 聚合近期健康状态
 -> 检索健康知识和长期记忆
 -> 生成个性化建议
 -> 生成每日任务
 -> 用户打卡反馈
 -> 下一次建议根据反馈调整
```

这比“做了一个 ChatGPT 套壳问答系统”更容易体现后端工程能力。

### 2.2 有 Agent 编排

使用 LangGraph 把流程建模成状态图，不是简单 `prompt -> LLM -> response`。

Agent 节点包括：

- `load_profile`
- `load_recent_records`
- `risk_guardrail`
- `retrieve_user_memory`
- `retrieve_health_knowledge`
- `generate_advice`
- `output_guardrail`
- `generate_task_candidates`
- `persist_result`

面试官可以看到你理解 Agent 不只是“调用大模型”，而是多个后端能力的受控编排。

### 2.3 有 RAG 和向量数据库

项目引入 Qdrant，设计了两个 collection：

- `health_knowledge`：健康知识库。
- `user_health_memory`：用户长期语义记忆。

这能支撑简历上的“RAG、向量数据库、长期记忆、个性化检索”。

### 2.4 有后端工程亮点

项目保留传统后端能力：

- JWT 鉴权。
- MySQL 持久化。
- Repository / Service 分层。
- Redis 缓存。
- SSE 流式响应。
- Agent Trace 可观测性。
- 降级兜底。
- 输入输出安全边界。

这些都是后端面试能展开讲的内容。

---

## 3. 项目整体功能

### 3.1 用户与档案

用户可以注册、登录、维护健康档案。

健康档案包括：

- 性别。
- 身高。
- 体重。
- 健康目标。
- 病史。
- 伤病史。
- 过敏史。

这些信息会进入 Agent 上下文，用于个性化建议。

例如：

- 用户目标是减脂，建议会偏向饮食控制和轻量运动。
- 用户有膝盖伤病史，任务生成时应避免高冲击跑步。
- 用户有过敏史，后续饮食建议需要避开相关食材。

### 3.2 健康记录

用户可以提交自然语言健康记录，例如：

```text
昨晚睡了 6 小时，午饭吃了鸡胸肉沙拉，晚上跑步 30 分钟。
```

后端会尝试解析：

- 睡眠分钟数。
- 摄入热量。
- 运动消耗。
- 饮食明细。
- 运动明细。
- 健康标签。
- 置信度。
- 解析警告。

对应代码：

- `backend/app/api/routes/health.py`
- `backend/app/services/parse.py`
- `backend/app/services/health_parse_ai.py`

### 3.3 风险识别

如果输入包含高危症状，例如：

```text
今天胸痛，呼吸困难，有点晕厥。
```

系统不应把它当普通健康记录，而是应提醒用户及时就医。

对应代码：

- `backend/app/services/risk.py`

设计原则：

> 健康管理系统只能做日常健康建议，不能做诊断、处方、用药调整和急症处理。

### 3.4 健康趋势

系统可以聚合近 7 天或 30 天记录，生成趋势数据：

- 睡眠趋势。
- 摄入趋势。
- 消耗趋势。
- 标签分布。

对应代码：

- `backend/app/services/trend.py`
- `backend/app/api/routes/health.py`

### 3.5 RAG 健康建议

每日建议不是只依赖大模型，而是结合：

- 用户健康目标。
- 用户近期记录。
- 用户长期记忆。
- 健康知识库检索结果。
- 周期健康总结。
- 任务完成情况。

最终通过 SSE 流式返回。

对应代码：

- `backend/app/api/routes/advice.py`
- `backend/app/agents/service.py`
- `backend/app/agents/nodes.py`
- `backend/app/services/advice.py`
- `backend/app/services/knowledge.py`
- `backend/app/services/vector_store.py`

### 3.6 每日任务规划

系统根据建议生成可执行任务，例如：

- 晚饭后快走 20 分钟。
- 睡前 30 分钟放下电子设备。
- 下一餐记录主食、蛋白质和饮料。

任务生成逻辑会考虑：

- 用户健康目标。
- 历史任务完成率。
- 今日已完成任务。
- 今日未完成任务。
- 相似任务去重。
- 任务难度调整。

对应代码：

- `backend/app/api/routes/task.py`
- `backend/app/services/task_generation.py`
- `backend/app/agents/service.py`
- `backend/app/agents/nodes.py`

### 3.7 Agent Trace

每一次 Agent 运行都会记录：

- run 信息。
- step 信息。
- tool call 信息。
- retrieval hit 信息。
- fallback 状态。
- 耗时。
- 错误信息。

对应代码：

- `backend/app/models/agent_trace.py`
- `backend/app/repositories/agent_repository.py`
- `backend/app/agents/trace.py`
- `backend/app/api/routes/agent.py`

查询接口：

```text
GET /api/agent/runs
GET /api/agent/runs/{run_id}
```

---

## 4. 技术栈总览

最终技术栈：

```text
FastAPI + SQLAlchemy + MySQL + Redis
+ LangGraph + LangChain Core
+ Qdrant + sentence-transformers
+ OpenAI-compatible LLM
+ SSE + JWT + Agent Trace
```

### 4.1 FastAPI

作用类似 Java 里的 Spring MVC / Spring Boot Web：

- 定义 REST API。
- 处理请求参数。
- 做依赖注入。
- 返回 JSON。
- 支持 SSE。

项目中 API 路由在：

```text
backend/app/api/routes/
```

### 4.2 SQLAlchemy + MySQL

作用类似 Java 里的 MyBatis Plus / JPA + MySQL：

- 定义 ORM 模型。
- 操作数据库。
- 保存用户、健康记录、任务、建议历史、Agent Trace。

模型在：

```text
backend/app/models/
```

Repository 在：

```text
backend/app/repositories/
```

### 4.3 Redis

作用：

- 缓存每日建议。
- 后续可做幂等 key。
- 后续可做短期会话状态。
- 后续可做分布式锁。

对应代码：

```text
backend/app/services/cache.py
```

### 4.4 LangGraph

作用：

- 编排 Agent 状态图。
- 把多个后端节点串成一个可控流程。
- 比传统黑盒 Agent 更适合健康场景。

对应代码：

```text
backend/app/agents/service.py
```

### 4.5 Qdrant

作用：

- 存储健康知识向量。
- 存储用户长期语义记忆。
- 支持 metadata filter。

对应代码：

```text
backend/app/services/vector_store.py
backend/app/services/memory.py
backend/app/services/knowledge_index.py
```

### 4.6 sentence-transformers

作用：

- 本地生成中文文本 embedding。
- 默认模型：

```text
BAAI/bge-small-zh-v1.5
```

### 4.7 OpenAI-compatible LLM

项目不是绑定 OpenAI，而是使用 OpenAI-compatible Chat Completions 接口。

可以接：

- DeepSeek。
- Qwen。
- Kimi。
- 其他兼容 `/chat/completions` 的服务。

配置项：

```env
AI_MODE=llm
LLM_API_BASE=
LLM_API_KEY=
LLM_MODEL=deepseek-chat
```

---

## 5. Java 后端视角下如何理解这个项目

如果你有 Java 后端经验，可以这样类比：

| Python / 当前项目  | Java 后端类比                   | 说明                      |
| ------------------ | ------------------------------- | ------------------------- |
| FastAPI            | Spring Boot Controller          | 接收 HTTP 请求            |
| Depends            | Spring 依赖注入 / 参数解析      | 注入 DB session、当前用户 |
| Pydantic Schema    | DTO / Request VO / Response VO  | 参数校验和序列化          |
| SQLAlchemy Model   | JPA Entity / MyBatis 实体类     | 数据库表映射              |
| Repository         | Mapper / DAO                    | 封装数据库查询            |
| Service            | Service 层                      | 业务逻辑                  |
| LangGraph Node     | 工作流节点 / 状态机节点         | Agent 执行步骤            |
| Qdrant             | Elasticsearch 向量检索 / Milvus | 语义搜索                  |
| Redis CacheService | RedisTemplate 封装              | 缓存访问                  |
| Agent Trace        | 日志表 / 调用链追踪             | 可观测性                  |

如果面试官问你为什么用 Python，你可以说：

> 传统业务系统我更熟悉 Java，但 Agent 和 LLM 生态目前 Python 更成熟，比如 LangGraph、LangChain、sentence-transformers、Qdrant Client 都有比较完整的 Python 支持。所以这个项目后端主体用 Python/FastAPI 实现，核心工程思想仍然是我熟悉的分层架构、数据建模、缓存、幂等和可观测性。

---

## 6. 当前代码结构

核心目录：

```text
backend/
  app/
    api/
      routes/
        auth.py
        profile.py
        health.py
        advice.py
        task.py
        agent.py
        admin.py
      router.py
    agents/
      service.py
      nodes.py
      state.py
      trace.py
      serialization.py
    core/
      config.py
      security.py
      response.py
      exceptions.py
    db/
      session.py
      init_db.py
      base.py
    models/
      user.py
      health_record.py
      daily_task.py
      health_summary.py
      advice_history.py
      agent_trace.py
    repositories/
      user_repository.py
      health_repository.py
      task_repository.py
      summary_repository.py
      advice_repository.py
      agent_repository.py
    services/
      advice.py
      cache.py
      health_parse_ai.py
      knowledge.py
      knowledge_index.py
      memory.py
      parse.py
      risk.py
      summary.py
      task.py
      task_generation.py
      trend.py
      vector_store.py
    data/
      knowledge/
        sleep.md
        nutrition.md
        exercise.md
        ...
  scripts/
    index_knowledge_qdrant.py
    evaluate_rag_advice.py
    compare_rag_advice.py
  requirements.txt
  docker-compose.agent.yml
```

### 6.1 API 层

API 层负责：

- 接收请求。
- 鉴权。
- 参数校验。
- 调用 service。
- 返回统一响应。

关键文件：

```text
backend/app/api/router.py
backend/app/api/routes/*.py
```

### 6.2 Agent 层

Agent 层负责：

- 编排 LangGraph 状态图。
- 串联业务节点。
- 记录 Trace。
- 聚合输出。

关键文件：

```text
backend/app/agents/service.py
backend/app/agents/nodes.py
backend/app/agents/state.py
backend/app/agents/trace.py
```

### 6.3 Service 层

Service 层负责具体业务能力：

- 建议生成。
- 知识检索。
- 任务生成。
- 风险识别。
- 趋势聚合。
- 记忆检索。
- 向量检索。

### 6.4 Repository 层

Repository 层负责数据库读写。

这和 Java 里 Mapper / DAO 很像。

---

## 7. 整体后端架构

整体架构如下：

```text
Client / Frontend / API Tool
        |
        v
FastAPI Router
        |
        v
Application Service
        |
        v
HealthAgentService
        |
        v
LangGraph StateGraph
        |
        +-- load_profile
        +-- load_recent_records
        +-- risk_guardrail
        +-- retrieve_user_memory
        +-- retrieve_health_knowledge
        +-- generate_advice
        +-- output_guardrail
        +-- generate_task_candidates
        +-- persist_result
        |
        v
Domain Services
        |
        +-- UserRepository / MySQL
        +-- HealthRepository / MySQL
        +-- TaskRepository / MySQL
        +-- AdviceRepository / MySQL
        +-- AgentRepository / MySQL
        +-- CacheService / Redis
        +-- VectorStoreService / Qdrant
        +-- LLMAdviceProvider / LLM API
```

### 7.1 为什么这样分层

传统后端分层通常是：

```text
Controller -> Service -> Repository -> DB
```

Agent 项目中多了一层：

```text
Controller -> AgentService -> Agent Graph Nodes -> Domain Services -> Repository
```

原因：

- Controller 不应该直接写复杂 Agent 流程。
- Domain Service 不应该知道自己被 Agent 调用。
- AgentService 负责流程编排。
- Nodes 负责把 Agent 状态和业务 service 连接起来。
- Repository 仍然只负责数据访问。

这样好处是：

- 保留传统后端分层清晰性。
- Agent 编排逻辑集中。
- 后续更换 LangGraph 节点实现不会影响 API。
- 业务 service 仍然可以被普通接口复用。

---

## 8. Agent 架构设计

### 8.1 什么是 Agent

在这个项目里，Agent 不是“像人一样自主思考的机器人”，而是：

> 一个由 LLM、工具、记忆、知识库和安全规则共同组成的后端决策流程。

它具备几个核心能力：

- 理解用户状态。
- 调用后端工具。
- 检索外部知识。
- 读取长期记忆。
- 生成个性化建议。
- 记录执行过程。
- 在风险场景中做降级处理。

### 8.2 HealthMate Agent 的组成

```text
HealthMate Agent
  |
  +-- State
  +-- Nodes
  +-- Tools
  +-- Memory
  +-- RAG Retriever
  +-- Guardrail
  +-- Trace Recorder
```

### 8.3 State

State 是 Agent 运行过程中的上下文。

代码：

```text
backend/app/agents/state.py
```

里面包含：

- `user_id`
- `profile`
- `recent_records`
- `metrics`
- `user_memories`
- `knowledge_hits`
- `advice_text`
- `task_candidates`
- `warnings`
- `output`

你可以把它理解为 Java 工作流系统中的 `Context` 对象。

### 8.4 Nodes

Node 是 Agent 图中的节点。

代码：

```text
backend/app/agents/nodes.py
```

每个节点做一件事：

- `load_profile`
- `load_recent_records`
- `retrieve_user_memory`
- `retrieve_health_knowledge`
- `generate_advice`
- `generate_task_candidates`

### 8.5 Tools

在当前实现中，Tool 没有单独做 LangChain `@tool` 装饰，而是通过 Node 调用后端 service。

这是刻意设计：

- 健康场景不希望 LLM 随意调用工具。
- 工具调用由 LangGraph 节点控制。
- 权限和数据访问仍由后端掌控。

面试时可以说：

> 我没有让模型自由选择工具，而是用 LangGraph 明确编排工具调用顺序。因为健康场景对安全和可解释要求更高，流程不能完全交给模型自主决定。

---

## 9. LangGraph 在项目中的作用

### 9.1 为什么用 LangGraph

HealthMate 的 Agent 流程不是开放式聊天，而是有明确步骤：

```text
加载用户上下文
 -> 检索记忆
 -> 检索知识
 -> 生成建议
 -> 生成任务
 -> 保存结果
```

这很适合 LangGraph 的状态图。

### 9.2 为什么不用传统 LangChain AgentExecutor

传统 AgentExecutor 通常是：

```text
LLM 决定下一步调用哪个工具
```

但健康场景不适合这样。

原因：

- LLM 可能跳过风险检查。
- LLM 可能调用不该调用的工具。
- LLM 决策过程不稳定。
- 健康建议需要强安全边界。

所以本项目选择：

```text
LangGraph 显式流程 + 后端受控工具调用
```

面试回答：

> 我用 LangGraph 而不是 AgentExecutor，是因为 HealthMate 的流程更像一个受控工作流。LLM 主要负责结构化理解和自然语言生成，业务步骤、工具调用和安全检查由后端状态图控制。

### 9.3 当前实现

代码在：

```text
backend/app/agents/service.py
```

核心逻辑：

```python
from langgraph.graph import END, StateGraph

graph = StateGraph(HealthAgentState)
graph.add_node("load_profile", node)
graph.add_node("retrieve_health_knowledge", node)
...
graph.add_edge("load_profile", "load_recent_records")
graph.add_edge("retrieve_health_knowledge", "generate_advice")
graph.add_edge("persist_advice_result", END)
compiled = graph.compile()
compiled.invoke(initial_state)
```

当前实现还做了一个降级设计：

- 如果 LangGraph 没安装，按同样节点顺序串行执行。
- 如果 LangGraph API 版本不兼容，也按串行执行。
- 如果节点本身执行失败，则记录 Trace 并抛出异常。

这体现了后端工程里的降级思路。

---

## 10. Qdrant 和向量检索设计

### 10.1 什么是向量数据库

普通数据库擅长精确查询：

```sql
select * from health_record where user_id = 1;
```

向量数据库擅长语义相似查询。

例如用户问：

```text
最近睡眠不足，减脂期间怎么安排运动？
```

即使知识库中没有完全相同的文字，也能检索到语义相近内容：

- 睡眠不足恢复。
- 减脂运动安排。
- 晚间运动注意事项。

### 10.2 为什么选 Qdrant

选择 Qdrant 的原因：

- 独立服务，不影响 MySQL。
- 支持 metadata filter。
- Docker 部署简单。
- 适合 RAG 和长期记忆。
- 比 Milvus 轻。
- 不需要为了 pgvector 把 MySQL 切换到 PostgreSQL。

面试回答：

> MySQL 负责强结构化业务数据，Qdrant 负责语义检索，两者职责分离。因为项目已有 MySQL，不适合为了 pgvector 切换主库，所以选择 Qdrant 独立承载知识库和用户长期记忆。

### 10.3 Qdrant Collection 设计

#### health_knowledge

用途：

- 存通用健康知识。
- 支撑 RAG 检索。

payload：

```json
{
  "source": "sleep",
  "title": "睡眠不足与恢复",
  "topic": "sleep",
  "tags": ["sleep"],
  "risk_level": "normal",
  "text": "..."
}
```

#### user_health_memory

用途：

- 存用户长期语义记忆。
- 支持个性化建议。

payload：

```json
{
  "user_id": 1001,
  "memory_type": "constraint",
  "source_type": "weekly_summary",
  "source_id": "summary_88",
  "importance": 5,
  "text": "用户膝盖不适，应避免高冲击跑步。"
}
```

### 10.4 当前实现

向量服务：

```text
backend/app/services/vector_store.py
```

核心能力：

- `search`
- `upsert_texts`
- `_embed`
- `_build_filter`
- `_ensure_collection`

知识库导入：

```text
backend/app/services/knowledge_index.py
backend/scripts/index_knowledge_qdrant.py
```

运行方式：

```powershell
cd backend
python scripts/index_knowledge_qdrant.py
```

如果 Qdrant 不可用：

- 服务会降级为空结果。
- Agent 仍可回退到本地 Markdown 关键词/embedding 检索。

---

## 11. Memory 记忆层设计

### 11.1 为什么 Agent 需要 Memory

如果没有记忆，每次生成建议都只看当前输入。

但健康管理需要长期上下文，例如：

- 用户长期睡眠不足。
- 用户不喜欢跑步。
- 用户膝盖不适。
- 用户更容易完成饭后散步任务。
- 用户连续几周任务完成率低。

这些信息不适合每次都从原始记录里重新推理，因此需要记忆层。

### 11.2 四层记忆设计

| 记忆类型                    | 技术组件           | 内容                       |
| --------------------------- | ------------------ | -------------------------- |
| Working Memory              | LangGraph State    | 单次运行上下文             |
| Short-term Memory           | Redis / Checkpoint | 短期会话和幂等状态         |
| Structured Long-term Memory | MySQL              | 用户档案、记录、任务、总结 |
| Semantic Long-term Memory   | Qdrant             | 偏好、限制、习惯、长期模式 |

### 11.3 当前实现

语义记忆服务：

```text
backend/app/services/memory.py
```

核心方法：

```python
remember(...)
retrieve(...)
```

当前在 Agent 中使用：

```text
retrieve_user_memory
```

它会根据用户当前目标和健康记录构造 query，然后从 Qdrant 的 `user_health_memory` collection 中检索相关记忆。

### 11.4 面试讲法

> 我把记忆分成结构化记忆和语义记忆。结构化记忆仍然放 MySQL，比如用户档案、健康记录、任务完成率；语义记忆放 Qdrant，比如用户偏好、长期限制和行为模式。生成建议时，Agent 会同时读取 MySQL 中的确定性数据和 Qdrant 中的语义记忆。

---

## 12. RAG 知识增强设计

### 12.1 什么是 RAG

RAG 是 Retrieval-Augmented Generation，即检索增强生成。

简单说：

```text
先检索相关知识
再把知识放进 prompt
最后让 LLM 基于知识生成回答
```

### 12.2 为什么 HealthMate 需要 RAG

如果只让 LLM 自己生成健康建议，会有问题：

- 可能凭空编造。
- 可能建议不够具体。
- 可能忽视健康边界。
- 不方便解释依据。

RAG 的作用：

- 让建议有知识依据。
- 降低幻觉。
- 让输出更具体。
- 支持引用展示和 Trace 记录。

### 12.3 当前知识库

知识库目录：

```text
backend/app/data/knowledge/
```

包括：

- `sleep.md`
- `nutrition.md`
- `exercise.md`
- `health_risk.md`
- `weight_management.md`
- `chronic_basics.md`
- `mental_wellbeing.md`
- `user_recording.md`
- `sources.md`

### 12.4 当前检索链路

优先级：

```text
Qdrant health_knowledge
 -> 如果无结果
 -> 本地 KnowledgeService 检索
```

代码：

```text
backend/app/agents/nodes.py
backend/app/services/vector_store.py
backend/app/services/knowledge.py
```

### 12.5 检索结果如何进入 Agent

在 Agent state 中：

```python
knowledge_hits: list[dict]
knowledge_context: str
```

`knowledge_context` 会进入建议生成上下文，最终影响 LLM 输出。

Trace 中会保存：

```text
t_agent_retrieval_hit
```

这让面试时可以讲：

> 每次 Agent 生成建议时，不仅保存最终回答，还保存检索命中的知识片段、来源、标题和相似度分数，便于排查建议依据。

---

## 13. Guardrail 健康安全边界

### 13.1 为什么需要 Guardrail

健康场景有一个关键问题：

> 日常健康建议和医疗诊断之间边界很近。

系统必须避免：

- 疾病诊断。
- 处方建议。
- 药物剂量调整。
- 急症处理建议不当。
- 对高危症状轻描淡写。

### 13.2 输入侧 Guardrail

输入侧用于判断用户输入是否应该进入普通健康流程。

例如：

```text
胸痛、呼吸困难、晕厥、出血、自杀倾向
```

这类输入不应保存为普通健康记录，应提醒就医。

当前代码：

```text
backend/app/services/risk.py
```

### 13.3 输出侧 Guardrail

输出侧用于检查 Agent 生成结果是否越界。

当前第一版实现较轻量：

```text
backend/app/agents/nodes.py -> output_guardrail
```

后续可以增强为：

- LLM 二次审核。
- 规则词表过滤。
- 结构化风险分类。
- 对任务内容做运动禁忌检查。

### 13.4 面试讲法

> 健康场景不能只靠 prompt 约束模型。我设计了输入侧和输出侧两层 Guardrail。输入侧拦截高危症状和用药诊断类请求，输出侧检查生成结果是否包含诊断、处方或药物剂量建议。这样可以把系统定位稳定控制在日常健康管理范围内。

---

## 14. Agent Trace 可观测性设计

### 14.1 为什么需要 Agent Trace

Agent 系统最常见的问题：

- 为什么生成这个建议？
- 用了哪些用户数据？
- 检索了哪些知识？
- 哪个节点失败了？
- LLM 有没有 fallback？
- 哪一步耗时高？

如果只保存最终回答，无法排查。

所以设计 Agent Trace。

### 14.2 Trace 表

代码：

```text
backend/app/models/agent_trace.py
```

表：

```text
t_agent_run
t_agent_step
t_agent_tool_call
t_agent_retrieval_hit
t_agent_memory
```

### 14.3 t_agent_run

记录一次 Agent 运行。

字段包括：

- `run_id`
- `user_id`
- `run_type`
- `status`
- `input_snapshot`
- `output_snapshot`
- `model_name`
- `latency_ms`
- `fallback_used`
- `error_message`
- `created_at`
- `updated_at`

### 14.4 t_agent_step

记录一个节点。

例如：

- `load_profile`
- `retrieve_health_knowledge`
- `generate_advice`

字段包括：

- `step_name`
- `step_type`
- `status`
- `input_json`
- `output_json`
- `latency_ms`
- `error_message`

### 14.5 t_agent_tool_call

记录工具调用。

虽然当前不是传统 LangChain Tool，但每个节点本质上调用了一个后端能力，所以也记录为 tool call。

### 14.6 t_agent_retrieval_hit

记录检索命中的知识。

字段：

- `source`
- `title`
- `score`
- `content_preview`

### 14.7 查询接口

```text
GET /api/agent/runs
GET /api/agent/runs/{run_id}
```

代码：

```text
backend/app/api/routes/agent.py
```

### 14.8 面试讲法

> 我没有只保存最终建议，而是设计了 Agent Trace。每次运行都有 run，每个节点都有 step，每次业务能力调用都有 tool_call，每次 RAG 命中都有 retrieval_hit。这样可以追踪一次建议的完整生成链路，解决 Agent 系统不可解释和难排查的问题。

---

## 15. 核心业务流程

### 15.1 每日建议生成流程

入口：

```text
GET /api/advice/stream
```

代码：

```text
backend/app/api/routes/advice.py
backend/app/agents/service.py
backend/app/agents/nodes.py
```

流程：

```text
用户请求建议
 -> 创建 AgentRun
 -> check_daily_cache
 -> load_profile
 -> load_recent_records
 -> risk_guardrail
 -> retrieve_user_memory
 -> retrieve_health_knowledge
 -> generate_advice
 -> output_guardrail
 -> persist_advice_result
 -> 保存 Agent Trace
 -> SSE 流式返回
```

#### check_daily_cache

检查 Redis 或内存缓存。

如果今天已经生成过建议，直接返回缓存。

好处：

- 减少 LLM 调用。
- 提升响应速度。
- 保证每日建议幂等。

#### load_profile

加载用户健康档案。

#### load_recent_records

加载近 7 天健康记录，计算：

- 平均睡眠。
- 记录间隔。
- 昨日任务完成率。
- 最新周总结。

#### retrieve_user_memory

从 Qdrant 检索用户长期语义记忆。

#### retrieve_health_knowledge

从 Qdrant 检索健康知识。

如果 Qdrant 不可用，则回退本地知识库。

#### generate_advice

调用 `AdviceService`。

根据配置决定：

- `AI_MODE=mock`：使用 MockAdviceProvider。
- `AI_MODE=llm`：使用 LLMAdviceProvider。

#### persist_advice_result

保存：

- Redis 缓存。
- `t_advice_history`。
- Agent Trace。

### 15.2 任务候选生成流程

入口：

```text
POST /api/task/generate-preview
```

流程：

```text
用户请求生成任务候选
 -> 创建 AgentRun
 -> load_profile
 -> load_task_context
 -> retrieve_user_memory
 -> generate_task_candidates
 -> task_guardrail
 -> 返回候选任务
 -> 保存 Agent Trace
```

任务不会直接全部写入数据库，而是先返回候选，让用户选择。

这样做的原因：

- 避免 Agent 自动替用户做决定。
- 降低错误任务影响。
- 用户可以参与确认。

### 15.3 健康记录解析流程

入口：

```text
POST /api/health/record/parse-ai
POST /api/health/record/confirm
```

当前这条链路还没有完全接入 LangGraph，但业务设计是：

```text
用户自然语言输入
 -> 风险识别
 -> LLM 解析
 -> 规则兜底
 -> 置信度判断
 -> 返回 preview
 -> 用户确认
 -> 入库
```

后续可以把它也改造成 LangGraph。

---

## 16. 数据库表设计

### 16.1 t_user

用户表。

代码：

```text
backend/app/models/user.py
```

核心字段：

- `user_id`
- `username`
- `password_hash`
- `gender`
- `height`
- `weight`
- `health_goal`
- `health_goal_version`
- `medical_history`
- `injury_history`
- `allergy_history`

### 16.2 t_health_record

健康记录表。

代码：

```text
backend/app/models/health_record.py
```

核心字段：

- `record_id`
- `user_id`
- `record_date`
- `recorded_at`
- `record_type`
- `raw_input`
- `estimated_intake_kcal`
- `estimated_burn_kcal`
- `sleep_minutes`
- `nutrition_details`
- `exercise_details`
- `health_tags`
- `confidence`
- `parse_warnings`

### 16.3 t_daily_task

每日任务表。

代码：

```text
backend/app/models/daily_task.py
```

核心字段：

- `task_id`
- `user_id`
- `task_date`
- `task_content`
- `status`
- `ai_reason`

唯一约束：

```text
user_id + task_date + task_content
```

作用：

- 避免同一天重复生成相同任务。

### 16.4 t_health_summary

健康总结表。

代码：

```text
backend/app/models/health_summary.py
```

作用：

- 保存周总结 / 月总结。
- 支持长期上下文压缩。

### 16.5 t_advice_history

建议历史表。

代码：

```text
backend/app/models/advice_history.py
```

作用：

- 保存每次生成的建议文本。

### 16.6 t_agent_run

Agent 运行表。

作用：

- 保存一次 Agent 执行的整体信息。

### 16.7 t_agent_step

Agent 步骤表。

作用：

- 保存每个 LangGraph 节点执行情况。

### 16.8 t_agent_tool_call

工具调用表。

作用：

- 保存节点对业务服务的调用信息。

### 16.9 t_agent_retrieval_hit

检索命中表。

作用：

- 保存 RAG 命中的知识片段。

### 16.10 t_agent_memory

结构化记忆表。

当前设计中语义记忆主要存在 Qdrant，这张表预留给后续把重要记忆同步一份到 MySQL 做审计和管理。

---

## 17. API 接口设计

### 17.1 鉴权

```text
POST /api/auth/register
POST /api/auth/login
```

使用 JWT。

代码：

```text
backend/app/core/security.py
backend/app/api/deps.py
```

### 17.2 用户档案

```text
GET /api/profile
POST /api/profile
PUT /api/profile
```

### 17.3 健康记录

```text
POST /api/health/data
POST /api/health/parse
POST /api/health/record/parse-ai
POST /api/health/record/confirm
GET /api/health/record/recent
GET /api/health/record/history
DELETE /api/health/record/{record_id}
```

### 17.4 趋势和总结

```text
GET /api/health/dashboard
GET /api/health/trends
GET /api/health/summary/latest
POST /api/health/summary/generate
```

### 17.5 AI 建议

```text
GET /api/advice/stream
GET /api/advice/history
```

`/api/advice/stream` 返回 SSE。

事件：

```text
event: message
event: advice
event: done
```

### 17.6 任务

```text
GET /api/task/today
GET /api/task/history
POST /api/task/generate-preview
POST /api/task/add-selected
POST /api/task/check
```

### 17.7 Agent Trace

```text
GET /api/agent/runs
GET /api/agent/runs/{run_id}
```

---

## 18. 关键代码模块讲解

### 18.1 HealthAgentService

文件：

```text
backend/app/agents/service.py
```

职责：

- 提供每日建议和任务候选两个 Agent 入口。
- 创建 AgentRun。
- 组装节点序列。
- 使用 LangGraph 执行。
- 记录 Trace。
- 返回结果。

核心方法：

```python
generate_daily_advice(...)
generate_task_preview(...)
_execute_graph(...)
_trace_node(...)
```

面试讲法：

> HealthAgentService 是 Agent 编排入口，API 层不会直接操作 LangGraph。它负责创建运行记录、组装节点、执行状态图，并把每个节点的输入输出写入 Trace。

### 18.2 HealthAgentNodes

文件：

```text
backend/app/agents/nodes.py
```

职责：

- 实现每个图节点。
- 调用已有业务 service。
- 更新 Agent State。

这里最重要的是：

```python
retrieve_user_memory
retrieve_health_knowledge
generate_advice
generate_task_candidates
```

### 18.3 VectorStoreService

文件：

```text
backend/app/services/vector_store.py
```

职责：

- 封装 Qdrant。
- 生成 embedding。
- upsert 文本。
- 检索文本。
- 构造 metadata filter。
- Qdrant 不可用时降级。

面试讲法：

> 我没有在业务代码里直接散落 Qdrant 调用，而是封装了 VectorStoreService。这样后续如果从 Qdrant 换成 Milvus 或 pgvector，只需要调整这一层。

### 18.4 MemoryService

文件：

```text
backend/app/services/memory.py
```

职责：

- 写入用户长期语义记忆。
- 检索用户长期语义记忆。
- 使用 `user_id` 和 `memory_type` 做过滤。

### 18.5 KnowledgeIndexService

文件：

```text
backend/app/services/knowledge_index.py
```

职责：

- 读取本地 Markdown 知识库。
- 切块。
- 写入 Qdrant。

### 18.6 AgentTraceRecorder

文件：

```text
backend/app/agents/trace.py
```

职责：

- 创建 run。
- 完成 run。
- 记录 step。
- 记录 tool call。
- 记录 retrieval hit。

---

## 19. Python / FastAPI 基础理解

### 19.1 FastAPI 路由

类似 Spring Boot：

Java：

```java
@RestController
@RequestMapping("/api/task")
public class TaskController {
    @PostMapping("/check")
    public Result check(@RequestBody TaskCheckReq req) {}
}
```

FastAPI：

```python
router = APIRouter(prefix="/task", tags=["task"])

@router.post("/check")
def check_task(payload: TaskCheckReq):
    ...
```

### 19.2 Depends

FastAPI 的 `Depends` 类似依赖注入 + 参数解析。

例如：

```python
def check_task(
    payload: TaskCheckReq,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
```

含义：

- `payload` 来自请求体。
- `user_id` 来自 JWT 解析。
- `db` 来自数据库 session。

### 19.3 Pydantic

类似 Java DTO + Validation。

```python
class TaskCheckReq(BaseModel):
    taskId: int
    status: int = Field(ge=0, le=1)
```

表示：

- `taskId` 必填。
- `status` 必须在 0 到 1。

### 19.4 SQLAlchemy Session

类似 Java 中一次事务上下文。

```python
db.add(record)
db.commit()
db.refresh(record)
```

### 19.5 Python 类型提示

```python
def list_runs(self, db: Session, user_id: int, limit: int = 20) -> list[AgentRun]:
```

含义：

- `db` 是 Session。
- `user_id` 是 int。
- 返回 `AgentRun` 列表。

---

## 20. 与 Java 后端技术的类比

### 20.1 分层架构类比

当前项目：

```text
FastAPI Route
 -> HealthAgentService
 -> HealthAgentNodes
 -> Domain Service
 -> Repository
 -> SQLAlchemy Model
 -> MySQL
```

Java 类比：

```text
Controller
 -> ApplicationService
 -> Workflow/Orchestrator
 -> DomainService
 -> Mapper/Repository
 -> Entity
 -> MySQL
```

### 20.2 Agent Trace 类比

可以类比：

- 链路追踪。
- 操作日志。
- 审计日志。
- 工作流执行记录。

区别是：

Agent Trace 更关注：

- 每个节点的 state 变化。
- 工具调用。
- RAG 检索命中。
- LLM fallback。

### 20.3 LangGraph 类比

可以类比：

- 状态机。
- 工作流引擎。
- 轻量版流程编排。

但它更适合 LLM/Agent 场景，因为 State 可以承载模型上下文、工具结果和消息。

---

## 21. 简历写法

### 21.1 项目名称

推荐：

> HealthMate Agent：基于 LangGraph 与 Qdrant 的个性化健康管理智能体

### 21.2 技术栈

```text
FastAPI、MySQL、Redis、SQLAlchemy、LangGraph、Qdrant、JWT、SSE、RAG、Embedding、LLM、Agent Trace
```

### 21.3 简历 bullet

可以写：

- 基于 FastAPI + LangGraph 设计个人健康管理 Agent 后端，将用户画像加载、健康记录聚合、风险识别、长期记忆检索、RAG 检索、建议生成和任务规划建模为显式状态图。
- 引入 Qdrant 向量数据库，分别构建健康知识库和用户长期语义记忆，支持基于 `user_id`、`memory_type`、`topic` 等 metadata filter 的个性化检索。
- 设计多层记忆体系：LangGraph State 承载工作记忆，Redis 承载短期状态和幂等缓存，MySQL 保存结构化长期记忆，Qdrant 保存语义长期记忆。
- 自研 Agent Trace 模型，记录 run、step、tool call、retrieval hit、fallback 状态和节点耗时，提升 Agent 决策链路的可解释性和可排查性。
- 设计健康场景 Guardrail，对高危症状、诊断、用药等越界输入进行输入侧拦截，并在输出侧过滤处方化、诊断化建议，保证系统定位于日常健康管理。

---

## 22. 面试讲述主线

面试时建议按这个顺序讲：

### 第一步：项目背景

> 这个项目是一个健康管理 Agent 后端，不是普通健康记录 CRUD。它基于用户健康档案、日常记录、历史任务和健康知识库，为用户生成个性化建议和每日任务。

### 第二步：整体架构

> 后端使用 FastAPI，MySQL 保存业务数据和 Agent Trace，Redis 做每日建议缓存和幂等，Qdrant 做健康知识库和用户长期语义记忆，LangGraph 负责编排 Agent 状态图。

### 第三步：Agent 流程

> 每次生成建议时，系统会创建 AgentRun，然后经过加载用户画像、加载近期健康记录、检索用户记忆、检索健康知识、生成建议、输出安全检查、保存结果等节点。

### 第四步：RAG 和 Memory

> RAG 用于检索通用健康知识，Memory 用于检索用户个人长期偏好和限制。两者都通过 Qdrant 做语义检索，但 collection 分开，避免通用知识和个人记忆混在一起。

### 第五步：安全和可观测

> 健康场景有安全边界，所以我设计了 Guardrail。同时为了排查 Agent 的决策过程，我设计了 Agent Trace，保存 run、step、tool_call 和 retrieval_hit。

### 第六步：后端工程取舍

> 我没有使用黑盒 AgentExecutor，而是用 LangGraph 显式编排，因为健康场景流程需要可控。MySQL 和 Qdrant 分工明确，Redis 负责缓存和短期状态。

---

## 23. 高频面试问答

### Q1：这个项目和普通健康管理系统有什么区别？

普通健康管理系统主要是记录、查询、统计。HealthMate Agent 在此基础上增加了 Agent 决策层：

- 能检索健康知识。
- 能读取用户长期记忆。
- 能结合历史任务完成情况生成个性化建议。
- 能生成可执行任务。
- 能记录 Agent 运行轨迹。

### Q2：为什么用 LangGraph？

因为健康建议生成是一个确定流程，不适合让 LLM 自由决定所有步骤。LangGraph 可以把流程显式建模成状态图，每个节点由后端控制，更安全、更可解释。

### Q3：为什么不用 LangChain AgentExecutor？

AgentExecutor 更偏黑盒，模型可以自主决定工具调用。健康场景不能完全交给模型，否则可能跳过风险检查或生成越界建议。LangGraph 更适合受控流程。

### Q4：Qdrant 在项目里做什么？

Qdrant 做两件事：

- 通用健康知识库检索。
- 用户长期语义记忆检索。

它支持 metadata filter，可以按 `user_id`、`memory_type`、`topic` 过滤。

### Q5：为什么不用 MySQL 存向量？

MySQL 不适合做高维向量相似搜索。虽然 pgvector 可以做，但项目已有 MySQL，切 PostgreSQL 成本高。所以选择 Qdrant 专门做向量检索，MySQL 保留业务数据。

### Q6：Redis 用在哪里？

当前主要用于每日建议缓存。后续可以用于：

- 幂等 key。
- 短期会话状态。
- LangGraph checkpoint。
- 分布式锁。

### Q7：RAG 怎么实现？

先把 Markdown 健康知识切块并写入 Qdrant。生成建议时，根据用户目标、近期记录和总结构造 query，从 Qdrant 检索相关知识片段，把结果作为上下文注入 LLM。

如果 Qdrant 不可用，会回退到本地 `KnowledgeService`。

### Q8：Memory 和 RAG 的区别是什么？

RAG 检索的是通用健康知识，例如睡眠、饮食、运动原则。

Memory 检索的是用户个人长期信息，例如用户不喜欢跑步、膝盖不适、长期睡眠不足。

两者都可以用向量检索，但数据来源和用途不同。

### Q9：Agent Trace 有什么用？

用于解释和排查：

- 一次建议用了哪些数据？
- 检索了哪些知识？
- 哪个节点耗时高？
- LLM 是否 fallback？
- 为什么生成了这个任务？

### Q10：如果 LLM 调用失败怎么办？

项目有 MockAdviceProvider 兜底。

如果 `AI_MODE=llm` 但没有配置 API key，或调用失败，会退回 mock/rule 逻辑，保证接口不直接崩溃。

### Q11：如何保证健康建议安全？

通过 Guardrail：

- 输入侧识别高危症状。
- 输出侧检查诊断、处方、药物剂量等越界内容。
- Prompt 中也限制模型只能做日常健康建议。

### Q12：任务生成如何避免重复？

任务表有唯一约束：

```text
user_id + task_date + task_content
```

任务生成服务还会用文本相似度判断：

- 已完成相似任务不再生成。
- 未完成相似任务生成低难度优化版。

### Q13：为什么任务不是自动直接加入？

因为 Agent 可能生成不完全适合用户的任务。先返回候选，让用户选择，可以降低错误影响，也符合“人参与决策”的设计。

### Q14：如何做长期个性化？

通过两类数据：

- MySQL 中的结构化数据：档案、目标、健康记录、任务完成率。
- Qdrant 中的语义记忆：偏好、限制、习惯、长期模式。

### Q15：项目还有哪些不足？

可以诚实回答：

- 当前健康记录解析还没有完全接入 LangGraph。
- Guardrail 仍是第一版，可以继续增强。
- Qdrant 知识库导入已有脚本，但还可以做增量更新。
- 还没有引入 Alembic 做正式 migration。
- Agent 评估体系还可以更完善。

### Q16：如果让你继续优化，会做什么？

优先级：

1. Alembic 数据库迁移。
2. LangGraph checkpoint 接入 Redis。
3. 健康记录解析也改为 LangGraph。
4. Guardrail 增强为规则 + LLM 审核。
5. RAG 增加 rerank。
6. Agent 评估集和自动化指标。
7. Celery/APScheduler 做周期总结和记忆压缩。

---

## 24. 当前实现边界和后续优化

### 24.1 当前已实现

- FastAPI 后端基础。
- MySQL ORM 模型。
- JWT 鉴权。
- 健康记录。
- 健康趋势。
- 建议历史。
- 任务生成。
- RAG 本地知识库。
- Qdrant VectorStoreService。
- MemoryService。
- LangGraph AgentService。
- Agent Trace 表。
- Agent Trace 查询接口。
- Qdrant 知识库导入脚本。
- Docker Compose 基础设施。

### 24.2 当前仍偏设计 / 骨架的部分

- LangGraph checkpoint 尚未真正接入 Redis。
- Qdrant 需要运行脚本导入知识库。
- 用户长期语义记忆的自动抽取还可以增强。
- 输出侧 Guardrail 还比较轻量。
- 没有完整端到端联调保证。
- 没有 Alembic migration。

### 24.3 为什么这不影响简历表达

因为这个项目的定位不是上线产品，而是后端 / Agent 系统设计项目。

面试时重点不是说：

> 我做了一个完全可商用的健康产品。

而是说：

> 我围绕健康管理场景设计了一个可控、可追踪、可扩展的 Agent 后端架构，并落地了 LangGraph 编排、Qdrant 检索、长期记忆、Agent Trace 和 Guardrail 等核心模块。

### 24.4 最终总结

HealthMate Agent 的核心价值不是“能生成一句健康建议”，而是展示：

- 如何把 LLM 放进后端业务系统。
- 如何用 LangGraph 控制 Agent 流程。
- 如何用 Qdrant 支撑 RAG 和长期记忆。
- 如何用 MySQL 保存业务数据和 Agent Trace。
- 如何用 Redis 做缓存和幂等。
- 如何在健康场景中设计安全边界。
- 如何让 Agent 结果可解释、可排查、可扩展。

最终一句话：

> HealthMate Agent 是一个以健康管理为场景的后端 Agent 系统设计实践，它把传统后端分层、向量检索、长期记忆、RAG、Guardrail 和 Agent Trace 组合起来，形成了一个可控、可追踪、可讲清楚的求职项目。
