# HealthMate Agent 简历亮点 QA

> 使用方式：  
> Q 部分原封不动使用简历亮点描述；A 部分用“我”的口吻回答，模拟面试中面试官围绕该描述继续追问时的回答。  
> 回答结构尽量遵循：**为什么做 -> 怎么做 -> 关键实现 -> 技术取舍 -> 后续优化**。

---

## 1. LangGraph Agent 状态图

**Q：使用 LangGraph 构建健康管理 Agent 状态图，将用户画像加载、近期健康记录聚合、风险识别、长期记忆检索、健康知识库 RAG、建议生成、输出安全检查、任务规划和结果持久化拆分为多个可控节点，避免传统黑盒 Agent 在健康场景中流程不可控的问题。**

**A：**

我这里主要想解决的是大模型接入业务系统后的可控性问题。健康管理场景和普通聊天不一样，它有明确的业务流程和安全边界，不能让模型自由决定下一步做什么，所以我没有直接使用传统 LangChain AgentExecutor 那种黑盒 Agent，而是用 LangGraph 把整个流程建成显式状态图。

我的 Agent 流程大致是：

```text
check_daily_cache
 -> load_profile
 -> load_recent_records
 -> risk_guardrail
 -> retrieve_user_memory
 -> retrieve_health_knowledge
 -> generate_advice
 -> output_guardrail
 -> persist_advice_result
```

每个节点只做一件明确的事。比如 `load_profile` 只负责加载用户画像，`retrieve_health_knowledge` 只负责知识库检索，`generate_advice` 才会调用建议生成服务。这样做的好处是流程清晰，出问题时能定位到具体节点。

代码上我把 Agent 入口放在 `HealthAgentService`，节点函数放在 `HealthAgentNodes`，状态对象定义在 `HealthAgentState`。FastAPI 路由不会直接操作 LangGraph，而是调用 `HealthAgentService`，这样 API 层和 Agent 编排层是解耦的。

我还做了一个降级设计：如果本地没装 LangGraph 或版本不兼容，会按照同样的节点顺序串行执行。这是为了保证本地开发和面试项目可读性，不把所有能力都强依赖外部 Agent 框架。

如果后续继续优化，我会把健康记录解析也纳入 LangGraph，并引入 Redis checkpoint，让 Agent 状态可以短期恢复。

---

## 2. Qdrant 双 Collection 检索体系

**Q：引入 Qdrant 向量数据库构建双 Collection 检索体系，使用 `health_knowledge` 存储通用健康知识，使用 `user_health_memory` 存储用户长期语义记忆，并支持基于 `user_id`、`memory_type`、`topic`、`risk_level` 等 metadata filter 的个性化语义检索。**

**A：**

我引入 Qdrant 的原因是，HealthMate Agent 需要两类语义检索：一类是通用健康知识，比如睡眠、饮食、运动原则；另一类是用户自己的长期记忆，比如用户不喜欢跑步、膝盖不适、长期睡眠不足等。它们的数据来源、权限边界和生命周期都不一样，所以我拆成了两个 collection。

第一个 collection 是 `health_knowledge`，用于存通用知识库。它的 payload 里会有：

```json
{
  "source": "sleep",
  "title": "睡眠不足与恢复",
  "topic": "sleep",
  "tags": ["sleep"],
  "risk_level": "normal"
}
```

第二个 collection 是 `user_health_memory`，用于存用户长期语义记忆。它的 payload 里会有：

```json
{
  "user_id": 1001,
  "memory_type": "constraint",
  "source_type": "weekly_summary",
  "importance": 5
}
```

生成建议时，Agent 会先根据用户目标、近期记录、总结等构造 query，然后分别检索通用知识和用户记忆。用户记忆检索时必须带 `user_id` filter，避免不同用户之间的数据串用。

我没有选择把向量存在 MySQL 里，因为 MySQL 不适合高维向量相似搜索；也没有切 PostgreSQL + pgvector，因为项目原本就是 MySQL 技术栈，切库成本不值得。Qdrant 独立承担向量检索，MySQL 继续负责强结构化业务数据，这个边界比较清晰。

---

## 3. 多层记忆体系

**Q：设计多层记忆体系：LangGraph State 承载工作记忆，Redis 承载短期状态和幂等缓存，MySQL 保存结构化长期记忆，Qdrant 保存语义长期记忆。**

**A：**

我把记忆分成四层，是因为 Agent 不同类型的上下文适合放在不同组件里。

第一层是 Working Memory，也就是 LangGraph State。它只在单次 Agent 运行中存在，用来在节点之间传递数据，比如用户画像、近期记录、知识检索结果、最终建议等。

