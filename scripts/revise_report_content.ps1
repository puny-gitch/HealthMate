$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$source = "HealthMate_计算机综合项目实践实验报告.docx"
$output = "HealthMate_计算机综合项目实践实验报告_内容修订版.docx"
$wNs = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

function Open-DocXml([string]$path) {
    $fs = [System.IO.File]::Open((Resolve-Path $path), [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Read)
    $entry = $zip.GetEntry("word/document.xml")
    $reader = New-Object System.IO.StreamReader($entry.Open())
    [xml]$xml = $reader.ReadToEnd()
    $reader.Close()
    $zip.Dispose()
    $fs.Dispose()
    return ,$xml
}

function New-NsManager($xml) {
    $ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
    $ns.AddNamespace("w", $wNs)
    return ,$ns
}

function Get-ParaText($p, $ns) {
    return (($p.SelectNodes(".//w:t", $ns) | ForEach-Object { $_.InnerText }) -join "")
}

function Set-ParaText($xml, $p, $ns, [string]$text) {
    $pPr = $p.SelectSingleNode("./w:pPr", $ns)
    $clonePPr = $null
    if ($pPr) { $clonePPr = $pPr.CloneNode($true) }

    $firstRPr = $p.SelectSingleNode(".//w:rPr", $ns)
    $cloneRPr = $null
    if ($firstRPr) { $cloneRPr = $firstRPr.CloneNode($true) }

    while ($p.HasChildNodes) { [void]$p.RemoveChild($p.FirstChild) }
    if ($clonePPr) { [void]$p.AppendChild($clonePPr) }

    $r = $xml.CreateElement("w", "r", $wNs)
    if ($cloneRPr) { [void]$r.AppendChild($cloneRPr) }
    $t = $xml.CreateElement("w", "t", $wNs)
    $spaceAttr = $xml.CreateAttribute("xml", "space", "http://www.w3.org/XML/1998/namespace")
    $spaceAttr.Value = "preserve"
    [void]$t.Attributes.Append($spaceAttr)
    $t.InnerText = $text
    [void]$r.AppendChild($t)
    [void]$p.AppendChild($r)
}

function New-ParagraphLike($xml, $refP, $ns, [string]$text) {
    $newP = $xml.CreateElement("w", "p", $wNs)
    $pPr = $refP.SelectSingleNode("./w:pPr", $ns)
    if ($pPr) { [void]$newP.AppendChild($pPr.CloneNode($true)) }

    $firstRPr = $refP.SelectSingleNode(".//w:rPr", $ns)
    $r = $xml.CreateElement("w", "r", $wNs)
    if ($firstRPr) { [void]$r.AppendChild($firstRPr.CloneNode($true)) }
    $t = $xml.CreateElement("w", "t", $wNs)
    $spaceAttr = $xml.CreateAttribute("xml", "space", "http://www.w3.org/XML/1998/namespace")
    $spaceAttr.Value = "preserve"
    [void]$t.Attributes.Append($spaceAttr)
    $t.InnerText = $text
    [void]$r.AppendChild($t)
    [void]$newP.AppendChild($r)
    return $newP
}

function Insert-AfterAnchor($xml, $ns, [string]$anchor, [string[]]$texts) {
    $paras = $xml.SelectNodes("//w:body/w:p", $ns)
    $target = $null
    foreach ($p in $paras) {
        if ((Get-ParaText $p $ns).Contains($anchor)) {
            $target = $p
            break
        }
    }
    if (-not $target) { throw "Anchor not found: $anchor" }
    $parent = $target.ParentNode
    $insertAfter = $target
    foreach ($text in $texts) {
        $newP = New-ParagraphLike $xml $target $ns $text
        if ($insertAfter.NextSibling) {
            [void]$parent.InsertBefore($newP, $insertAfter.NextSibling)
        } else {
            [void]$parent.AppendChild($newP)
        }
        $insertAfter = $newP
    }
}

function Replace-ParagraphContaining($xml, $ns, [string]$anchor, [string]$text) {
    $paras = $xml.SelectNodes("//w:body/w:p", $ns)
    foreach ($p in $paras) {
        if ((Get-ParaText $p $ns).Contains($anchor)) {
            Set-ParaText $xml $p $ns $text
            return
        }
    }
    throw "Replace anchor not found: $anchor"
}

$xml = Open-DocXml $source
$ns = New-NsManager $xml

Replace-ParagraphContaining $xml $ns "本报告依据项目最终代码实现撰写" "本报告围绕 HealthMate 的需求分析、系统设计、功能实现、测试验证与团队协作过程展开，说明项目从选题构想到可运行系统的完整实践过程。"

Replace-ParagraphContaining $xml $ns "本项目为课程实践原型" "测试结果表明，系统主流程能够稳定完成注册登录、档案维护、健康记录解析确认、趋势展示、AI 建议生成、候选任务选择与任务打卡等操作；核心服务测试覆盖了风险识别、规则解析、知识检索、建议上下文构造和任务相似度过滤等关键逻辑。"

Replace-ParagraphContaining $xml $ns "项目虽然仍有进一步产品化空间" "通过本次课程实践，团队完成了从选题、需求分析、系统设计、编码实现、前后端联调、测试验证到报告整理的完整软件工程流程。项目形成了功能闭环清晰、技术路线完整、可运行可演示的健康管理系统，较好地体现了课程对综合实践能力和工程协作能力的要求。"

Insert-AfterAnchor $xml $ns "将健康建议转化为用户可执行、可反馈的日常任务。" @(
    "选题背景方面，随着学习和工作节奏加快，睡眠不足、久坐、饮食不规律、运动缺乏等问题在青年学生和职场人群中较为常见。此类问题通常不属于即时医疗诊断范畴，却需要长期记录、持续提醒和行为干预。健康管理工具如果只停留在一次性记录或静态图表展示层面，很难帮助用户形成稳定习惯。",
    "选题意义方面，HealthMate 结合大语言模型、结构化数据存储和可视化分析，将自然语言输入转化为可追踪的健康数据，并通过建议和任务机制推动用户采取行动。该选题既契合人工智能在个人健康管理领域的应用趋势，也符合课程对前后端分离、数据库设计、AI 服务集成和团队协作实践的综合要求。"
)

Insert-AfterAnchor $xml $ns "两名成员共同参与测试、联调和最终答辩资料整理。具体分工如下。" @(
    "项目协作过程中，团队以短周期迭代推进功能建设。前期重点完成选题、需求分析、接口约定和前后端脚手架搭建；中期集中实现用户认证、档案、健康记录、AI 建议和任务打卡等核心模块；后期围绕联调反馈补充高危内容识别、每日多次记录、历史记录删除、任务生成预览和知识增强能力。Git 提交历史能够较清晰地反映两名成员在前端、后端和联调优化方面的贡献。"
)

Insert-AfterAnchor $xml $ns "系统必须避免医疗诊断式输出，并对高危输入进行提醒。" @(
    "需求分析中将用户分为三类典型角色：第一类是希望改善作息和饮食的普通用户，关注记录便捷性和趋势反馈；第二类是健身或减脂初学者，关注运动、饮食和任务建议；第三类是需要持续提醒的轻度亚健康用户，关注系统是否能根据历史记录给出稳定、可执行的行动建议。",
    "从用户故事角度看，用户希望能够用一句话记录今天的饮食、运动或睡眠情况；希望系统自动提取关键指标，避免反复填写表单；希望在数据不足或表达不清时获得明确补充建议；希望系统给出的任务不要重复、不要过难，并能根据当天完成情况持续调整。"
)

Insert-AfterAnchor $xml $ns "识别方式以大模型判断为主，正则关键词作为兜底。" @(
    "整体功能需求可概括为三条主线：一是数据采集主线，即从自然语言输入到结构化健康记录；二是分析反馈主线，即从历史记录到趋势、建议和总结；三是行动干预主线，即从 AI 建议到候选任务、用户选择和打卡反馈。三条主线共同支撑系统的健康管理闭环。"
)

Insert-AfterAnchor $xml $ns "降低模块耦合。" @(
    "数据质量也是系统的重要非功能需求。健康记录只有在识别出明确睡眠、饮食、运动、热量或标签等有效信息后才适合保存；当解析置信度较低时，系统通过警告、失败原因和输入优化建议引导用户补充信息，从源头减少低质量数据对趋势分析和建议生成的影响。"
)

Insert-AfterAnchor $xml $ns "而不是作为独立聊天功能存在。" @(
    "总体架构可以理解为表现层、业务服务层、数据与智能层三部分。表现层由 React 页面和组件组成，负责用户输入、预览确认、图表展示和任务交互；业务服务层由 FastAPI 路由、Service 和 Repository 组成，负责认证、记录、建议、任务和趋势等业务；数据与智能层由 MySQL、本地健康知识库和大模型接口组成，负责持久化存储、知识检索和 AI 生成。"
)

Insert-AfterAnchor $xml $ns "并通过打卡形成反馈。" @(
    "在功能模块关系上，用户档案是个性化建议的基础，健康记录是趋势分析和 AI 建议的数据来源，知识增强模块为 AI 输出提供场景依据，任务模块将建议转化为行动项，趋势模块再把用户行为反馈为可视化结果。各模块之间不是孤立页面，而是围绕用户健康数据持续流动。"
)

Insert-AfterAnchor $xml $ns "趋势页使用 ECharts 展示睡眠趋势、热量趋势和标签分布。" @(
    "UI 设计遵循移动端优先和低认知负担原则。首页强调概览和快捷入口，健康记录页强调输入、解析、确认三个步骤，AI 建议页强调流式反馈和任务选择，趋势页强调图表对比和周期切换。页面文案尽量采用用户能直接理解的健康管理语言，避免暴露底层技术细节。"
)

Insert-AfterAnchor $xml $ns "解析结果包含 shouldSave、confidence、confidenceScore、warnings、failureReason、suggestions 和 previewData。" @(
    "置信度展示由后端解析服务统一提供。LLM 模式下，模型按约定返回 confidence 和 confidenceScore；若模型未返回有效分数，后端会根据识别出的核心字段数量进行估算。规则兜底模式下，系统统计睡眠、摄入、消耗等核心字段的识别数量，将其映射为 low、medium 或 high。前端据此展示置信度，并在低置信度或存在 warnings 时提示用户检查。"
)

Insert-AfterAnchor $xml $ns "两者均可获得 knowledge_context 注入 Prompt。" @(
    "知识库内容以日常健康管理为边界，覆盖睡眠、营养、运动、体重管理、健康风险、慢病生活方式边界、心理压力和健康记录规范等主题。RAG 在系统中不直接替代业务判断，而是作为上下文增强手段，帮助模型在解析和建议时参考项目维护的知识片段，从而减少空泛回答。"
)

Insert-AfterAnchor $xml $ns "用户选择后通过 add-selected 接口写入任务。" @(
    "趋势聚合服务按日期对健康记录进行分桶处理。摄入热量和运动消耗适合按天求和，健康标签适合合并统计，睡眠数据则用于计算日维度和周期维度的睡眠情况。这样既保留用户一天多次记录的细节，又能在首页和趋势页形成易读的汇总结果。"
)

Insert-AfterAnchor $xml $ns "并为趋势聚合和建议生成提供更完整的数据。" @(
    "从数据关系看，用户表是系统的核心实体，健康记录、每日任务、建议历史和健康总结均通过 user_id 与用户关联。健康记录为建议和趋势提供事实数据，每日任务记录用户行动反馈，建议历史保留 AI 输出轨迹，健康总结为后续建议提供周期性背景。"
)

Insert-AfterAnchor $xml $ns "实现从用户输入到 AI 建议和任务打卡的完整流程。" @(
    "后端实现中，认证模块负责注册登录和当前用户解析；档案模块负责健康目标、伤病史和过敏史维护；健康模块负责解析、保存、聚合、导出和记录管理；建议模块负责 SSE 流式输出和历史保存；任务模块负责候选生成、选择加入、今日任务和历史任务；知识模块负责本地知识库检索和上下文渲染。"
)

Insert-AfterAnchor $xml $ns "并支持导出 CSV 数据。" @(
    "个人中心界面汇总展示用户基本档案、伤病史、过敏史、最近记录和最近建议，并提供常用功能入口。该页面承担用户信息回看和系统状态概览的作用，使用户能够确认当前健康目标和基础资料是否与建议生成一致。"
)

Insert-AfterAnchor $xml $ns "页面会展示失败原因和优化输入建议。" @(
    "解析失败场景同样进行了交互设计。例如用户只输入「今天还行」一类缺少明确健康事件的信息时，后端返回不可保存状态，前端提示补充睡眠时长、饮食内容、运动类型或时间等具体信息。这样可以避免无意义文本进入健康记录表。"
)

Insert-AfterAnchor $xml $ns "测试采用服务层测试、接口联调、页面功能验证和 RAG 对比评估相结合的方式。" @(
    "测试环境主要包括本地 Windows 开发环境、MySQL 数据库、FastAPI 后端服务和 Vite 前端服务。测试数据围绕常见健康管理场景构造，包括睡眠不足、饮食记录、跑步或快走、奶茶夜宵、高危病痛输入、低质量输入、任务重复生成和任务完成状态切换等。"
)

Insert-AfterAnchor $xml $ns "候选任务选择和任务打卡。" @(
    "联调验证中重点关注接口契约和前端展示的一致性。例如 profile 接口将伤病史和过敏史拆分下发，健康记录确认接口保证新增而非覆盖，建议接口只生成建议而不自动写入任务，任务生成接口只返回候选项并等待用户选择。这些调整使系统流程更符合真实用户使用习惯。"
)

$outXml = $xml.OuterXml

$srcFs = [System.IO.File]::Open((Resolve-Path $source), [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
$srcZip = New-Object System.IO.Compression.ZipArchive($srcFs, [System.IO.Compression.ZipArchiveMode]::Read)
if (Test-Path $output) { Remove-Item -LiteralPath $output -Force }
$outFs = [System.IO.File]::Open((Resolve-Path ".").Path + "\" + $output, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
$outZip = New-Object System.IO.Compression.ZipArchive($outFs, [System.IO.Compression.ZipArchiveMode]::Create)

foreach ($entry in $srcZip.Entries) {
    $newEntry = $outZip.CreateEntry($entry.FullName)
    $inStream = $entry.Open()
    $outStream = $newEntry.Open()
    if ($entry.FullName -eq "word/document.xml") {
        $writer = New-Object System.IO.StreamWriter($outStream, (New-Object System.Text.UTF8Encoding($false)))
        $writer.Write($outXml)
        $writer.Dispose()
    } else {
        $inStream.CopyTo($outStream)
    }
    $outStream.Dispose()
    $inStream.Dispose()
}

$outZip.Dispose()
$outFs.Dispose()
$srcZip.Dispose()
$srcFs.Dispose()

Write-Host "Generated $output"


