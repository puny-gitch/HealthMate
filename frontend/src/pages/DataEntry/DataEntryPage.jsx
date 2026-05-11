import { useMemo, useState } from "react";
import { Button, DotLoading, Input, NoticeBar, Tag, TextArea, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
import EmptyState from "../../components/feedback/EmptyState";
import MotionNotice from "../../components/feedback/MotionNotice";
import { useAppStore } from "../../store/AppStore";
import { healthApi } from "../../services/api";
import { mapParsedHealth } from "../../utils/backendMappers";
import { buildRiskMessage, detectHighRisk } from "../../utils/riskWords";
import styles from "./DataEntryPage.module.css";

const examplePrompts = ["跑了 40 分钟，晚饭吃得清淡", "昨晚只睡了 6 小时，今天有点累", "下午喝了奶茶，晚上散步 20 分钟"];

const resultContainerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

const revealItemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
};

function DataEntryPage() {
  const navigate = useNavigate();
  const { actions } = useAppStore();
  const [rawInput, setRawInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [backendRiskMessage, setBackendRiskMessage] = useState("");

  const hasRiskInput = useMemo(() => detectHighRisk(rawInput), [rawInput]);
  const riskMessage = useMemo(() => buildRiskMessage(rawInput), [rawInput]);
  const riskPreviewMessage = riskMessage || backendRiskMessage;

  const parseNLP = async () => {
    if (!rawInput.trim()) {
      Toast.show({ content: "请输入健康记录内容。" });
      return;
    }
    if (hasRiskInput) {
      setParsed(null);
      setRecordError("");
      return;
    }
    try {
      setParsing(true);
      setRecordError("");
      setBackendRiskMessage("");
      const result = await healthApi.parseRecordAI({ rawInput, recordedAt: new Date().toISOString() });
      setParsed(mapParsedHealth(result));
      if (result.shouldSave === false) {
        Toast.show({ content: result.failureReason || "未识别出可保存的健康记录。" });
      } else if (result.confidence === "low" || result.warnings?.length) {
        Toast.show({ content: "解析结果需要确认，请检查提示和预览数据。" });
      }
    } catch (error) {
      if (error.code === 40020) {
        setParsed(null);
        setBackendRiskMessage(error.message || "检测到高危症状，本条记录不会保存，请及时就医或咨询专业医生。");
      }
      const message = error.message || "解析失败";
      setRecordError(message);
      Toast.show({ content: message });
    } finally {
      setParsing(false);
    }
  };

  const submitNLP = async () => {
    if (!parsed) {
      Toast.show({ content: "请先完成解析，再提交记录。" });
      return;
    }
    if (!parsed.shouldSave) {
      Toast.show({ content: parsed.failureReason || "当前解析结果不可保存，请补充记录内容。" });
      return;
    }
    if (hasRiskInput) {
      Toast.show({ content: riskMessage || "当前内容涉及高危症状，已停止提交。" });
      return;
    }
    try {
      setSubmitting(true);
      setRecordError("");
      setBackendRiskMessage("");
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
      if (error.code === 40020) {
        setBackendRiskMessage(error.message || "检测到高危症状，本条记录不会保存，请及时就医或咨询专业医生。");
      }
      const message = error.message || "提交失败";
      setRecordError(message);
      Toast.show({ content: message });
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
          <MotionNotice className={styles.inlineNotice} color="alert" content={recordError} />
          <TextArea
            value={rawInput}
            placeholder="比如：今天走了 6000 步，晚饭吃得清淡，昨晚睡了 7 小时。"
            onChange={(val) => {
              setRawInput(val);
              setBackendRiskMessage("");
            }}
            className={styles.inputArea}
            autoSize={{ minRows: 5, maxRows: 8 }}
          />
          <div className={styles.actionRow}>
            <Button color="primary" loading={parsing} onClick={parseNLP} disabled={hasRiskInput}>
              {parsing ? "AI 正在整理" : "开始解析"}
            </Button>
            <Button loading={submitting} onClick={submitNLP} disabled={!parsed || !parsed.shouldSave || hasRiskInput}>
              确认提交
            </Button>
          </div>
        </AppCard>

        <AppCard title="解析预览">
          {riskPreviewMessage && !parsing && (
            <Motion.div
              className={styles.riskPreview}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            >
              <NoticeBar color="alert" content={riskPreviewMessage} />
              <div className={styles.riskDetail}>
                <strong>已停止本条记录保存</strong>
                <p>这类内容不适合作为普通健康打卡记录保存。你可以删除相关高危描述后重新解析，或直接联系医生、急救或身边可信赖的人。</p>
              </div>
            </Motion.div>
          )}
          {!parsed && !parsing && !riskPreviewMessage && (
            <EmptyState title="暂无解析结果" description="输入内容并点击开始解析后，将在此处显示结构化数据。" />
          )}
          {parsing && (
            <div className={styles.parsing}>
              <DotLoading color="primary" />
              <span>正在把自然语言整理成结构化卡片...</span>
            </div>
          )}
          {parsed && !parsing && (
            <Motion.div
              className={styles.resultCards}
              variants={resultContainerVariants}
              initial="hidden"
              animate="visible"
            >
              {(!parsed.shouldSave || parsed.confidence === "low" || parsed.warnings.length > 0) && (
                <Motion.div className={styles.warningList} variants={revealItemVariants}>
                  <NoticeBar
                    color="alert"
                    content={
                      parsed.failureReason ||
                      (parsed.warnings.length
                        ? parsed.warnings.join("；")
                        : "解析置信度较低，请检查并修改下方预览数据后再提交。")
                    }
                  />
                  {parsed.suggestions.length > 0 && (
                    <ul className={styles.suggestionList}>
                      {parsed.suggestions.map((suggestion) => (
                        <li key={suggestion}>{suggestion}</li>
                      ))}
                    </ul>
                  )}
                </Motion.div>
              )}
              <Motion.div className={styles.metricCard} variants={revealItemVariants}>
                <span>睡眠</span>
                <div className={styles.metricValue}>
                  <Input value={`${parsed.sleepHours}`} onChange={(v) => setParsed((p) => ({ ...p, sleepHours: Number(v || 0) }))} />
                  <em>小时</em>
                </div>
              </Motion.div>
              <Motion.div className={styles.metricCard} variants={revealItemVariants}>
                <span>摄入</span>
                <div className={styles.metricValue}>
                  <Input value={`${parsed.intakeCalories}`} onChange={(v) => setParsed((p) => ({ ...p, intakeCalories: Number(v || 0) }))} />
                  <em>kcal</em>
                </div>
              </Motion.div>
              <Motion.div className={styles.metricCard} variants={revealItemVariants}>
                <span>运动</span>
                <div className={styles.metricValue}>
                  <Input value={`${parsed.exerciseCalories}`} onChange={(v) => setParsed((p) => ({ ...p, exerciseCalories: Number(v || 0) }))} />
                  <em>kcal</em>
                </div>
              </Motion.div>
              <Motion.div className={styles.noteCard} variants={revealItemVariants}>
                <strong>解析信息</strong>
                <p>
                  {parsed.note}
                  {parsed.confidenceScore != null ? `，置信度分数：${Math.round(parsed.confidenceScore * 100)}%。` : "。"}
                </p>
              </Motion.div>
              <Motion.div className={styles.tags} variants={revealItemVariants}>
                {parsed.tags.map((tag, index) => (
                  <Tag key={tag + index} color="primary" fill="outline" onClose={() => removeTag(index)} closeable>
                    <Input value={tag} onChange={(v) => updateTag(index, v)} />
                  </Tag>
                ))}
              </Motion.div>
            </Motion.div>
          )}
        </AppCard>
      </div>
    </PageTransition>
  );
}

export default DataEntryPage;
