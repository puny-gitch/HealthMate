$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

$template = "docs/计算机综合项目实践实验报告模板.docx"
$output = "HealthMate_计算机综合项目实践实验报告.docx"

Copy-Item -LiteralPath $template -Destination $output -Force

function Escape-XmlText([string]$text) {
    if ($null -eq $text) { return "" }
    return [System.Security.SecurityElement]::Escape($text)
}

function New-Run([string]$text, [bool]$bold = $false, [string]$size = "24") {
    $escaped = Escape-XmlText $text
    $b = if ($bold) { "<w:b/>" } else { "" }
    return @"
<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="宋体" w:hAnsi="Times New Roman"/><w:sz w:val="$size"/><w:szCs w:val="$size"/>$b</w:rPr><w:t xml:space="preserve">$escaped</w:t></w:r>
"@
}

function New-Paragraph([string]$text = "", [string]$align = "left", [bool]$bold = $false, [string]$size = "24", [int]$spacingAfter = 120) {
    $jc = if ($align -eq "left") { "" } else { "<w:jc w:val=`"$align`"/>" }
    $run = New-Run $text $bold $size
    return @"
<w:p><w:pPr><w:spacing w:after="$spacingAfter" w:line="360" w:lineRule="auto"/>$jc</w:pPr>$run</w:p>
"@
}

function New-Heading([string]$text, [int]$level = 1) {
    $size = if ($level -eq 1) { "32" } elseif ($level -eq 2) { "28" } else { "26" }
    $spacing = if ($level -eq 1) { 240 } else { 180 }
    return New-Paragraph $text "left" $true $size $spacing
}

function New-PageBreak() {
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
}

function New-Table([array]$rows) {
    $xml = @"
<w:tbl>
<w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr>
"@
    foreach ($row in $rows) {
        $xml += "<w:tr>"
        foreach ($cell in $row) {
            $xml += "<w:tc><w:tcPr><w:tcW w:w=`"2400`" w:type=`"dxa`"/></w:tcPr>"
            $xml += New-Paragraph ([string]$cell) "left" $false "21" 60
            $xml += "</w:tc>"
        }
        $xml += "</w:tr>"
    }
    $xml += "</w:tbl>"
    return $xml
}

$body = ""

# Cover
$body += New-Paragraph "武汉大学计算机学院" "center" $true "36" 260
$body += New-Paragraph "本科生课程设计报告" "center" $true "36" 260
$body += New-Paragraph "计算机综合项目实践实验报告" "center" $true "34" 600
$body += New-Paragraph "题目：HealthMate 健康伴侣" "center" $true "30" 260
$body += New-Paragraph "——基于大语言模型的个人健康智能分析与管理系统" "center" $false "26" 720
$body += New-Paragraph "专业名称：计算级弘毅班" "center" $false "24" 160
$body += New-Paragraph "课程名称：计算机综合项目实践" "center" $false "24" 160
$body += New-Paragraph "指导教师：谭小琼" "center" $false "24" 160
$body += New-Paragraph "团队名称：token" "center" $false "24" 160
$body += New-Paragraph "学生姓名：周炜、黎宇恒" "center" $false "24" 160
$body += New-Paragraph "学生学号：2023302112015、2023302112014" "center" $false "24" 480
$body += New-Paragraph "二〇二六年五月" "center" $false "24" 160
$body += New-PageBreak

# Declaration
$body += New-Paragraph "郑 重 声 明" "center" $true "30" 260
$body += New-Paragraph "本人呈交的设计报告，是在指导老师的指导下，独立进行实验工作所取得的成果，所有数据、图片资料真实可靠。尽我所知，除文中已经注明引用的内容外，本设计报告不包含他人享有著作权的内容。对本设计报告做出贡献的其他个人和集体，均已在文中以明确的方式标明。本设计报告的知识产权归属于培养单位。" "left" $false "24" 220
$body += New-Paragraph "本人签名：" "left" $false "24" 220
$body += New-Paragraph "日期：2026 年 5 月 31 日" "left" $false "24" 220
$body += New-PageBreak

