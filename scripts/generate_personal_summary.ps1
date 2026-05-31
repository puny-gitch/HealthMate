$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$source = "docs\计算机综合项目实践实验报告模板.docx"
$output = "周炜_个人综合项目实践总结.docx"
$wNs = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

function Escape-Xml([string]$text) {
    return [System.Security.SecurityElement]::Escape($text)
}

function New-RunXml([string]$text, [bool]$bold = $false, [int]$fontSizeHalfPt = 24) {
    $boldXml = ""
    if ($bold) { $boldXml = "<w:b/>" }
    $escaped = Escape-Xml $text
    return @"
<w:r>
  <w:rPr>
    <w:rFonts w:ascii="Times New Roman" w:eastAsia="宋体" w:hAnsi="Times New Roman"/>
    $boldXml
    <w:sz w:val="$fontSizeHalfPt"/>
    <w:szCs w:val="$fontSizeHalfPt"/>
  </w:rPr>
  <w:t xml:space="preserve">$escaped</w:t>
</w:r>
"@
}

function New-ParagraphXml([string]$text, [string]$kind = "body") {
    switch ($kind) {
        "title" {
            $run = New-RunXml $text $true 36
            return @"
<w:p>
  <w:pPr>
    <w:jc w:val="center"/>
    <w:spacing w:before="240" w:after="240" w:line="360" w:lineRule="auto"/>
  </w:pPr>
  $run
</w:p>
"@
        }
        "meta" {
            $run = New-RunXml $text $false 24
            return @"
<w:p>
  <w:pPr>
    <w:jc w:val="center"/>
    <w:spacing w:after="80" w:line="300" w:lineRule="auto"/>
  </w:pPr>
  $run
</w:p>
"@
        }
        "heading" {
            $run = New-RunXml $text $true 28
            return @"
<w:p>
  <w:pPr>
    <w:spacing w:before="220" w:after="120" w:line="360" w:lineRule="auto"/>
    <w:outlineLvl w:val="0"/>
  </w:pPr>
  $run
</w:p>
"@
        }
        default {
            $run = New-RunXml $text $false 24
            return @"
<w:p>
  <w:pPr>
    <w:ind w:firstLineChars="200" w:firstLine="480"/>
    <w:spacing w:after="80" w:line="360" w:lineRule="auto"/>
    <w:jc w:val="both"/>
  </w:pPr>
  $run
</w:p>
"@
        }
    }
}

