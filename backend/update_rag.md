# HealthMate RAG 更新说明

## 一、改造目标

本次 RAG 改造的目标不是新增完整的健康问答系统，而是在现有 HealthMate 后端能力上增加“知识增强”层，使 AI 健康建议和健康记录解析更有依据、更稳定、更容易解释。

改造原则：

- 保留现有 REST API 和核心业务流程。
- 不改登录、档案、记录入库、任务打卡等确定性链路。
- RAG 只作为 LLM prompt 的知识上下文，不直接替代业务判断。
- 第一阶段不改前端，不新增多轮问答页面。

## 二、整体架构

当前 RAG 流程如下：

```text
用户健康数据 / 健康标签 / 健康目标
        |
        v
构造检索 query
        |
        v
KnowledgeService 检索知识库
        |
        v
将知识片段注入 LLM prompt
        |
        v
生成更有依据的健康建议或解析结果
```

已接入两个主要场景：

1. `advice` 健康建议生成
   - 根据用户近期记录、健康标签、健康目标、健康总结检索相关知识。
   - 将检索到的知识片段注入 LLM 上下文。
   - 生成更具体的日常健康建议和任务。

2. `health_parse_ai` 健康记录解析
   - 根据用户原始输入提取关键词并检索相关知识。
   - 将知识片段注入解析器 system prompt。
   - 辅助 LLM 更稳定地识别饮食、运动、睡眠、风险边界等信息。

## 三、核心文件变更

### 1. 新增知识检索服务

文件：

```text
backend/app/services/knowledge.py
```

职责：

- 加载 `backend/app/data/knowledge/*.md`。
- 按 `##` 标题分块。
- 提供 `search(query, top_k=3)` 检索接口。
- 提供 `render_context(query)`，将检索结果渲染为 prompt 可用文本。
- 支持 embedding 检索。
- 当 `sentence-transformers` 不可用时，自动降级为关键词检索。

### 2. 新增配置项

文件：

```text
backend/app/core/config.py
backend/.env.example
backend/.env
```

新增配置：

```env
KNOWLEDGE_ENABLED=true
KNOWLEDGE_DIR=app/data/knowledge
KNOWLEDGE_TOP_K=3
KNOWLEDGE_EMBEDDING_MODEL=BAAI/bge-small-zh-v1.5
```

说明：

- `KNOWLEDGE_ENABLED`：RAG 开关，可一键关闭知识增强。
- `KNOWLEDGE_DIR`：知识库目录。
- `KNOWLEDGE_TOP_K`：每次检索返回的知识片段数量。
- `KNOWLEDGE_EMBEDDING_MODEL`：本地 embedding 模型名称。

### 3. 修改健康建议生成

文件：

```text
backend/app/services/advice.py
```

改动：

- 在 `AdviceService.build_context()` 中构造知识检索 query。
- query 来源包括：
  - 用户健康目标
  - 近期健康标签
  - 最近健康总结
  - 最近健康记录
- 检索结果写入 `knowledge_context`。
- LLM 生成建议时可以使用该上下文。

### 4. 修改健康记录解析

文件：

```text
backend/app/services/health_parse_ai.py
```

改动：

- 在 LLM 解析前，根据用户输入提取关键词。
- 调用 `KnowledgeService` 检索相关健康知识。
- 将知识片段注入 system prompt。
- 明确提示 LLM：知识仅用于辅助判断，不要原样复述，不做医疗诊断。

### 5. 新增依赖

文件：

```text
backend/requirements.txt
```

新增：

```text
sentence-transformers==3.0.1
```

说明：

- 用于本地中文 embedding 检索。
- 若依赖或模型不可用，系统会自动回退到关键词检索。

## 四、知识库建设

知识库目录：

```text
backend/app/data/knowledge/
```

当前文件：

```text
sleep.md
nutrition.md
exercise.md
health_risk.md
weight_management.md
chronic_basics.md
mental_wellbeing.md
user_recording.md
sources.md
```

当前规模：

```text
chronic_basics.md        10 sections
exercise.md              10 sections
health_risk.md           10 sections
mental_wellbeing.md      10 sections
nutrition.md             10 sections
sleep.md                  9 sections
sources.md                9 sections
user_recording.md        10 sections
weight_management.md     10 sections
```

合计约 88 个知识分块。

覆盖主题：

- 睡眠时长、睡眠不足、熬夜恢复、午休、睡前饮食。
- 日常饮食结构、火锅、奶茶、夜宵、外卖、高糖饮品。
- 快走、跑步、力量训练、久坐打断、低冲击运动。
- 胸痛、呼吸困难、晕厥、用药边界、心理危机边界。
- 减脂、增肌、平台期、极端节食、外食策略。
- 血糖、血压、血脂、痛风、慢病记录。
- 压力、情绪性进食、低动力状态、睡前放松。
- 健康记录格式、低质量输入、多事件记录、标签记录。