# Abstract
$body += New-Paragraph "摘 要" "center" $true "30" 260
$body += New-Paragraph "HealthMate 健康伴侣是一个面向日常健康管理场景的 AI 辅助 Web 系统。项目围绕「记录—分析—建议—行动—反馈」的闭环展开，支持用户注册登录、健康档案维护、自然语言健康记录解析、结构化数据保存、健康趋势可视化、AI 健康建议、候选任务生成与任务打卡等核心功能。系统前端采用 React、Vite、Ant Design Mobile 与 ECharts 构建移动端友好的交互界面；后端采用 FastAPI、SQLAlchemy、MySQL、JWT 鉴权与 OpenAI-compatible 大模型接口实现业务服务；AI 能力通过结构化 Prompt、用户确认机制、高危内容识别和轻量级 RAG 知识增强共同支撑，既降低用户记录门槛，也保证系统不越过日常健康管理边界。" "left" $false "24" 160
$body += New-Paragraph "本报告依据项目最终代码实现撰写，重点说明系统需求、总体设计、详细实现、测试情况与团队分工。相较早期规划文档，报告中的功能范围以当前仓库中实际实现的前后端代码为准。" "left" $false "24" 260
$body += New-Paragraph "关键词：HealthMate；健康管理；FastAPI；React；大语言模型；RAG；数据可视化；任务打卡" "left" $false "24" 220
$body += New-PageBreak

# TOC
$body += New-Paragraph "目 录" "center" $true "30" 260
$tocLines = @(
    "第1章 概述",
    "  1.1 选题",
    "  1.2 分组及分工",
    "第2章 系统需求分析",
    "  2.1 引言",
    "  2.2 功能需求",
    "  2.3 非功能需求",
    "  2.4 技术选型",
    "  2.5 其他要求",
    "第3章 系统设计",
    "  3.1 引言",
    "  3.2 系统功能设计",
    "  3.3 系统 UI 设计",
    "  3.4 系统详细设计",
    "  3.5 数据库设计",
    "第4章 系统实现",
    "  4.1 引言",
    "  4.2 系统典型界面",
    "  4.3 测试计划",
    "  4.4 测试报告",
    "第5章 总结"
)
foreach ($line in $tocLines) { $body += New-Paragraph $line "left" $false "24" 80 }
$body += New-PageBreak

# Chapter 1
$body += New-Heading "第1章 概述" 1
$body += New-Heading "1.1 选题" 2
$body += New-Paragraph "本项目选题为「基于大语言模型的个人健康智能分析与管理系统」，产品名称为 HealthMate 健康伴侣。项目面向日常健康管理场景，关注用户睡眠、饮食、运动、健康目标和任务执行情况等信息，旨在通过 AI 技术降低健康记录门槛，并将健康建议转化为用户可执行、可反馈的日常任务。" "left" $false "24" 120
$body += New-Paragraph "传统健康管理工具往往停留在表单录入和数据展示层面，用户需要手动填写大量字段，长期坚持成本较高。与此同时，单纯展示图表无法直接推动用户形成行动。HealthMate 的设计目标是构建从自然语言输入到结构化健康数据，再到 AI 建议、候选任务和打卡反馈的闭环流程，使系统既具备记录能力，也具备辅助决策和行动干预能力。" "left" $false "24" 120
$body += New-Paragraph "系统定位为日常健康辅助管理工具，不提供疾病诊断、处方、用药调整或治疗方案。对于用户输入中涉及病痛、高危症状、心理危机或其他超出日常健康管理范围的内容，系统通过高危内容识别机制拒绝作为普通健康记录保存，并提示用户及时就医或寻求专业帮助。" "left" $false "24" 120
$body += New-Heading "1.2 分组及分工" 2
$body += New-Paragraph "团队名称为 token，共 2 名成员。团队采用前后端分离协作方式，并结合 Scrum 敏捷开发中的角色划分进行任务推进。分工依据早期团队组建报告和 Git 提交历史综合整理如下。" "left" $false "24" 120
$body += New-Table @(
    @("成员", "角色", "主要分工"),
    @("周炜", "Product Owner / 后端开发 / 测试 / 运维", "负责业务流程梳理、产品 Backlog 管理、FastAPI 后端框架、数据库模型、认证鉴权、健康记录接口、AI 解析、高危识别、任务生成、趋势聚合、接口测试与联调文档。Git 历史中主要提交集中在 backend 目录和后端联调改造。"),
    @("黎宇恒", "Scrum Master / 前端开发 / 测试 / 运维", "负责前端 UI/UX、React 页面与组件、路由、接口封装、ECharts 可视化、SSE 建议流、任务与趋势页面、前端联调优化；同时参与轻量级 RAG 知识库、KnowledgeService 和评估脚本补充。Git 历史中主要提交集中在 frontend 目录及 RAG 改造。")
)
$body += New-Paragraph "从提交记录看，周炜主要承担后端核心业务与接口能力建设，黎宇恒主要承担前端页面与交互实现，并在后期补充了知识增强相关能力。两名成员共同参与测试、联调和最终答辩资料整理。" "left" $false "24" 120
$body += New-PageBreak

