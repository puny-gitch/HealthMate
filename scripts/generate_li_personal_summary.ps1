$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$source = "docs\计算机综合项目实践实验报告模板.docx"
$output = "黎宇恒_个人综合项目实践总结.docx"
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
    @{ kind = "meta"; text = "姓名：黎宇恒" },
    @{ kind = "meta"; text = "课程：计算机综合项目实践" },

    @{ kind = "heading"; text = "一、本人在本综合项目实践中承担的工作" },
    @{ kind = "body"; text = "在 HealthMate 健康伴侣项目中，我主要承担前端开发、页面交互设计、数据可视化、前后端联调、前端测试与部分 AI 知识增强相关工作。项目采用前后端分离架构，后端负责业务接口和数据处理，我主要负责将系统功能组织成用户可直接操作的移动端页面，并保证各页面能够稳定接入后端真实数据。" },
    @{ kind = "body"; text = "需求与设计阶段，我参与了系统整体功能讨论和界面流程设计，重点从用户使用路径出发，梳理了注册登录、档案完善、首页概览、健康记录录入、AI 建议展示、任务打卡、趋势查看和个人中心等页面之间的跳转关系。前端设计过程中，我重点关注信息层级、交互反馈和移动端操作效率，使系统不只具备功能，也具备较清晰的使用体验。" },
    @{ kind = "body"; text = "前端实现方面，我基于 React、Vite 和 Ant Design Mobile 搭建页面结构，完成了主要路由和页面组件开发。系统页面包括登录注册页、档案完善页、仪表盘页、健康记录页、AI 建议页、任务页、趋势页和个人中心页等。各页面通过统一的请求封装与后端交互，减少重复代码，并便于后续根据接口变化进行调整。" },
    @{ kind = "body"; text = "可视化方面，我负责将后端返回的健康数据转化为更直观的图表展示。趋势页和首页中使用 ECharts 展示睡眠趋势、热量变化、运动消耗和健康标签分布等信息，使用户能够从连续记录中观察自身状态变化。为了增强页面观感和数据反馈，我还实现了部分通用展示组件，例如动态数字组件和图表面板组件。" },
    @{ kind = "body"; text = "联调阶段，我根据后端接口变化持续调整前端逻辑，包括接入真实用户档案、处理登录态恢复、展示 AI 解析结果和置信度、处理高危输入提示、支持健康记录历史查询与删除、接入候选任务生成和用户选择加入流程等。我也整理了前端联调记录和后端接口需求清单，帮助团队明确尚需确认的接口字段和状态流转。" },
    @{ kind = "body"; text = "在项目后期，我参与了轻量级 RAG 能力的引入和相关代码更新，使健康建议和健康记录解析能够结合项目维护的日常健康知识片段。该工作虽然主要服务于后端 AI 效果，但也影响前端展示和演示说明，因此我配合完成了功能验证和资料整理。" },

    @{ kind = "heading"; text = "二、本人的实践完成情况" },
    @{ kind = "body"; text = "从最终完成情况看，我负责的前端部分已经实现了 HealthMate 的主要用户操作闭环。用户可以在前端完成注册登录、填写健康档案、查看首页健康概览、录入自然语言健康记录、查看 AI 解析预览、确认保存、获取健康建议、生成并选择候选任务、完成任务打卡、查看历史趋势和管理个人信息。" },
    @{ kind = "body"; text = "认证与档案页面已完成基础表单交互和路由控制。用户登录后，前端能够根据 token 和后端返回的档案完成情况判断进入首页还是档案完善页；档案页面支持身高、体重、健康目标、伤病史和过敏史等信息录入，为后续个性化建议提供前端入口。" },
    @{ kind = "body"; text = "首页和趋势页已完成核心数据展示。首页负责展示用户当日健康概览、近期记录、任务状态和快捷入口；趋势页通过图表展示睡眠、热量和标签变化，帮助用户从日常记录中获得阶段性反馈。针对可能出现的空数据、加载失败和接口异常情况，页面也加入了相应提示，避免用户看到生硬的错误状态。" },
    @{ kind = "body"; text = "健康记录页已接入 AI 解析确认流程。用户输入自然语言记录后，前端调用解析接口，展示结构化预览、置信度、警告信息、失败原因和优化建议。只有在用户确认后，前端才调用保存接口写入记录；如果后端判断输入属于高危内容或无有效健康信息，页面会给出提示，而不是继续保存。" },
    @{ kind = "body"; text = "AI 建议页已实现流式建议展示和任务相关交互。前端通过 SSE 接收后端生成的建议内容，使用户能够看到逐步输出的建议文本；任务生成部分则改为候选任务展示，由用户选择接受哪些任务，再提交给后端保存。这样的流程比直接自动写入任务更符合用户预期，也减少了误生成任务对体验的影响。" },
    @{ kind = "body"; text = "任务页已支持今日任务、任务完成状态、历史任务和重新获取候选任务等交互。用户完成任务后，前端会刷新任务状态，保证页面显示与后端数据一致。对于后端返回的未完成任务覆盖逻辑，前端也通过候选任务确认流程进行承接，避免用户在不知情的情况下丢失任务。" },
    @{ kind = "body"; text = "个人中心和历史记录管理功能已基本完成。用户可以查看个人档案、最近建议和历史健康记录，并删除误输入或过时的记录，减少错误数据对后续建议生成的影响。该功能提升了系统的数据可控性，也让用户对自己的健康数据有更直接的管理能力。" },

    @{ kind = "heading"; text = "三、遇到的问题及解决方法" },
    @{ kind = "body"; text = "第一个问题是前端早期存在较多 mock 数据，后续切换到真实后端接口时，字段结构、状态含义和页面流程都需要重新调整。例如任务列表、AI 建议、用户档案和健康记录等模块都涉及真实接口返回值。解决方法是逐个页面梳理接口依赖，集中封装请求逻辑，并通过联调文档记录字段差异，使前后端逐步统一。" },
    @{ kind = "body"; text = "第二个问题是 SSE 流式建议与常规接口调用方式不同。普通 Axios 请求可以直接携带 Authorization header，而 EventSource 在鉴权和错误处理上存在限制。为保证 AI 建议页能稳定接收后端流式内容，我配合后端调整了 token 传递和状态校准方式，并在前端增加加载、输出中、完成和异常等状态展示。" },
    @{ kind = "body"; text = "第三个问题是健康记录解析结果较复杂，前端需要同时展示结构化字段、置信度、警告信息、失败原因和用户确认入口。如果直接把所有后端返回内容堆在页面上，会造成信息过载。解决方法是将解析结果分层展示：先突出是否可保存和核心识别内容，再展示置信度和警告，最后提供确认保存或重新输入操作，使用户能够快速理解当前状态。" },
    @{ kind = "body"; text = "第四个问题是移动端页面空间有限，而系统功能较多。首页、AI 建议页和任务页都需要展示多类信息，如果布局不合理，容易显得拥挤。解决方法是在页面设计中采用卡片、分区、标签和图表组件来组织内容，同时控制单屏信息密度，把常用操作放在明显位置，把历史记录和详情类信息放到二级区域。" },
    @{ kind = "body"; text = "第五个问题是数据可视化需要处理缺失值和多次记录聚合结果。健康数据不像固定格式的实验数据，用户可能某天没有记录，也可能一天记录多次。前端图表需要适应空数组、部分字段为空、日期不连续等情况。对此，我在图表组件中增加了空状态、默认值和格式化处理，使页面在数据不足时仍能保持清晰。" },
    @{ kind = "body"; text = "第六个问题是前后端联调过程中业务规则不断优化。例如建议生成不再自动创建任务，任务加入需要由用户选择确认，健康记录支持删除，profile 字段拆分为伤病史和过敏史等。解决方法是保持页面逻辑的可调整性，将不同业务动作拆成相对独立的组件和请求函数，并在每次接口变化后及时完成页面适配和验证。" },

    @{ kind = "heading"; text = "四、总结与展望" },
    @{ kind = "body"; text = "通过本次综合项目实践，我对前端开发在完整软件系统中的作用有了更深入的认识。前端并不是简单把数据展示出来，而是需要把复杂的业务流程转化为用户能够理解和操作的界面。尤其在 HealthMate 这类包含 AI 能力的系统中，前端还需要处理模型输出的不确定性，通过合理的交互设计帮助用户确认、修正和使用 AI 结果。" },
    @{ kind = "body"; text = "在技术方面，我进一步熟悉了 React 组件化开发、移动端页面布局、Ant Design Mobile 组件使用、ECharts 数据可视化、路由控制、接口封装和 SSE 流式数据展示。通过多轮联调，我也更加理解接口设计、状态管理和错误处理对用户体验的影响。" },
    @{ kind = "body"; text = "在协作方面，本项目让我体会到前后端约定的重要性。一个字段名、一个状态码或一个接口时机的差异，都可能影响整个页面流程。通过编写联调记录、整理后端需求清单、及时根据接口变化调整页面，我对团队协作和工程沟通有了更实际的经验。" },
    @{ kind = "body"; text = "如果后续继续完善本项目，我认为前端可以从三个方向改进：第一是进一步优化移动端交互细节，使记录、确认和打卡流程更顺畅；第二是增强图表分析能力，加入更多周期对比和总结视图；第三是结合 AI 建议结果提供更清晰的解释和来源展示，让用户更容易理解系统建议的依据。" },

    @{ kind = "heading"; text = "五、对课程的建议" },
    @{ kind = "body"; text = "本课程通过完整项目实践，让我从需求、设计、开发、联调到展示答辩都得到了一次系统训练。相比单独完成某个实验，综合项目更接近真实软件开发过程，也更能暴露团队协作、接口沟通和工程落地中的问题。" },
    @{ kind = "body"; text = "建议课程后续可以在中期检查环节增加一次前后端联调专项检查。很多项目在文档阶段看起来比较完整，但真正实现时会遇到接口字段不统一、数据结构变化、异常状态缺失等问题。如果能提前检查接口契约和页面流程，会减少后期集中联调的压力。" },
    @{ kind = "body"; text = "也建议课程提供一些优秀项目的前端交互和数据可视化案例，特别是移动端页面布局、图表设计、空状态处理和错误提示设计等内容。这样可以帮助同学在完成基础功能之外，更好地提升系统的可用性和展示效果。" },
    @{ kind = "body"; text = "对于包含 AI 的项目，建议课程引导同学关注 AI 结果如何被用户理解和确认。AI 功能不应只是展示一段生成文本，还应考虑置信度、风险提示、用户确认和结果追溯等交互问题。通过这类引导，课程项目可以更好地体现 AI 应用的工程价值。" },
    @{ kind = "body"; text = "总体而言，本次课程实践让我在前端工程能力、团队协作能力和 AI 应用理解方面都有明显收获。后续我会继续加强前端架构设计、用户体验设计和跨端适配能力，也会更加重视从真实用户流程出发思考系统功能。" }
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