$paragraphs = @(
    @{ kind = "title"; text = "个人综合项目实践总结" },
    @{ kind = "meta"; text = "项目名称：HealthMate 健康伴侣" },
    @{ kind = "meta"; text = "姓名：周炜" },
    @{ kind = "meta"; text = "课程：计算机综合项目实践" },

    @{ kind = "heading"; text = "一、本人在本综合项目实践中承担的工作" },
    @{ kind = "body"; text = "在 HealthMate 健康伴侣项目中，我主要承担后端开发、数据库设计、AI 能力接入、接口联调和部分项目文档整理工作。项目采用前后端分离架构，前端负责移动端页面展示和交互，我主要负责后端服务层、业务逻辑层和数据持久层的设计与实现，并与前端同学共同完成接口约定、联调测试和功能收口。" },
    @{ kind = "body"; text = "需求与设计阶段，我参与了项目选题、需求分析和系统设计工作，梳理了用户健康档案、健康记录、AI 建议、每日任务、趋势分析等核心业务流程，并根据课程实践要求将系统拆分为认证、档案、健康记录、建议、任务、趋势和知识增强等模块。后续编码阶段，我重点负责将这些业务流程落到后端接口、数据库模型和服务类实现中。" },
    @{ kind = "body"; text = "后端框架方面，我搭建并维护了 FastAPI 项目结构，按照 routes、schemas、models、repositories、services 等层次组织代码，完成统一响应、异常处理、JWT 鉴权、密码加密、数据库会话管理和基础启动配置。该结构使接口层、业务层和数据访问层职责相对清晰，也方便后续根据联调问题进行局部调整。" },
    @{ kind = "body"; text = "数据库方面，我负责设计和调整用户表、健康记录表、每日任务表、AI 建议历史表、健康总结表等核心表结构。随着项目从演示闭环逐步走向更真实的使用流程，我对健康记录表进行了多次优化，使其支持同一天多次新增记录、保存原始输入、结构化解析结果、置信度、风险提示和解析警告，并为历史查询、删除和趋势聚合提供数据基础。" },
    @{ kind = "body"; text = "AI 相关部分是我承担的重要工作之一。我实现了健康记录的自然语言解析流程，将用户输入解析为适合落库的结构化字段；实现了高危内容识别机制，对涉及病痛、症状、疾病、用药或心理危机等超出日常健康管理范围的内容进行拦截；实现了 AI 建议生成接口和任务生成预览接口，使系统能够根据用户档案、健康记录和任务完成情况给出个性化建议与候选任务。" },
    @{ kind = "body"; text = "联调阶段，我根据前端实际接入反馈持续调整接口行为，包括 profile 接口拆分伤病史和过敏史字段、健康记录由覆盖改为新增、建议生成与任务生成解耦、任务由用户选择后再写入、历史健康记录支持查询和删除等。同时，我编写了后端联调说明和验证文档，帮助前端明确接口字段、返回结构和异常处理方式。" },

    @{ kind = "heading"; text = "二、本人的实践完成情况" },
    @{ kind = "body"; text = "从最终完成情况看，我负责的后端主流程已经形成较完整闭环。用户可以完成注册登录、维护个人健康档案、输入自然语言健康记录、查看解析预览、确认保存记录、查看首页汇总和趋势图、获取 AI 健康建议、生成候选健康任务、选择任务加入并进行打卡。后端接口能够为前端页面提供较稳定的数据支持。" },
    @{ kind = "body"; text = "用户认证模块已实现注册、登录、当前用户识别和 JWT 鉴权。密码使用哈希方式保存，接口通过依赖注入获取当前登录用户，避免不同用户之间的数据混用。档案模块已支持性别、身高、体重、健康目标、伤病史和过敏史等字段，为后续个性化建议提供基础信息。" },
    @{ kind = "body"; text = "健康记录模块已实现 AI 解析预览、用户确认保存、手动保存、近期记录、历史记录、记录删除、首页汇总、趋势聚合和 CSV 导出等能力。系统不再简单地按日期覆盖记录，而是允许用户一天内多次记录饮食、运动、睡眠等信息，再由后端按日期进行聚合统计，使数据更符合真实使用场景。" },
    @{ kind = "body"; text = "AI 解析流程已从早期规则解析扩展为大模型优先、规则兜底的方式。解析结果包含是否保存、置信度、置信度分数、警告信息、失败原因、优化建议和结构化预览数据。对于可信度较低或缺少有效健康信息的输入，后端会返回不可保存状态，前端据此提示用户补充更明确的内容，从而减少低质量数据进入数据库。" },
    @{ kind = "body"; text = "高危识别流程已实现大模型判断和正则兜底。系统将普通健康管理与医疗诊断边界区分开来，当用户输入明显涉及病痛、疾病症状、用药、急症或心理危机时，后端拒绝将其作为普通健康记录保存，并返回就医提醒。这样既保护了系统数据质量，也降低了 AI 健康建议越界的风险。" },
    @{ kind = "body"; text = "AI 建议和任务模块也完成了流程调整。建议接口通过 SSE 形式向前端输出内容，并保存建议历史；任务生成接口不再自动写入数据库，而是先基于用户档案、全部健康记录、已有任务和完成状态生成候选任务，过滤与当天已完成任务相似的内容。用户选择接受后，系统再用所选任务覆盖当前未完成任务，使任务生成更可控。" },
    @{ kind = "body"; text = "测试方面，我对后端服务层和关键接口进行了自测与联调验证，重点覆盖认证、档案、健康记录解析、高危拦截、任务相似度过滤、建议生成、历史记录删除和趋势聚合等路径。项目中还保留了 Swagger 验证流程、后端启动说明和前端适配说明，便于课程演示和后续维护。" },

    @{ kind = "heading"; text = "三、遇到的问题及解决方法" },
    @{ kind = "body"; text = "第一个问题是自然语言健康记录难以稳定解析。用户输入往往比较口语化，例如一句话中同时包含饮食、运动和睡眠信息，也可能缺少数量、时间或单位。最初仅依靠规则解析时，容易出现字段遗漏或误判。解决方法是引入面向落库字段的结构化解析流程，在 AI 解析时明确要求输出与数据库字段对应的数据，并在后端使用 schema 校验和规则兜底，保证最终进入数据库的数据格式可控。" },
    @{ kind = "body"; text = "第二个问题是健康管理与医疗诊断边界容易混淆。用户可能输入头痛、胸闷、发烧、服药等内容，如果系统直接保存并生成日常建议，可能产生不恰当引导。对此，我将风险识别前置到解析流程中，由大模型先判断内容是否超出日常健康记录范围，再使用正则关键词作为兜底。命中高危内容后，系统拒绝保存记录，并提示用户及时就医或寻求专业帮助。" },
    @{ kind = "body"; text = "第三个问题是任务生成最初过于自动化。早期流程中，AI 建议可能直接生成并写入任务，用户缺少确认环节，也容易产生重复任务。解决方法是将建议生成和任务生成拆分，新增候选任务预览接口；后端生成任务时综合用户全部历史信息和当前任务状态，过滤与今日已完成任务相似的任务，最后由用户选择是否加入。这样既保留 AI 的辅助作用，又把最终控制权交还给用户。" },
    @{ kind = "body"; text = "第四个问题是数据模型需要贴近真实使用习惯。最初健康记录按用户和日期唯一，导致同一天多次记录会覆盖旧数据，不符合用户随时记录饮食、运动和睡眠的实际场景。解决方法是调整记录表结构，保留 record_date 和 recorded_at，删除按天唯一约束，改为支持多条记录，并在趋势和首页模块中按天聚合。后续又补充了历史记录查询和删除能力，方便用户清理误输入或过时记录。" },
    @{ kind = "body"; text = "第五个问题是前后端字段和流程在联调中不断变化。例如前端需要单独展示伤病史和过敏史，任务页需要区分候选任务和已保存任务，健康记录页需要展示失败原因和输入建议。解决方法是及时编写接口适配文档，统一字段命名和返回结构，并在后端保留必要的兼容字段，减少前端改动成本。" },
    @{ kind = "body"; text = "第六个问题是 AI 输出存在不确定性。大模型可能返回非标准 JSON、字段缺失或解释性文本过多，影响后端处理。对此，我在服务层中增加了 JSON 提取、字段校验、默认值补全、置信度估算和 mock 模式兜底，使系统在真实模型不可用或输出异常时仍能维持基本流程，增强了课程演示时的稳定性。" },

    @{ kind = "heading"; text = "四、总结与展望" },
    @{ kind = "body"; text = "通过本次综合项目实践，我对从需求分析到系统实现的完整工程流程有了更具体的认识。与单门课程中的独立实验不同，本项目需要同时考虑用户需求、接口契约、数据库模型、前端展示、AI 能力边界、异常处理和测试验证。很多问题并不是单纯写出某个函数就能解决，而是需要在产品流程、数据结构和工程稳定性之间做权衡。" },
    @{ kind = "body"; text = "在技术能力方面，我进一步熟悉了 FastAPI、SQLAlchemy、Pydantic、JWT 鉴权、SSE 流式接口和分层后端架构，也对 AI 服务集成有了更深入的理解。尤其是在健康记录解析和任务生成部分，我体会到 AI 应用不能只追求生成效果，还必须结合业务字段、数据库约束、风险控制和用户确认流程，才能形成可落地的系统功能。" },
    @{ kind = "body"; text = "在协作能力方面，本项目让我更直观地认识到接口文档和联调反馈的重要性。前端和后端即使对功能目标理解一致，也可能在字段名、状态含义、异常返回和页面流程上产生偏差。通过不断补充适配说明、调整接口设计和共同验证主流程，团队逐步把文档中的设想落实为可以演示的系统。" },
    @{ kind = "body"; text = "展望后续，如果继续完善 HealthMate，我认为可以从三个方向推进。第一是增强长期数据分析能力，例如加入更细粒度的周报、月报和异常趋势提醒；第二是完善知识增强与评估机制，使 AI 建议更稳定、更可解释；第三是加强隐私保护、部署运维和自动化测试，使系统更接近真实产品要求。" },

    @{ kind = "heading"; text = "五、对课程的建议" },
    @{ kind = "body"; text = "本课程将需求分析、系统设计、编码实现、测试联调和文档整理结合在一起，对提升综合工程能力很有帮助。通过一个持续数周推进的项目，我能够更完整地体会软件开发中需求变化、分工协作和工程落地之间的关系。" },
    @{ kind = "body"; text = "建议课程后续可以在阶段评审中增加更多针对接口设计和数据模型的反馈。很多项目在早期容易把重点放在页面效果或功能设想上，但真正联调时最容易出问题的是字段约定、状态流转和异常处理。如果能在需求规格说明书和系统设计说明书阶段增加一次接口评审，会更有利于后续开发。" },
    @{ kind = "body"; text = "也建议课程提供一些常见工程问题的参考案例，例如前后端分离项目的目录组织、接口文档示例、数据库迁移方案、测试用例组织和部署检查清单。这样可以帮助学生把注意力更多放在业务设计和实践创新上，同时减少重复摸索基础工程流程的时间。" },
    @{ kind = "body"; text = "对于包含 AI 能力的项目，建议课程适当强调 AI 应用边界、数据安全和结果可解释性。以本项目为例，健康建议不能等同于医疗诊断，AI 输出也需要经过结构化校验和风险控制。若课程能提供相关讨论或案例，会帮助学生更负责任地使用 AI 技术。" },
    @{ kind = "body"; text = "总体而言，本次综合项目实践对我帮助很大。它不仅锻炼了我的后端开发和 AI 集成能力，也让我认识到一个系统从能运行到好使用之间还有大量细致工作。后续我会继续保持工程化思维，在功能实现之外更多关注系统稳定性、可维护性和用户体验。" }
)