# Chapter 2
$body += New-Heading "第2章 系统需求分析" 1
$body += New-Heading "2.1 引言" 2
$body += New-Paragraph "HealthMate 的需求围绕普通用户的日常健康管理展开。用户希望以低成本记录生活状态，系统则需要将这些零散记录转化为结构化数据，并进一步生成可理解、可执行的健康建议和任务。由于健康场景具有安全边界，系统必须避免医疗诊断式输出，并对高危输入进行提醒。" "left" $false "24" 120
$body += New-Heading "2.2 功能需求" 2
$body += New-Paragraph "（1）用户认证与档案管理：系统支持用户注册、登录和 JWT 鉴权；用户可以维护性别、身高、体重、健康目标、伤病史和过敏史等健康档案信息。伤病史和过敏史拆分存储，便于运动建议和饮食建议分别使用。" "left" $false "24" 100
$body += New-Paragraph "（2）健康记录录入与解析：用户可以输入自然语言健康记录，例如饮食、运动和睡眠描述。后端通过 AI 解析接口返回结构化预览数据，包括睡眠分钟、摄入热量、运动消耗、饮食详情、运动详情、健康标签、置信度和解析警告。解析结果需经用户确认后保存。" "left" $false "24" 100
$body += New-Paragraph "（3）多次记录与记录管理：系统支持用户同一天多次新增健康记录，不再按日期覆盖。后端提供最近记录、历史记录查询和删除接口，便于用户移除误输入或过时数据，减少对后续建议生成的干扰。" "left" $false "24" 100
$body += New-Paragraph "（4）健康仪表盘与趋势分析：首页展示今日任务、完成进度、最近记录和最新建议；趋势页按周/月维度展示睡眠、热量摄入与消耗、健康标签分布，并支持健康记录 CSV 导出。" "left" $false "24" 100
$body += New-Paragraph "（5）AI 建议与知识增强：系统根据用户档案、近期记录、健康目标、任务完成情况和本地健康知识库检索结果生成日常健康建议。建议接口采用 SSE 流式返回，提升 AI 文本生成过程中的交互体验。" "left" $false "24" 100
$body += New-Paragraph "（6）任务生成与打卡：AI 建议不直接自动写入任务。用户可手动触发候选任务生成，系统综合用户档案、所有健康记录、所有任务状态、今日已完成和未完成任务生成候选项，并过滤与今日已完成任务相似的内容。用户选择接受后，后端用新任务覆盖或归档当前未完成任务。" "left" $false "24" 100
$body += New-Paragraph "（7）高危内容识别：当用户输入涉及明显病痛、症状、用药、心理危机等超出日常健康管理范围的内容时，系统拒绝作为普通健康记录保存，并提示用户及时就医或寻求专业帮助。识别方式以大模型判断为主，正则关键词作为兜底。" "left" $false "24" 120
$body += New-Heading "2.3 非功能需求" 2
$body += New-Paragraph "易用性：用户可以通过自然语言录入健康信息，前端提供解析预览、低置信度提示、风险提示和任务勾选等交互，降低学习成本。" "left" $false "24" 80
$body += New-Paragraph "可靠性：后端通过 Pydantic Schema、字段归一化、用户确认保存、规则兜底和异常回退降低 AI 输出不稳定带来的风险。" "left" $false "24" 80
$body += New-Paragraph "安全性：系统使用 JWT 进行接口鉴权，密码采用 bcrypt 哈希保存，业务数据按当前登录用户隔离，高危内容不进入普通健康记录流程。" "left" $false "24" 80
$body += New-Paragraph "可扩展性：后端采用 routes、schemas、services、repositories、models、core 等分层结构；知识库以 Markdown 维护，便于持续扩展健康主题。" "left" $false "24" 80
$body += New-Paragraph "可维护性：前端按页面、组件、服务封装组织；后端将 AI 解析、建议生成、任务生成、趋势聚合、知识检索等逻辑拆分为独立服务，降低模块耦合。" "left" $false "24" 120
$body += New-Heading "2.4 技术选型" 2
$body += New-Table @(
    @("层级", "实际采用技术", "说明"),
    @("前端", "React 19、Vite、Ant Design Mobile、ECharts、Framer Motion、Axios、React Router", "实现移动端友好界面、路由、接口请求、图表和动画交互。"),
    @("后端", "FastAPI、SQLAlchemy、Pydantic、MySQL、JWT、bcrypt、httpx", "实现 REST API、ORM 模型、请求校验、用户认证、密码加密和外部 LLM 调用。"),
    @("AI", "OpenAI-compatible Chat Completions、Prompt 工程、规则兜底、轻量级 RAG", "支持 AI 解析、建议生成、高危识别和知识增强。"),
    @("知识增强", "Markdown 知识库、KnowledgeService、sentence-transformers、关键词兜底", "根据用户数据检索健康知识并注入 Prompt。"),
    @("测试与联调", "后端服务测试、接口联调、前端页面验证、RAG 对比评估脚本", "覆盖核心服务、风险识别、解析、任务生成和建议生成。")
)
$body += New-Heading "2.5 其他要求" 2
$body += New-Paragraph "本项目最终实现以 Web 应用和后端 API 为主。早期规划中提到的语音输入、图片识别、社交对比、完整自动调度和生产级部署能力未作为本次最终演示的核心功能；报告中的实现内容均以当前代码仓库中的实际前后端实现为准。" "left" $false "24" 120
$body += New-PageBreak