第二层是 Short-term Memory，设计上由 Redis 承载。当前项目里 Redis 已经用于每日建议缓存，后续还可以存 LangGraph checkpoint、短期会话状态和幂等 key。比如同一个用户同一天重复生成建议，可以直接返回缓存，避免重复调用 LLM。

第三层是结构化长期记忆，放在 MySQL，比如用户档案、健康目标、病史、健康记录、任务完成率、周总结。这些数据强结构化、需要事务和审计，用关系型数据库更合适。

第四层是语义长期记忆，放在 Qdrant，比如“用户膝盖不适，避免高冲击运动”“用户更容易完成饭后散步任务”这种自然语言记忆。它们不适合用 SQL 精确查询，更适合用向量相似检索。

这样分层后，每种数据都有清晰职责：State 管当前运行，Redis 管短期状态，MySQL 管确定性业务数据，Qdrant 管语义记忆。

---

## 4. Agent Trace 可观测模型

**Q：自研 Agent Trace 模型，记录 run、step、tool call、retrieval hit、fallback 状态和节点耗时，提升 Agent 决策链路的可解释性和可排查性。**

**A：**

Agent 系统一个很大的问题是不可解释。如果只保存最终回答，线上出问题时很难知道为什么生成这个建议、用了哪些知识、哪个节点失败了。所以我设计了 Agent Trace。

我拆了几张表：

- `t_agent_run`：记录一次 Agent 运行。
- `t_agent_step`：记录每个 LangGraph 节点执行情况。
- `t_agent_tool_call`：记录节点内部调用的业务能力。
- `t_agent_retrieval_hit`：记录 RAG 检索命中的知识。

比如一次每日建议生成，会先创建一条 `AgentRun`。然后每执行一个节点，比如 `load_profile`、`retrieve_health_knowledge`、`generate_advice`，都会记录一条 `AgentStep`，包含输入、输出、状态、耗时和错误信息。如果节点涉及工具调用，也会记录 `AgentToolCall`。如果检索了知识库，会把命中的 source、title、score、content preview 写入 `AgentRetrievalHit`。

这样做的好处是面试官如果问“你怎么知道建议是怎么来的”，我可以回答：我不仅保存了最终建议，还保存了每次 Agent 的完整执行链路，可以追踪用了哪些用户数据、检索了哪些知识、哪个节点耗时高、有没有 fallback。

---

## 5. RAG 检索增强生成

**Q：基于 RAG 检索增强生成优化健康建议生成流程，将 Markdown 健康知识库切块后写入 Qdrant，并在生成建议前根据用户目标、近期健康记录和健康总结构造 query 检索相关知识片段，减少 LLM 幻觉并增强建议依据性。**

**A：**

我做 RAG 的主要目的不是做开放式问答，而是给健康建议生成增加知识约束。健康建议如果只依赖 LLM 参数知识，容易出现建议泛化、依据不清楚甚至幻觉的问题。所以我把项目里的健康知识库切块后写入 Qdrant，在建议生成前先检索相关知识。

知识库原来是 Markdown 文件，比如睡眠、饮食、运动、健康风险等主题。我用 `KnowledgeService` 按标题切块，然后通过 `KnowledgeIndexService` 和 `VectorStoreService` 写入 Qdrant 的 `health_knowledge` collection。

生成建议时，Agent 会根据用户健康目标、近期健康标签、最新总结和原始记录构造 query。比如用户目标是减脂，近期睡眠不足，系统会检索睡眠恢复、减脂饮食、运动安排相关知识。检索结果会形成 `knowledge_context`，传给 `AdviceService`，最终注入 LLM prompt。

我也做了 fallback：如果 Qdrant 不可用，就回退到本地 `KnowledgeService` 的检索能力。这样本地开发不依赖 Qdrant，生产设计又有向量数据库支撑。

---

## 6. 健康场景 Guardrail

**Q：设计健康场景 Guardrail，对胸痛、呼吸困难、晕厥、自伤倾向、用药、诊断等高风险输入进行识别和拦截，并在输出侧过滤诊断化、处方化、药物剂量类建议，保证系统定位于日常健康管理而非医疗诊断。**

**A：**

健康场景和普通推荐系统不一样，必须明确边界。HealthMate 的定位是日常健康管理，不做医疗诊断、处方建议和急症处理。

输入侧我做了风险识别服务 `RiskWordService`，它会对用户输入做规则检测，LLM 模式下也可以用模型做辅助分类。比如输入里出现胸痛、呼吸困难、晕厥、出血、自伤等高危描述时，系统不会把它保存为普通健康记录，而是提示用户及时就医。