$bodyParts = New-Object System.Collections.Generic.List[string]
foreach ($p in $paragraphs) {
    $bodyParts.Add((New-ParagraphXml $p.text $p.kind))
}

$documentXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:w10="urn:schemas-microsoft-com:office:word"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
            xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
            xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
            xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
            xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
            mc:Ignorable="w14 wp14">
  <w:body>
    $($bodyParts -join "`n")
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="851" w:footer="992" w:gutter="0"/>
      <w:cols w:space="425"/>
      <w:docGrid w:type="lines" w:linePitch="312"/>
    </w:sectPr>
  </w:body>
</w:document>
"@

$srcFs = [System.IO.File]::Open((Resolve-Path $source), [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
$srcZip = New-Object System.IO.Compression.ZipArchive($srcFs, [System.IO.Compression.ZipArchiveMode]::Read)
if (Test-Path $output) { Remove-Item -LiteralPath $output -Force }
$outPath = Join-Path (Get-Location) $output
$outFs = [System.IO.File]::Open($outPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
$outZip = New-Object System.IO.Compression.ZipArchive($outFs, [System.IO.Compression.ZipArchiveMode]::Create)

foreach ($entry in $srcZip.Entries) {
    $newEntry = $outZip.CreateEntry($entry.FullName)
    $inStream = $entry.Open()
    $outStream = $newEntry.Open()
    if ($entry.FullName -eq "word/document.xml") {
        $writer = New-Object System.IO.StreamWriter($outStream, (New-Object System.Text.UTF8Encoding($false)))
        $writer.Write($documentXml)
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

