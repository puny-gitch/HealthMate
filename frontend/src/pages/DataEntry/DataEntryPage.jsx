import { useMemo, useState } from "react";
import { Button, DotLoading, Input, Tag, TextArea, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
import RiskAlertModal from "../../components/feedback/RiskAlertModal";
import { useAppStore } from "../../store/AppStore";
import { detectHighRisk } from "../../utils/riskWords";
import styles from "./DataEntryPage.module.css";

const examplePrompts = ["跑了 40 分钟，晚饭吃得清淡", "昨晚只睡了 6 小时，今天有点累", "下午喝了奶茶，晚上散步 20 分钟"];

function parseDraft(text) {
  const source = text || "";
  const sleepHoursMatch = source.match(/(\d+(?:\.\d+)?)\s*(?:小时|h|H)/);
  const sleepMinutesMatch = source.match(/(\d+)\s*分钟睡/);
  const intakeMatch = source.match(/(?:吃了|摄入|热量)\D{0,6}(\d{2,4})\s*(?:kcal|卡)?/i);
  const exerciseMatch = source.match(/(?:跑了|运动|散步|消耗)\D{0,6}(\d{2,4})\s*(?:分钟|kcal|卡)?/i);

  const sleepHours = sleepHoursMatch
    ? Number(sleepHoursMatch[1])
    : sleepMinutesMatch
      ? Number((Number(sleepMinutesMatch[1]) / 60).toFixed(1))
      : source.includes("累")
        ? 6.2
        : 7.0;
  const intakeCalories = intakeMatch ? Number(intakeMatch[1]) : source.includes("沙拉") ? 480 : source.includes("奶茶") ? 780 : 560;
  const exerciseCalories = exerciseMatch ? Number(exerciseMatch[1]) : source.includes("散步") ? 160 : source.includes("跑") ? 300 : 120;
  const tags = [
    source.includes("跑") || source.includes("散步") || source.includes("运动") ? "有氧" : null,
    source.includes("沙拉") || source.includes("清淡") ? "轻负担饮食" : null,
    source.includes("奶茶") || source.includes("甜") ? "高糖提醒" : null,
    sleepHours >= 7 ? "睡眠恢复" : "睡眠偏少",
  ].filter(Boolean);

  return {
    sleepHours,
    intakeCalories,
    exerciseCalories,
    tags: [...new Set(tags)],
    note:
      sleepHours < 6.5
        ? "今天的重点更适合放在恢复和早睡，不需要逼自己做太难。"
        : "状态整体平稳，可以继续维持轻运动和清爽饮食。",
  };
}

function DataEntryPage() {
  const navigate = useNavigate();
  const { actions } = useAppStore();
  const [rawInput, setRawInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [riskVisible, setRiskVisible] = useState(false);
  const [parsed, setParsed] = useState(null);

  const hasRiskInput = useMemo(() => detectHighRisk(rawInput), [rawInput]);

  const parseNLP = async () => {
    if (!rawInput.trim()) {
      Toast.show({ content: "先随手写一句今天的状态吧。" });
      return;
    }
    if (hasRiskInput) {
      setRiskVisible(true);
      return;
    }
    setParsing(true);
    setTimeout(() => {
      const nextParsed = parseDraft(rawInput);
      setParsing(false);
      setParsed(nextParsed);
    }, 900);
  };

  const submitNLP = () => {
    if (!parsed) {
      Toast.show({ content: "先让 AI 帮你整理一下，再确认提交会更稳。" });
      return;
    }
    if (hasRiskInput) {
      setRiskVisible(true);
      return;
    }
    actions.addEntry({
      summary: rawInput,
      date: new Date().toISOString().slice(0, 10),
      mood: parsed.sleepHours >= 7 ? "状态平稳" : "需要恢复",
    });
    Toast.show({ content: "记录成功，HealthMate 已记住你今天的状态。" });
    navigate("/dashboard");
  };

  const updateTag = (index, value) => {
    setParsed((prev) => ({
      ...prev,
      tags: prev.tags.map((item, i) => (i === index ? value : item)),
    }));
  };

  const removeTag = (index) => {
    setParsed((prev) => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  };

  return (
    <PageTransition>
      <div className={styles.page}>
        <AppCard className={styles.heroCard}>
          <span className="hm-page-eyebrow">轻量健康记录</span>
          <h1 className={styles.title}>今天做了什么？随便说就可以</h1>
          <p className={styles.copy}>我们会先帮你理解，再把结果预填进卡片里。你随时都能改，不需要一次说得很完整。</p>
          <div className={styles.examples}>
            {examplePrompts.map((prompt) => (
              <button
                key={prompt}
                className={styles.exampleChip}
                onClick={() => setRawInput((value) => (value ? `${value}；${prompt}` : prompt))}
                type="button"
              >
                {prompt}
              </button>
            ))}
          </div>
        </AppCard>

        <AppCard title="输入框">
          <TextArea
            value={rawInput}
            placeholder="比如：今天走了 6000 步，晚饭吃得清淡，昨晚睡了 7 小时。"
            onChange={(val) => {
              setRawInput(val);
              if (detectHighRisk(val)) {
                setRiskVisible(true);
              }
            }}
            className={styles.inputArea}
            autoSize={{ minRows: 5, maxRows: 8 }}
          />
          <div className={styles.actionRow}>
            <Button color="primary" loading={parsing} onClick={parseNLP} disabled={hasRiskInput}>
              {parsing ? "AI 正在整理" : "开始解析"}
            </Button>
            <Button onClick={submitNLP} disabled={!parsed || hasRiskInput}>
              确认提交
            </Button>
          </div>
        </AppCard>

        <AppCard title="AI 解析结果">
          {!parsed && !parsing && (
            <div className={styles.placeholder}>
              <strong>等你输入后，我会先帮你填一版。</strong>
              <span>你不用一次输入很标准，我们更想让记录变轻松。</span>
            </div>
          )}
          {parsing && (
            <div className={styles.parsing}>
              <DotLoading color="primary" />
              <span>正在把自然语言整理成结构化卡片...</span>
            </div>
          )}
          {parsed && !parsing && (
            <div className={styles.resultCards}>
              <div className={styles.metricCard}>
                <span>睡眠</span>
                <div className={styles.metricValue}>
                  <Input value={`${parsed.sleepHours}`} onChange={(v) => setParsed((p) => ({ ...p, sleepHours: Number(v || 0) }))} />
                  <em>小时</em>
                </div>
              </div>
              <div className={styles.metricCard}>
                <span>摄入</span>
                <div className={styles.metricValue}>
                  <Input value={`${parsed.intakeCalories}`} onChange={(v) => setParsed((p) => ({ ...p, intakeCalories: Number(v || 0) }))} />
                  <em>kcal</em>
                </div>
              </div>
              <div className={styles.metricCard}>
                <span>运动</span>
                <div className={styles.metricValue}>
                  <Input value={`${parsed.exerciseCalories}`} onChange={(v) => setParsed((p) => ({ ...p, exerciseCalories: Number(v || 0) }))} />
                  <em>kcal</em>
                </div>
              </div>
              <div className={styles.noteCard}>
                <strong>HealthMate 小提示</strong>
                <p>{parsed.note}</p>
              </div>
              <div className={styles.tags}>
                {parsed.tags.map((tag, index) => (
                  <Tag key={tag + index} color="primary" fill="outline" onClose={() => removeTag(index)} closeable>
                    <Input value={tag} onChange={(v) => updateTag(index, v)} />
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </AppCard>

        <RiskAlertModal visible={riskVisible} onClose={() => setRiskVisible(false)} />
      </div>
    </PageTransition>
  );
}

export default DataEntryPage;