输出侧目前在 Agent 节点里做了轻量 Guardrail，检查建议里是否有明显诊断化、处方化内容。后续可以增强成“规则 + LLM 审核”的双层过滤。

我的设计原则是：风险识别优先级高于建议生成。只要输入可能涉及急症或医疗诊断，就不进入普通建议链路。

面试里我会强调，健康类 Agent 不能只靠 prompt 写一句“不要诊断”，必须在后端流程中加入输入侧和输出侧 Guardrail。

---

## 7. SSE 流式输出

**Q：使用 SSE 实现 AI 健康建议流式输出，后端逐字符推送建议内容，并在最终 `advice` 事件中返回 `runId`、缓存命中状态等元信息，使前端可在展示建议的同时关联 Agent 运行轨迹。**

**A：**

AI 建议生成可能耗时比较长，如果等完整结果生成后再返回，用户体验会比较差。所以我用 SSE 做流式输出。

后端接口是：

```text
GET /api/advice/stream
```

它会返回 `text/event-stream`。当前实现里，后端逐字符推送 `message` 事件：

```text
event: message
data: ...
```

最后发送一个 `advice` 事件，里面包含完整建议、`runId` 和是否命中缓存：

```json
{
  "adviceText": "...",
  "runId": 123,
  "fromCache": false
}
```

最后再发 `done`。

这里 `runId` 很重要，因为用户看到一条建议后，后端可以通过 `/api/agent/runs/{runId}` 查到这次 Agent 的完整运行链路。

另外，浏览器原生 EventSource 不方便带 Authorization Header，所以后端也支持 query token 的鉴权方式，这解决了 SSE 鉴权的工程问题。

---

## 8. Redis 每日建议缓存

**Q：基于 Redis 实现每日健康建议缓存，按照 `advice:daily:{userId}:{date}` 维度缓存生成结果，避免同一用户同一天重复调用 LLM，降低模型调用成本并提升接口响应速度。**

**A：**

每日健康建议不需要同一个用户同一天每次打开页面都重新生成。如果每次都调用 LLM，成本高、延迟大，而且建议可能不一致。所以我用 Redis 做每日建议缓存。

缓存 key 设计为：

```text
advice:daily:{userId}:{date}
```

这样粒度是用户 + 日期。同一天重复请求时，如果没有 `force=true`，就直接返回缓存。如果用户主动点击重新生成，可以传 `force=true` 绕过缓存。

代码上封装在 `CacheService`，它支持 Redis，也支持内存 fallback。如果没有配置 Redis，本地开发会用进程内字典缓存，降低环境搭建成本。

这个设计体现的是后端常见的缓存思路：用业务维度 key 控制缓存粒度，用 TTL 控制过期，用 force 参数支持主动刷新。

---

## 9. OpenAI-compatible LLM Provider

**Q：封装 OpenAI-compatible LLM Provider，支持接入 DeepSeek、Qwen、Kimi 等兼容 Chat Completions 的模型服务，并设计 Mock Provider 兜底机制，在模型未配置、调用超时或返回格式异常时自动降级，保证核心接口可用性。**

**A：**

我没有把项目绑定到某一个具体模型厂商，而是封装了 OpenAI-compatible 的 Chat Completions 调用。只要服务兼容 `/chat/completions`，比如 DeepSeek、Qwen、Kimi，都可以通过配置切换。

配置项包括：

```env
AI_MODE=llm
LLM_API_BASE=
LLM_API_KEY=
LLM_MODEL=
```

代码上我定义了 `IAdviceProvider` 协议，然后有两个实现：

- `LLMAdviceProvider`
- `MockAdviceProvider`

如果 `AI_MODE=llm` 且配置完整，就调用真实模型。如果没有配置 key、调用超时、返回格式异常或 JSON 解析失败，就回退到 Mock Provider。

这样做的好处是：项目不会因为外部模型服务不可用而整体不可用，同时也方便本地开发和课程/面试展示。

---

## 10. 自然语言健康记录解析

**Q：设计自然语言健康记录解析流程，支持从用户输入中抽取睡眠时长、饮食摄入、运动消耗、健康标签、置信度和解析警告，并在低置信度时返回 preview 供用户确认后入库，降低 LLM 解析错误对数据质量的影响。**

**A：**

用户不一定愿意按表单填写健康数据，所以我支持自然语言输入，比如“昨晚睡了 6 小时，晚上跑步 30 分钟”。系统会解析出结构化字段。

解析结果包括：

- 睡眠分钟数。
- 摄入热量。
- 运动消耗。
- 饮食详情。
- 运动详情。
- 健康标签。
- 置信度。
- 解析警告。