# Chapter 3
$body += New-Heading "第3章 系统设计" 1
$body += New-Heading "3.1 引言" 2
$body += New-Paragraph "系统采用前后端分离架构。前端提供用户操作界面，后端提供统一 API、业务服务、数据持久化和 AI 能力接入。系统核心设计思想是将 AI 能力嵌入健康管理流程，而不是作为独立聊天功能存在。" "left" $false "24" 120
$body += New-Heading "3.2 系统功能设计" 2
$body += New-Paragraph "系统功能可划分为用户与档案、健康记录、AI 与知识增强、任务管理、趋势可视化和个人中心六个模块。用户与档案模块负责认证和基础健康信息；健康记录模块负责自然语言输入、解析预览、确认保存和历史管理；AI 与知识增强模块负责结构化解析、健康建议、高危识别和知识库检索；任务管理模块负责候选任务生成、选择加入、今日任务和历史任务；趋势可视化模块负责仪表盘、周/月趋势和 CSV 导出；个人中心负责展示用户档案、最近记录、建议历史和快捷操作。" "left" $false "24" 120
$body += New-Paragraph "核心业务流程为：用户登录并完善档案后，输入自然语言健康记录；后端进行高危内容识别和 AI 结构化解析；前端展示解析预览，用户确认后落库；趋势服务按日期聚合健康记录；建议服务结合用户数据和知识库上下文生成健康建议；任务生成服务根据全部健康记录、任务状态和今日完成情况生成候选任务；用户选择任务后进入今日任务列表，并通过打卡形成反馈。" "left" $false "24" 120
$body += New-Heading "3.3 系统 UI 设计" 2
$body += New-Paragraph "前端页面包括登录注册页、档案设置页、首页仪表盘、健康记录页、AI 建议页、任务页、趋势页和个人中心页。界面风格以移动端使用为主，采用 Ant Design Mobile 组件和自定义样式，强调信息卡片、按钮反馈、表单输入和图表阅读体验。" "left" $false "24" 120
$body += New-Paragraph "健康记录页是核心交互界面，用户输入原始文本后点击解析，页面展示睡眠、摄入、运动、健康标签、置信度和警告提示。用户可以修改解析结果后提交。AI 建议页通过 SSE 展示流式生成过程，并提供任务候选勾选交互。趋势页使用 ECharts 展示睡眠趋势、热量趋势和标签分布。" "left" $false "24" 120
$body += New-Heading "3.4 系统详细设计" 2
$body += New-Paragraph "前端设计：前端使用 React Router 定义业务路由，主要路径包括 /auth/:mode、/profile-setup、/dashboard、/data-entry、/ai-advice、/tasks、/trends 和 /profile。services/api.js 按 auth、profile、health、advice、task 分组封装后端接口；http.js 统一处理 token 携带和错误响应；useSSEAdvice 负责建议流式接收。" "left" $false "24" 100
$body += New-Paragraph "后端设计：后端入口在 app/main.py，统一挂载 /api 路由。api/router.py 整合 auth、profile、health、advice、task 和 admin jobs 等模块。每个业务模块通过 route 接收请求，调用 service 完成业务逻辑，并通过 repository 和 ORM model 访问数据库。" "left" $false "24" 100
$body += New-Paragraph "AI 解析设计：HealthAIParseService 在 LLM 模式下调用大模型，Prompt 中明确给出 t_health_record 的落库字段和 JSON 输出格式，并在知识增强开启时检索相关健康知识注入 system prompt。LLM 失败或未配置时，系统使用规则解析服务兜底。解析结果包含 shouldSave、confidence、confidenceScore、warnings、failureReason、suggestions 和 previewData。" "left" $false "24" 100
$body += New-Paragraph "高危识别设计：RiskWordService 采用大模型优先、规则兜底的方式识别风险输入。对于胸痛、呼吸困难、明显病痛、疾病、用药、心理危机等内容，接口返回风险提示并拒绝保存普通健康记录。" "left" $false "24" 100
$body += New-Paragraph "知识增强设计：KnowledgeService 加载 backend/app/data/knowledge 下的 Markdown 文件，按二级标题切分为知识块。检索优先使用 sentence-transformers 生成 embedding 并计算余弦相似度，依赖不可用时回退到关键词匹配。AdviceService 根据健康目标、健康标签、近期记录和总结构造 query，HealthAIParseService 根据原始输入提取关键词，两者均可获得 knowledge_context 注入 Prompt。" "left" $false "24" 100
$body += New-Paragraph "任务生成设计：TaskGenerationService 构建包含用户档案、全部健康记录、全部任务及状态、今日已完成任务、今日未完成任务、最新建议和最新总结的上下文。生成候选任务时，系统过滤与今日已完成任务相似的候选项；若候选项与未完成任务相似，则倾向生成优化版本而不是新增重复任务。用户选择后通过 add-selected 接口写入任务。" "left" $false "24" 120
$body += New-Heading "3.5 数据库设计（若用到数据库）" 2
$body += New-Paragraph "系统使用 MySQL 存储结构化业务数据，SQLAlchemy ORM 模型集中在 backend/app/models 目录。主要数据表如下：" "left" $false "24" 100
$body += New-Table @(
    @("表名", "主要字段", "作用"),
    @("t_user", "user_id、username、password_hash、gender、height、weight、health_goal、injury_history、allergy_history", "保存用户账号和健康档案。"),
    @("t_health_record", "record_id、user_id、record_date、recorded_at、raw_input、sleep_minutes、estimated_intake_kcal、estimated_burn_kcal、nutrition_details、exercise_details、health_tags、confidence、parse_warnings", "保存用户多次健康记录和 AI 解析结果。"),
    @("t_daily_task", "task_id、user_id、task_date、task_content、status、ai_reason", "保存每日任务、完成状态和 AI 原因。"),
    @("t_advice_history", "advice_id、user_id、advice_text、created_at", "保存用户历史 AI 建议。"),
    @("t_health_summary", "summary_id、user_id、summary_date、summary_content、health_trend", "保存周期健康总结和趋势信息。")
)
$body += New-Paragraph "健康记录表取消了 user_id + record_date 的唯一覆盖逻辑，改为允许同一天多条记录。这样可以更真实地表达用户一天内多次记录饮食、运动和睡眠的使用习惯，并为趋势聚合和建议生成提供更完整的数据。" "left" $false "24" 120
$body += New-PageBreak

