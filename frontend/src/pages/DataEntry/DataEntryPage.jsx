import { useMemo, useState } from "react";
import { Button, DotLoading, Input, Tag, TextArea, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
import RiskAlertModal from "../../components/feedback/RiskAlertModal";
import { useAppStore } from "../../store/AppStore";
import { healthApi } from "../../services/api";
import { mapParsedHealth } from "../../utils/backendMappers";
import { detectHighRisk } from "../../utils/riskWords";
import styles from "./DataEntryPage.module.css";

const examplePrompts = ["跑了 40 分钟，晚饭吃得清淡", "昨晚只睡了 6 小时，今天有点累", "下午喝了奶茶，晚上散步 20 分钟"];

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
    try {
      setParsing(true);
      const result = await healthApi.parseData({ rawInput });
      setParsed(mapParsedHealth(result));
    } catch (error) {
      Toast.show({ content: error.message || "解析失败" });
    } finally {
      setParsing(false);
    }
  };

  const submitNLP = async () => {
    if (!parsed) {
      Toast.show({ content: "先让 AI 帮你整理一下，再确认提交会更稳。" });
      return;
    }
    if (hasRiskInput) {
      setRiskVisible(true);
      return;
    }
    try {
      await healthApi.submitData({
        rawInput,
        sleepMinutes: Math.round(Number(parsed.sleepHours || 0) * 60),
        intakeCalories: Number(parsed.intakeCalories || 0),
        exerciseCalories: Number(parsed.exerciseCalories || 0),
        tags: parsed.tags,
        nutritionDetails: parsed.nutritionDetails || {},
      });
      actions.addEntry({
        summary: rawInput,
        date: new Date().toISOString().slice(0, 10),
        mood: parsed.tags.join(" / ") || parsed.confidence,
      });
      Toast.show({ content: "记录成功" });
      navigate("/dashboard");
    } catch (error) {
      Toast.show({ content: error.message || "提交失败" });
    }
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