我没有让解析结果直接无脑入库，而是设计了 preview 机制。低置信度或者字段不完整时，后端会返回预览结果，让用户确认或修改后再调用 confirm 接口入库。

这样可以降低 LLM 解析错误对数据库数据质量的影响。尤其是健康数据，错误记录会影响后续建议生成，所以入库前必须有置信度和确认机制。

---

## 11. Pydantic Schema + 结构化 JSON 输出约束

**Q：使用 Pydantic Schema + 结构化 JSON 输出约束 对 LLM 解析结果进行字段归一化，将自然语言输入转换为可落库的健康记录结构，避免模型自由文本输出难以进入业务系统的问题。**

**A：**

LLM 最大的问题是输出自由文本，不适合直接进入业务系统。所以我在 prompt 里要求模型只输出 JSON，同时后端用 Pydantic Schema 和归一化逻辑做字段校验。

比如健康记录最终要映射到 `t_health_record` 表，所以需要字段：

- `recordDate`
- `recordType`
- `sleepMinutes`
- `intakeCalories`
- `exerciseCalories`
- `nutritionDetails`
- `exerciseDetails`
- `healthTags`
- `confidence`

LLM 返回后，我会统一做 normalize，比如兼容 `estimatedIntakeKcal`、`intakeKcal` 等不同字段名，并把数值字段转成 int。这样即使模型输出略有差异，也能尽量归一成后端可用结构。

如果模型输出缺字段或置信度低，就不会直接保存，而是返回 preview 或 fallback 到规则解析。

---

## 12. 每日任务规划 Agent

**Q：设计每日任务规划 Agent，结合用户健康目标、近期记录、历史任务完成率、今日已完成任务和长期语义记忆生成任务候选，并通过用户选择后再写入任务表，避免 Agent 自动替用户做不可控决策。**

**A：**

健康建议如果只停留在文本层面，用户很难执行。所以我把建议进一步转成每日任务候选。

任务规划会考虑：

- 用户健康目标。
- 最近健康记录。
- 历史任务完成率。
- 今日已完成任务。
- 今日未完成任务。
- 用户长期语义记忆。

但是我没有让 Agent 直接把任务全部写入数据库，而是先返回候选任务。用户选择后，再调用 `/task/add-selected` 写入任务表。

这个设计相当于 Human-in-the-loop。因为 LLM 或规则生成的任务不一定完全适合用户，让用户确认可以降低错误影响，也符合健康场景的谨慎设计。

---

## 13. 相似任务去重与难度自适应

**Q：在任务生成中实现相似任务去重与难度自适应，对已完成任务进行相似度过滤，对未完成相似任务生成低难度优化版本，并结合历史完成率动态调整任务数量和强度，形成健康建议到行为任务的闭环。**

**A：**

任务生成不能每天重复生成同样的内容，否则用户体验很差。所以我做了相似任务过滤。

逻辑大致是：

- 如果候选任务和今日已完成任务相似，就跳过。
- 如果候选任务和今日未完成任务相似，就不新增重复任务，而是生成一个更容易执行的优化版本。
- 如果历史完成率低，就减少任务数量或降低任务难度。

相似度判断用了关键词重叠和 `SequenceMatcher`。虽然不是复杂语义模型，但对短任务文本已经够用，而且实现简单可控。

这个设计体现的是：Agent 不只是生成内容，还要根据用户行为反馈调整任务策略，形成“建议 -> 任务 -> 打卡 -> 再调整”的闭环。

---

## 14. MySQL 唯一约束保证任务幂等

**Q：使用 MySQL 唯一约束保证 `user_id + task_date + task_content` 的任务幂等性，避免同一用户同一天重复生成相同任务，并通过 Repository 层封装 upsert 逻辑维护任务一致性。**

**A：**

任务重复是一个典型后端一致性问题。即使应用层做了去重，也不能完全依赖应用层，所以我在数据库层加了唯一约束：

```text
user_id + task_date + task_content
```

这样同一个用户同一天不能有完全相同的任务内容。

Repository 层里封装了 `upsert_for_date`，如果任务已存在，就更新原因和状态；如果不存在，就新增。

这和 Java 后端里常见的“业务唯一键 + upsert + 幂等控制”是一样的思路。应用层做相似度过滤，数据库层做最终一致性兜底。

---

## 15. SQLAlchemy ORM + Repository 分层

**Q：使用 SQLAlchemy ORM + Repository 分层管理用户、健康记录、每日任务、健康总结、建议历史和 Agent Trace 等核心数据表，将数据库访问与业务逻辑解耦，保持类似 Java 后端 Controller-Service-Repository 的清晰分层。**

**A：**

项目整体分层和 Java 后端很类似：