# Chapter 4
$body += New-Heading "第4章 系统实现" 1
$body += New-Heading "4.1 引言" 2
$body += New-Paragraph "项目最终实现了可运行的前后端分离系统。前端位于 frontend 目录，后端位于 backend 目录。后端提供 /api 前缀的 REST API 和 SSE 流式建议接口；前端通过 Axios 和 EventSource 调用后端服务，实现从用户输入到 AI 建议和任务打卡的完整流程。" "left" $false "24" 120
$body += New-Paragraph "后端核心接口包括 /api/auth/register、/api/auth/login、/api/profile、/api/health/record/parse-ai、/api/health/record/confirm、/api/health/dashboard、/api/health/trends、/api/health/record/recent、/api/health/record/history、/api/health/record/{record_id}、/api/advice/stream、/api/advice/history、/api/task/today、/api/task/history、/api/task/check、/api/task/generate-preview 和 /api/task/add-selected。" "left" $false "24" 120
$body += New-Heading "4.2 系统典型界面" 2
$body += New-Paragraph "登录注册界面：用户通过账号密码注册或登录，系统登录成功后保存 token，并根据档案是否完整决定进入档案设置页或首页。" "left" $false "24" 80
$body += New-Paragraph "档案设置界面：用户填写性别、身高、体重、健康目标、伤病史和过敏史。伤病史与过敏史作为独立字段传递给后端，便于后续建议生成使用。" "left" $false "24" 80
$body += New-Paragraph "健康记录界面：用户输入自然语言健康记录，前端先进行本地风险预检查，再调用后端 AI 解析接口。解析成功后，页面展示睡眠、摄入、运动、标签、解析说明、置信度分数和警告信息，用户确认后保存。若识别到高危内容或无有效信息，页面会展示失败原因和优化输入建议。" "left" $false "24" 80
$body += New-Paragraph "首页仪表盘：展示任务完成进度、今日任务、最近记录、最新建议和趋势摘要，帮助用户快速了解当天健康管理状态。" "left" $false "24" 80
$body += New-Paragraph "AI 建议界面：前端通过 SSE 接收建议内容并逐步展示。用户可以在该页面手动生成任务候选，勾选后加入今日任务列表。" "left" $false "24" 80
$body += New-Paragraph "任务界面：展示今日任务和历史任务，支持完成状态切换。任务状态变化会反馈到后端，用于后续任务生成和完成率计算。" "left" $false "24" 80
$body += New-Paragraph "趋势界面：使用 ECharts 展示周/月维度健康趋势，包括睡眠、热量摄入、热量消耗和健康标签分布，并支持导出 CSV 数据。" "left" $false "24" 120
$body += New-Heading "4.3 测试计划" 2
$body += New-Paragraph "测试目标是验证系统主流程可用性、接口稳定性、AI 解析与高危识别逻辑、任务生成规则和前后端联调效果。测试采用服务层测试、接口联调、页面功能验证和 RAG 对比评估相结合的方式。" "left" $false "24" 120
$body += New-Table @(
    @("测试类别", "测试内容", "预期结果"),
    @("认证与档案", "注册、登录、token 携带、档案保存和更新", "用户可正常进入系统，档案字段正确返回。"),
    @("健康记录", "自然语言解析、低置信度提示、用户确认保存、多条记录新增、历史查询和删除", "结构化字段正确，低质量输入不保存，多次记录不覆盖。"),
    @("风险识别", "输入胸痛、呼吸困难、病痛、用药等内容", "系统拒绝普通保存并提示及时就医。"),
    @("AI 建议", "SSE 建议流、建议历史保存、知识增强上下文", "前端可流式展示建议，后端保存历史。"),
    @("任务生成", "生成候选任务、过滤今日已完成相似任务、用户选择加入", "候选任务可控写入，不重复生成已完成内容。"),
    @("趋势可视化", "仪表盘、周/月趋势、CSV 导出", "聚合结果合理，图表和导出可用。"),
    @("RAG 评估", "No RAG 与 RAG 建议对比脚本", "能输出检索片段数、知识命中和建议文本。")
)
$body += New-Heading "4.4 测试报告" 2
$body += New-Paragraph "项目在后端 tests/test_services.py 中保留了风险识别、规则解析、AI 解析兜底、知识检索、建议上下文和任务去重等服务层测试。RAG 部分提供 compare_rag_advice.py 和 evaluate_rag_advice.py，用于对比知识增强前后的建议差异，并将结果写入 rag_evaluation_results.json。" "left" $false "24" 120
$body += New-Paragraph "前后端联调过程中，针对用户输入解析效果、伤病史与过敏史字段拆分、任务生成不自动写入、同日多次健康记录、健康记录历史删除、高危内容识别等问题进行了多轮修正。最终系统能够支持完整演示流程：注册/登录、档案维护、自然语言记录、AI 解析确认、首页查看、趋势分析、AI 建议、候选任务选择和任务打卡。" "left" $false "24" 120
$body += New-Paragraph "由于本项目为课程实践原型，生产级能力如正式数据库迁移、完整自动化端到端测试、线上监控和部署流水线仍可在后续阶段继续增强。本报告中的测试结论主要面向课程项目的功能可用性和核心逻辑正确性。" "left" $false "24" 120
$body += New-PageBreak

