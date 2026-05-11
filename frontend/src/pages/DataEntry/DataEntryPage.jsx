import { useMemo, useState } from "react";
import { Button, DotLoading, Input, NoticeBar, Tag, TextArea, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
import StaggerList from "../../components/common/StaggerList";
import RiskAlertModal from "../../components/feedback/RiskAlertModal";
import { useAppStore } from "../../store/AppStore";
import { healthApi } from "../../services/api";
import { mapParsedHealth } from "../../utils/backendMappers";
import { detectHighRisk } from "../../utils/riskWords";
import styles from "./DataEntryPage.module.css";

const examplePrompts = ["跑了 40 分钟，晚饭吃得清淡", "昨晚只睡了 6 小时，今天有点累", "下午喝了奶茶，晚上散步 20 分钟"];

const resultVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
  },
};

function DataEntryPage() {
  const navigate = useNavigate();
  const { actions } = useAppStore();
  const [rawInput, setRawInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [riskVisible, setRiskVisible] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const hasRiskInput = useMemo(() => detectHighRisk(rawInput), [rawInput]);

  const parseNLP = async () => {
    if (!rawInput.trim()) {
      Toast.show({ content: "请输入健康记录内容。" });
      return;
    }
    if (hasRiskInput) {
      setRiskVisible(true);
      return;
    }
    try {
      setParsing(true);
      const result = await healthApi.parseRecordAI({ rawInput, recordedAt: new Date().toISOString() });
      setParsed(mapParsedHealth(result));
      if (result.confidence === "low" || result.warnings?.length) {
        Toast.show({ content: "解析结果需要确认，请检查提示和预览数据。" });
      }
    } catch (error) {
      Toast.show({ content: error.message || "解析失败" });
    } finally {
      setParsing(false);
    }
  };

  const submitNLP = async () => {
    if (!parsed) {
      Toast.show({ content: "请先完成解析，再提交记录。" });
      return;
    }
    if (hasRiskInput) {
      setRiskVisible(true);
      return;
    }
    try {
      setSubmitting(true);
      const userModifiedData = {
        sleepMinutes: Math.round(Number(parsed.sleepHours || 0) * 60),
        intakeCalories: Number(parsed.intakeCalories || 0),
        exerciseCalories: Number(parsed.exerciseCalories || 0),
        healthTags: parsed.tags,
      };
      await healthApi.confirmRecord({
        parseId: parsed.parseId,
        rawInput,
        previewData: {
          ...parsed.previewData,
          rawInput,
          sleepMinutes: userModifiedData.sleepMinutes,
          intakeCalories: userModifiedData.intakeCalories,
          exerciseCalories: userModifiedData.exerciseCalories,
          healthTags: userModifiedData.healthTags,
          nutritionDetails: parsed.nutritionDetails || {},
          exerciseDetails: parsed.exerciseDetails || {},
        },
        userModifiedData,
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
    } finally {
      setSubmitting(false);
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
        <AppCard className={styles.heroCard} glow>
          <span className="hm-page-eyebrow">健康记录</span>
          <h1 className={styles.title}>录入今日健康信息</h1>
          <p className={styles.copy}>支持输入睡眠、饮食、运动等描述，系统会解析为结构化数据，提交前可手动修改。</p>
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

        <AppCard title="原始输入">
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
            <Button loading={submitting} onClick={submitNLP} disabled={!parsed || hasRiskInput}>
              确认提交
            </Button>
          </div>
        </AppCard>

        <AppCard title="解析预览">
          {!parsed && !parsing && (
            <div className={styles.placeholder}>
              <strong>暂无解析结果</strong>
              <span>输入内容并点击开始解析后，将在此处显示结构化数据。</span>
            </div>
          )}
          {parsing && (
            <div className={styles.parsing}>
              <DotLoading color="primary" />
              <span>正在把自然语言整理成结构化卡片...</span>
            </div>
          )}
          {parsed && !parsing && (
            <motion.div
              className={styles.resultCards}
              variants={resultVariants}
              initial="hidden"
              animate="visible"
            >
              {(parsed.confidence === "low" || parsed.warnings.length > 0) && (
                <div className={styles.warningList}>
                  <NoticeBar
                    color="alert"
                    content={
                      parsed.warnings.length
                        ? parsed.warnings.join("；")
                        : "解析置信度较低，请检查并修改下方预览数据后再提交。"
                    }
                  />
                </div>
              )}
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
                <strong>解析信息</strong>
                <p>
                  {parsed.note}
                  {parsed.confidenceScore != null ? `，置信度分数：${Math.round(parsed.confidenceScore * 100)}%。` : "。"}
                </p>
              </div>
              <div className={styles.tags}>
                {parsed.tags.map((tag, index) => (
                  <Tag key={tag + index} color="primary" fill="outline" onClose={() => removeTag(index)} closeable>
                    <Input value={tag} onChange={(v) => updateTag(index, v)} />
                  </Tag>
                ))}
              </div>
            </motion.div>
          )}
        </AppCard>

        <RiskAlertModal visible={riskVisible} onClose={() => setRiskVisible(false)} />
      </div>
    </PageTransition>
  );
}

export default DataEntryPage;