```text
FastAPI Route
 -> AgentService / DomainService
 -> Repository
 -> SQLAlchemy Model
 -> MySQL
```

SQLAlchemy Model 类似 JPA Entity 或 MyBatis 实体类，Repository 类似 Mapper/DAO。

我这样设计是为了避免在 API 路由里直接写 SQL 或 ORM 查询。比如健康记录相关查询放在 `HealthRepository`，任务查询放在 `TaskRepository`，Agent Trace 查询放在 `AgentRepository`。

这样后续如果调整数据库查询、加索引、改分页逻辑，不会影响上层 Agent 编排逻辑。

---

## 16. 健康周期总结机制

**Q：设计健康周期总结机制，按周/月聚合用户健康记录，统计平均睡眠、平均摄入、平均消耗和高频健康标签，并将周期总结作为长期上下文输入 Agent，降低直接读取大量历史记录带来的上下文成本。**

**A：**

Agent 不能每次都把用户所有历史记录塞进 prompt，否则上下文太长，成本也高。所以我设计了周期总结。

系统按周或月聚合健康记录，统计：

- 记录天数。
- 平均睡眠。
- 平均摄入。
- 平均消耗。
- 高频健康标签。

这些结果会写入 `t_health_summary`。之后生成建议时，只需要读取最新总结，而不是扫描全部历史记录。

这个设计类似长上下文压缩，把大量原始行为数据压缩成结构化摘要，既减少上下文长度，也让 Agent 更容易理解长期趋势。

---

## 17. 知识库导入 Qdrant 脚本

**Q：引入知识库导入 Qdrant 脚本，将本地 Markdown 健康知识按标题切块、生成 embedding 并写入 `health_knowledge` collection，支持后续知识库扩展、重建和离线评估。**

**A：**

为了让 RAG 不只是代码里调用检索，我补了知识库导入流程。

本地知识库是 Markdown 文件，按 `##` 标题切块。每个 chunk 会生成一条向量记录写入 Qdrant，payload 中保存 source、title、topic、tags、risk_level。

脚本是：

```text
backend/scripts/index_knowledge_qdrant.py
```

这个脚本可以用于初始化知识库，也可以后续扩展成增量更新或重建索引。

这个设计让知识库从“项目内文件”变成“可检索的向量知识库”，更接近真实 RAG 系统。

---

## 18. 本地 KnowledgeService fallback

**Q：保留本地 KnowledgeService fallback，当 Qdrant 不可用或未部署时，系统自动回退到本地 Markdown embedding / 关键词检索，保证 RAG 流程具备降级能力。**

**A：**

我不希望系统强依赖 Qdrant 才能运行，所以保留了本地 `KnowledgeService`。

检索优先级是：

```text
Qdrant health_knowledge
 -> 如果无结果或不可用
 -> 本地 KnowledgeService
```

本地 KnowledgeService 会加载 Markdown 文件，按标题切块。如果 sentence-transformers 可用，就做本地 embedding；如果 embedding 模型不可用，就回退关键词匹配。

这个多级 fallback 设计能保证本地开发、面试演示和生产设计都能兼容。

---

## 19. Agent Trace 查询接口

**Q：设计 Agent Trace 查询接口，提供 `/api/agent/runs` 和 `/api/agent/runs/{runId}` 查看 Agent 运行记录、节点执行状态、工具调用信息和检索命中结果，便于面试展示系统可观测性设计。**

**A：**

Trace 数据如果只能写不能查，价值会打折。所以我提供了查询接口。

`GET /api/agent/runs` 可以查看当前用户最近的 Agent 运行记录，包括 runType、status、latency、fallbackUsed 等。

`GET /api/agent/runs/{runId}` 可以查看某次运行的详情，包括：

- run 基本信息。
- steps。
- toolCalls。
- retrievalHits。

这样如果面试官问“你怎么验证 Agent 的可解释性”，我可以直接说：通过 runId 可以查到一次建议的完整运行链路，包括每个节点和每次检索。

---

## 20. JWT + SSE Query Token

**Q：通过 JWT 实现用户登录鉴权，后端从 Bearer Token 中解析当前用户身份，并为 SSE 场景额外支持 query token 方式，解决浏览器原生 EventSource 不方便携带 Authorization Header 的问题。**

**A：**

普通 REST 接口使用 `Authorization: Bearer token` 鉴权，后端通过 `get_current_user_id` 解析用户身份。

但是 SSE 有一个特殊问题：浏览器原生 `EventSource` 不方便自定义 Authorization Header。所以我额外支持：

```text
/api/advice/stream?token=xxx
```