# Chapter 5
$body += New-Heading "第5章 总结" 1
$body += New-Paragraph "HealthMate 健康伴侣完成了一个面向日常健康管理的 AI 辅助系统原型。系统实现了用户档案、健康记录、AI 解析、风险识别、趋势分析、知识增强建议、候选任务生成和任务打卡等主流程，能够支撑从数据记录到行动反馈的完整闭环。" "left" $false "24" 120
$body += New-Paragraph "项目的主要工程价值在于：第一，通过自然语言输入和 AI 结构化解析降低健康记录门槛；第二，通过用户确认保存、置信度提示和高危内容拦截提高数据可靠性和安全边界；第三，通过轻量级 RAG 将本地健康知识库融入 AI Prompt，使建议更具依据和场景贴合度；第四，通过任务候选和打卡机制将文本建议转化为可执行行动。" "left" $false "24" 120
$body += New-Paragraph "从团队贡献看，周炜主要负责后端架构、数据库模型、核心 API、AI 解析、高危识别、任务生成、趋势聚合和联调文档，保障了系统业务能力和数据流转的完整性。黎宇恒主要负责前端界面、交互体验、图表展示、SSE 流式建议、接口对接与页面优化，并参与知识增强能力建设，保障了系统可用性和演示效果。两名成员在测试、联调、问题修复和最终答辩材料整理中共同协作。" "left" $false "24" 120
$body += New-Paragraph "通过本次课程实践，团队完成了从选题、需求分析、系统设计、编码实现、前后端联调、测试验证到报告整理的完整软件工程流程。项目虽然仍有进一步产品化空间，但已经形成了一个功能闭环清晰、技术路线完整、可运行可演示的健康管理系统。" "left" $false "24" 120