知识来源策略：

- 不直接复制 GitHub 或外部文章。
- 参考公开权威资料后进行场景化改写。
- 保持短块结构，便于向量检索和 prompt 注入。
- 来源说明集中放在 `sources.md`。

主要参考方向：

- 中国营养学会《中国居民膳食指南（2022）》。
- WHO 身体活动与久坐行为指南。
- CDC 睡眠与公共健康资料。
- CDC / Mayo Clinic / WHO 关于高危症状和心理危机的公共健康资料。

## 五、评估工具

### 1. 单案例对比脚本

文件：

```text
backend/scripts/compare_rag_advice.py
```

作用：

- 对同一组健康数据分别运行 No RAG 和 RAG。
- 输出无 RAG / 有 RAG 的知识上下文和建议文本。
- 检查 LLM 环境是否配置。
- 如果未配置 LLM，会提示当前可能回退到 mock 模式。

运行方式：

```powershell
cd backend
python scripts\compare_rag_advice.py
```

### 2. 批量评估脚本

文件：

```text
backend/scripts/evaluate_rag_advice.py
```

作用：

- 批量评估多个健康场景。
- 同时运行 No RAG 和 RAG。
- 输出多维指标，而不是主观总分。

当前评估场景：

- 睡眠不足 + 减脂。
- 火锅 + 奶茶。
- 久坐 + 运动不足。
- 夜宵 + 熬夜。
- 膝盖旧伤 + 低冲击运动。
- 血糖管理边界。
- 压力 + 情绪性进食。
- 低质量健康记录。
- 增肌 + 恢复不足。

评估指标：

- `Fallback`：是否疑似回退到 mock。
- `Chunks`：检索到的知识片段数。
- `Chars`：建议文本长度。
- `Tasks`：生成任务数量。
- `Numbers`：建议文本中的数字化建议数量。
- `Actions`：行动词命中数。
- `Knowledge Hits`：最终建议与检索知识的重合命中数。

运行方式：

```powershell
cd backend
python scripts\evaluate_rag_advice.py
```

评估结果会写入：

```text
backend/rag_evaluation_results.json
```

## 六、当前效果

通过真实 LLM 配置运行后，RAG 相比 No RAG 的主要变化包括：

- 在有明确知识命中的场景下，建议更具体。
- 例如久坐场景中，RAG 能给出“每 60 分钟起身活动 3 分钟”这类可执行建议。
- 在火锅、奶茶、夜宵、睡眠不足等场景中，RAG 更容易引用饮食热量密度、睡眠与体重管理等知识。
- 在慢病和风险场景中，RAG 能更清晰地保持边界，避免诊断或用药建议。

评估结果显示，RAG 不是所有场景都必然更好，但在知识库覆盖充分、检索命中明确的场景中，建议的依据相关性和具体性更强。

## 七、当前边界

当前 RAG 仍然是第一阶段增强能力，有以下边界：

- 不是完整健康问答系统。
- 没有多轮对话历史。
- 前端暂未展示“参考依据”。
- 知识库内容仍是项目级知识库，不是生产级医学知识库。
- 不提供疾病诊断、处方、用药调整或治疗方案。
- RAG 效果依赖知识库覆盖范围和检索命中质量。

## 八、后续可扩展方向

后续可以继续优化：

1. 前端展示参考依据
   - 在 SSE 中增加 `knowledge` 事件。
   - 在 AI 建议下方折叠展示参考知识来源。

2. 知识库继续扩充
   - 增加女性周期、老年人活动、校园生活、食堂饮食、增肌饮食等高频场景。

3. 检索质量优化
   - 增加 query 重写。
   - 对知识块增加标签字段。
   - 对重复知识块做去重。

4. 评估体系增强
   - 增加人工评分。
   - 增加更多真实用户样例。
   - 输出图表化评估结果。

5. 第二阶段健康问答
   - 新增 `/api/assistant/chat`。
   - 支持 SSE 流式问答。
   - 引入会话历史和引用展示。

## 九、总结

本次 RAG 改造采用低侵入式方案，在不重构现有系统的前提下，为 HealthMate 增加了知识增强能力。当前实现已经具备知识库、检索服务、业务注入、可控开关和评估脚本，能够支撑课程项目中的技术展示和功能说明。

该方案的核心价值在于：让 AI 建议不只依赖模型自身能力，而是结合项目维护的健康知识库进行生成，从而提升建议的依据性、场景贴合度和安全边界控制能力。