后端会优先读取 Bearer Token，如果没有，再读取 query token。

这样既保留了标准 JWT 鉴权，也解决了 SSE 在浏览器里的实际工程问题。

---

## 21. 统一响应结构和全局异常处理

**Q：使用统一响应结构和全局异常处理，将业务异常、参数校验异常和 HTTP 异常统一包装为 `{code, message, data}` 格式，便于前后端协作和错误码管理。**

**A：**

项目里统一返回：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

业务异常会抛 `AppException`，全局异常处理器统一转换为同样结构。

这样前端不需要根据不同 HTTP 错误结构写多套解析逻辑，只要看 `code` 和 `message` 即可。

这个设计和 Java 后端里常见的 `Result<T>`、`GlobalExceptionHandler` 是一样的。

---

## 22. Redis / 内存缓存双实现

**Q：使用 Redis / 内存缓存双实现封装 CacheService，当未配置 Redis 或 Redis 不可用时自动回退本地内存缓存，降低本地开发环境搭建复杂度，同时保留生产环境 Redis 扩展能力。**

**A：**

`CacheService` 会先尝试连接 Redis。如果配置了 Redis，就用 Redis；如果没配置或 Redis 调用失败，就回退到进程内内存缓存。

这样做有两个好处：

第一，本地开发不需要强制启动 Redis，项目更容易运行。  
第二，生产设计上仍然支持 Redis，后续可以扩展为多实例共享缓存、分布式锁和幂等控制。

这是一个典型的“开发环境轻量化 + 生产能力预留”的设计。

---

## 23. Docker Compose Agent 基础设施

**Q：设计 Docker Compose Agent 基础设施，编排 MySQL、Redis、Qdrant 三个核心中间件，明确业务数据、缓存状态和向量检索的组件边界，方便后续部署和面试讲解系统依赖。**

**A：**

我新增了 `docker-compose.agent.yml`，里面包含：

- MySQL：业务数据和 Agent Trace。
- Redis：缓存和短期状态。
- Qdrant：向量知识库和语义记忆。

这个 Compose 文件主要作用是明确系统依赖边界。面试时我可以用它说明：

```text
MySQL 管结构化数据
Redis 管缓存和短期状态
Qdrant 管向量检索
```

虽然当前项目不追求完整部署演示，但这个基础设施设计能体现系统架构的完整性。

---

## 24. LangGraph 降级执行策略

**Q：在 Agent 编排中保留 LangGraph 降级执行策略，当 LangGraph 依赖缺失或图构建 API 版本不兼容时，可按相同节点顺序串行执行，兼顾 Agent 框架引入和本地开发稳定性。**

**A：**

我在 `HealthAgentService` 里做了一个降级策略。正常情况下使用 LangGraph StateGraph 执行节点。如果 LangGraph 没安装，或者图构建 API 因版本问题不可用，就按同样节点顺序串行执行。

这个设计不是为了绕开 LangGraph，而是为了本地开发和面试项目更稳定。因为当前项目重点是理解架构和代码实现，不应该因为环境依赖没装好就完全不能阅读或运行核心逻辑。

需要注意的是，如果节点本身执行失败，我不会吞掉异常，而是记录 Trace 后抛出。降级只针对框架依赖，不掩盖业务错误。

---

## 25. LLM 调用边界

**Q：设计 LLM 调用边界，不让模型直接访问数据库或自由调用工具，而是由 LangGraph 节点调用后端受控 Service，确保权限校验、数据访问、风险控制和 Trace 记录都由后端系统掌握。**

**A：**

我没有让 LLM 直接访问数据库，也没有让它自由选择工具。所有数据访问都由后端 Service 和 Repository 完成，LLM 只拿到后端整理好的上下文。

这样做有几个原因：

- 权限控制必须在后端。
- 数据库访问不能交给模型自由决定。
- 健康场景必须先经过风险识别。
- 每次工具调用需要记录 Trace。
- 流程必须可控。

所以这个项目的 Agent 更像“后端受控 Agent”，而不是“模型自治 Agent”。这也是我认为健康场景更合理的实现方式。

---

## 26. 健康知识与用户记忆分离

**Q：使用健康知识与用户记忆分离设计，将通用知识库和用户个人记忆拆分为不同 Qdrant collection，避免通用健康知识和用户隐私数据混杂，也方便按不同检索策略、权限策略和生命周期管理数据。**

**A：**

通用健康知识和用户个人记忆不能混在一起。

通用知识是所有用户共享的，例如睡眠建议、饮食原则、运动注意事项。用户记忆是私有数据，例如用户偏好、伤病限制、长期习惯。

如果混在一个 collection 里，后续权限隔离、删除用户数据、更新知识库都会变复杂。所以我拆成：