$sectPr = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="851" w:footer="992" w:gutter="0"/><w:cols w:space="425"/><w:docGrid w:type="lines" w:linePitch="312"/></w:sectPr>'

$documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" xmlns:cx1="http://schemas.microsoft.com/office/drawing/2015/9/8/chartex" xmlns:cx2="http://schemas.microsoft.com/office/drawing/2015/10/21/chartex" xmlns:cx3="http://schemas.microsoft.com/office/drawing/2016/5/9/chartex" xmlns:cx4="http://schemas.microsoft.com/office/drawing/2016/5/10/chartex" xmlns:cx5="http://schemas.microsoft.com/office/drawing/2016/5/11/chartex" xmlns:cx6="http://schemas.microsoft.com/office/drawing/2016/5/12/chartex" xmlns:cx7="http://schemas.microsoft.com/office/drawing/2016/5/13/chartex" xmlns:cx8="http://schemas.microsoft.com/office/drawing/2016/5/14/chartex" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:aink="http://schemas.microsoft.com/office/drawing/2016/ink" xmlns:am3d="http://schemas.microsoft.com/office/drawing/2017/model3d" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:oel="http://schemas.microsoft.com/office/2019/extlst" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex" xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid" xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml" xmlns:w16du="http://schemas.microsoft.com/office/word/2023/wordml/word16du" xmlns:w16sdtdh="http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash" xmlns:w16sdtfl="http://schemas.microsoft.com/office/word/2024/wordml/sdtformatlock" xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 w15 w16se w16cid w16 w16cex w16sdtdh w16du w16sdtfl wp14">
<w:body>
$body
$sectPr
</w:body>
</w:document>
"@

$zip = [System.IO.Compression.ZipFile]::Open((Resolve-Path $output), [System.IO.Compression.ZipArchiveMode]::Update)
$old = $zip.GetEntry("word/document.xml")
if ($old) { $old.Delete() }
$new = $zip.CreateEntry("word/document.xml")
$stream = $new.Open()
$writer = New-Object System.IO.StreamWriter($stream, (New-Object System.Text.UTF8Encoding($false)))
$writer.Write($documentXml)
$writer.Dispose()
$stream.Dispose()
$zip.Dispose()

Write-Host "Generated $output"