- `health_knowledge`
- `user_health_memory`

用户记忆检索必须带 `user_id` filter，知识库检索则不需要用户过滤。

这个设计体现的是数据隔离和隐私边界。

---

## 27. 输入解析置信度机制

**Q：设计输入解析置信度机制，根据识别出的睡眠、饮食、运动等有效字段数量计算 high / medium / low 置信度，并对低质量输入返回失败原因和补充建议，提高健康记录数据质量。**

**A：**

自然语言输入质量不稳定，比如用户只输入“今天还行”，这种内容没有可落库字段。如果强行保存，会污染健康数据。

所以解析后会计算置信度。简单来说，识别出的有效字段越多，置信度越高。比如同时识别到睡眠和运动，置信度就比只识别到一个字段更高。

如果没有识别到有效字段，系统会返回 `shouldSave=false`、`failureReason` 和 `suggestions`，提示用户补充睡眠时长、饮食内容或运动信息。

这个机制保证了健康记录表里的数据质量，避免后续建议生成基于低质量输入。

---

## 28. AdviceHistory + AgentRun 双层记录

**Q：通过 AdviceHistory + AgentRun 双层记录同时保存业务结果和 Agent 运行过程：AdviceHistory 面向用户历史展示，AgentRun 面向工程排查和决策解释，实现业务数据与可观测数据分离。**

**A：**

我没有把建议历史和 Agent Trace 混在一张表里。

`AdviceHistory` 是业务表，面向用户展示历史建议，只需要保存建议文本和时间。

`AgentRun` 是可观测性表，面向工程排查，保存输入快照、输出快照、状态、耗时、fallback、错误信息等。

这样分离的好处是：

- 用户查询历史建议时不需要加载大量 Trace 数据。
- 工程排查时可以通过 runId 查完整链路。
- 业务数据和可观测数据生命周期可以不同。

这是类似业务表和日志表分离的设计。

---

## 29. Human-in-the-loop 任务确认

**Q：使用任务候选确认机制实现 Human-in-the-loop，Agent 只生成候选任务，不直接强制写入用户今日任务，用户确认后再调用 `/task/add-selected` 入库，降低 LLM 输出错误对用户行为计划的影响。**

**A：**

健康任务会影响用户行为，比如运动、饮食和作息。如果 Agent 直接把任务写入用户计划，可能会生成不合适的任务。

所以我设计成两步：

1. `/task/generate-preview` 生成候选任务。
2. 用户选择后 `/task/add-selected` 入库。

这样用户保留最终决策权。这个设计可以看作 Human-in-the-loop，也就是人在关键决策点参与确认。

面试时我会强调，健康场景不适合完全自动化，应该让 Agent 辅助决策，而不是替代用户决策。

---

## 30. 非医疗边界 Prompt

**Q：设计健康场景非医疗边界 Prompt，在 LLM Advice Provider 中明确要求模型不能输出疾病诊断、处方药建议或用药调整，对急性不适建议及时就医，提高模型输出安全性。**

**A：**

除了后端 Guardrail，我在 LLM system prompt 里也明确限制模型角色：它是日常健康习惯监督助手，不是医生。

Prompt 中会要求：

- 不做疾病诊断。
- 不给处方药建议。
- 不做用药剂量调整。
- 急性不适建议及时就医。
- 输出结构化 JSON。

这不是唯一安全手段，但它是第一层约束。真正的安全还要靠后端输入侧和输出侧 Guardrail。

---

## 31. RAG 评估脚本与结果文件

**Q：建立 RAG 评估脚本与结果文件，通过 `compare_rag_advice.py` 和 `evaluate_rag_advice.py` 对比 No-RAG 与 RAG 版本建议，在任务数量、数字化建议、知识命中等维度评估知识增强效果。**

**A：**

RAG 不能只凭感觉说效果更好，所以我加了评估脚本。

`compare_rag_advice.py` 用来对比单个场景下有无 RAG 的建议差异。  
`evaluate_rag_advice.py` 用来批量跑多个健康场景，并输出指标。

评估维度包括：

- 是否 fallback。
- 检索到的 chunks 数量。
- 建议文本长度。
- 生成任务数量。
- 数字化建议数量。
- 行动建议数量。
- 知识命中情况。

虽然这不是严格学术评测，但对项目级 RAG 来说，已经能说明我有意识地评估 RAG 是否真的增强了建议生成。

---

## 32. Provider 抽象设计

**Q：使用模块化 Provider 设计抽象 Advice 生成能力，通过 `IAdviceProvider` 协议隔离 Mock Provider 和 LLM Provider，便于后续切换不同模型厂商或增加多模型路由策略。**

**A：**

我把建议生成抽象成 `IAdviceProvider`，然后有两个实现：

- `MockAdviceProvider`
- `LLMAdviceProvider`

这样上层 `AdviceService` 不关心具体用哪个模型。它只调用 provider 的 `generate` 方法。

这个设计类似 Java 里的接口 + 多实现。好处是：

- 本地开发可以用 Mock。
- 生产可以用 LLM。
- 后续可以增加 DeepSeekProvider、QwenProvider 或多模型路由。
- 测试也更方便。

这体现的是依赖倒置，不把业务逻辑绑死在某个模型厂商上。

---

## 33. 后台维护任务接口

**Q：设计后台维护任务接口，支持任务归档、周总结生成、每日建议预生成等运维型能力，为后续接入 APScheduler / Celery 异步任务打基础。**

**A：**

项目里有一些不适合用户请求实时触发的任务，比如：

- 归档历史任务。
- 批量生成周总结。
- 预生成每日建议。

当前先通过 `/api/admin/jobs/*` 暴露管理接口，后续可以迁移到 APScheduler 或 Celery 定时任务。

这样做是分阶段设计。第一阶段先把业务能力服务化，第二阶段再接真正的调度系统。

---

## 34. 多源上下文融合

**Q：在健康建议生成中融合多源上下文，包括用户目标、目标版本、病史、近期健康记录、最新周期总结、任务完成率、RAG 知识片段和语义记忆，提升建议的个性化程度。**

**A：**

个性化建议不能只看一句用户输入。我的 Agent 会融合多源上下文。

包括：

- 用户健康目标。
- 用户目标更新时间。
- 病史、伤病史、过敏史。
- 近 7 天健康记录。
- 昨日任务完成率。
- 最新周总结。
- RAG 检索到的健康知识。
- Qdrant 检索到的用户长期记忆。

这些信息会被整理成 metrics 和 knowledge_context，再传入 AdviceService。

这样生成的建议更贴合用户，而不是泛泛地说“多运动、早睡觉”。

---

## 35. 结构化健康记录 JSON 字段

**Q：使用结构化健康记录 JSON 字段保存 `nutrition_details`、`exercise_details`、`health_tags` 和 `parse_warnings`，兼顾灵活扩展与关系型数据库查询能力，适合健康记录字段不断演进的场景。**

**A：**

健康记录里有些字段比较灵活，比如饮食详情、运动详情、解析警告。如果全部拆成关系表，前期会很复杂；如果全部放文本，又不利于后续结构化处理。

所以我在 MySQL 表里使用 JSON 字段保存：

- `nutrition_details`
- `exercise_details`
- `health_tags`
- `parse_warnings`

这样既能保留结构化信息，又方便后续扩展字段。核心数值，比如睡眠分钟数、摄入热量、运动消耗，仍然单独建列，方便统计趋势。

这是结构化字段和半结构化字段结合的设计。

---

## 36. CSV 健康数据导出

**Q：通过 CSV 导出接口支持健康数据导出，并加入 UTF-8 BOM 兼容 Excel 中文打开，体现对真实用户数据可迁移性的考虑。**

**A：**

健康数据属于用户个人数据，应该支持导出。所以我提供了 CSV 导出接口。

接口支持日期范围：

```text
GET /api/health/export?startDate=...&endDate=...
```

导出字段包括记录日期、睡眠、摄入、消耗、置信度和原始输入。

我还加了 UTF-8 BOM，这是因为 Windows Excel 打开中文 CSV 时经常乱码，加 BOM 可以提升兼容性。

这个点虽然不复杂，但体现了对真实用户数据可迁移性的考虑。

---

## 37. 后端 Agent 工程项目定位

**Q：将项目设计为后端 Agent 工程项目而非前端展示项目，前端仅作为接口调用方，核心亮点集中在 Agent 编排、RAG、记忆层、Trace、Guardrail、缓存和数据建模，更贴合后端 / Agent 开发求职方向。**

**A：**

这个项目的目标不是展示一个漂亮前端，而是展示我对后端 Agent 系统的设计和实现理解。

所以我把重点放在：

- 后端分层。
- Agent 状态图。
- RAG 检索。
- 长期记忆。
- Guardrail。
- Agent Trace。
- MySQL / Redis / Qdrant 分工。
- LLM fallback。

前端只是接口调用方，用来承载功能，不作为主要优化方向。

如果面试官问我为什么不重点做前端，我会回答：我的求职方向是后端 / Agent 开发，所以这个项目刻意把复杂度放在后端架构和 Agent 工程化上，而不是 UI 展示。

