import { useCallback, useEffect, useMemo, useRef } from "react";
import { Avatar, Button, Checkbox, DotLoading, NoticeBar, Toast } from "antd-mobile";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
import StaggerList from "../../components/common/StaggerList";
import EmptyState from "../../components/feedback/EmptyState";
import MotionNotice from "../../components/feedback/MotionNotice";
import ProcessSteps from "../../components/feedback/ProcessSteps";
import TypingStream from "../../components/feedback/TypingStream";
import { useSSEAdvice } from "../../hooks/useSSEAdvice";
import { useAppStore } from "../../store/AppStore";
import { adviceApi, taskApi } from "../../services/api";
import { API_BASE_URL } from "../../services/http";
import { mapTask } from "../../utils/backendMappers";
import styles from "./AIAdvicePage.module.css";

const adviceSteps = ["读取最近记录", "生成健康建议", "整理候选任务"];

function AIAdvicePage() {
  const navigate = useNavigate();
  const savedTextRef = useRef("");
  const {
    state: { token, tasks, recommendations, user },
    actions,
  } = useAppStore();
  const [taskPreview, setTaskPreview] = useState(null);
  const [selectedDrafts, setSelectedDrafts] = useState([]);
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [addingTasks, setAddingTasks] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [taskSuccess, setTaskSuccess] = useState("");
  const sseUrl = token ? `${API_BASE_URL}/advice/stream?token=${encodeURIComponent(token)}` : "";
  const refreshTodayTasks = useCallback(async () => {
    const result = await taskApi.today();
    actions.setTasks((result.tasks || []).map((task) => mapTask(task, "today")));
  }, [actions]);
  const handleAdviceComplete = useCallback(
    (adviceText) => {
      if (!adviceText || savedTextRef.current === adviceText) return;
      savedTextRef.current = adviceText;
      actions.addRecommendation(adviceText);
    },
    [actions],
  );
  const { text, loading, error, resumeHint, connect } = useSSEAdvice(sseUrl, { onAdvice: handleAdviceComplete });

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    let active = true;
    adviceApi
      .history()
      .then((history) => {
        if (!active) return;
        setHistoryError("");
        actions.setRecommendations(
          (history || []).map((item) => ({
            content: item.adviceText,
            time: item.createdAt,
          })),
        );
      })
      .catch((historyLoadError) => {
        if (!active) return;
        setHistoryError(historyLoadError.message || "历史建议加载失败，当前展示本地缓存内容。");
      });

    return () => {
      active = false;
    };
  }, [actions]);

  useEffect(() => {
    if (text && !loading && savedTextRef.current !== text) {
      savedTextRef.current = text;
      actions.addRecommendation(text);
    }
  }, [text, loading, actions]);

  const todoTasks = useMemo(() => tasks.filter((task) => task.slot === "today").slice(0, 3), [tasks]);
  const history = recommendations.slice(0, 3);
  const displayText = text || recommendations[0]?.content || "暂无 AI 建议。";
  const today = new Date().toISOString().slice(0, 10);
  const forceGenerate = () => {
    if (!sseUrl) {
      Toast.show({ content: "请先登录后再生成建议" });
      return;
    }
    const separator = sseUrl.includes("?") ? "&" : "?";
    connect(`${sseUrl}${separator}force=true&t=${Date.now()}`);
  };

  const generateTaskPreview = async () => {
    try {
      setGeneratingTasks(true);
      setTaskError("");
      setTaskSuccess("");
      const result = await taskApi.generatePreview({ targetDate: today, maxTasks: 3 });
      setTaskPreview(result);
      setSelectedDrafts((result.candidates || []).map((task, index) => task.draftId || `${task.taskContent}-${index}`));
      if (!result.candidates?.length) {
        setTaskError("后端暂未生成可加入的候选任务，请先补充健康记录或稍后再试。");
        Toast.show({ content: "暂无可加入的候选任务。" });
      }
    } catch (previewError) {
      const message = previewError.message?.includes("404")
          ? "当前后端未启用任务候选接口，请重启最新后端服务。"
          : previewError.message || "候选任务生成失败";
      setTaskError(message);
      Toast.show({ content: message });
    } finally {
      setGeneratingTasks(false);
    }
  };

  const addSelectedTasks = async () => {
    const selectedTasks = (taskPreview?.candidates || []).filter((task, index) =>
      selectedDrafts.includes(task.draftId || `${task.taskContent}-${index}`),
    );
    if (!selectedTasks.length) {
      Toast.show({ content: "请至少选择一个候选任务。" });
      return;
    }
    try {
      setAddingTasks(true);
      setTaskError("");
      setTaskSuccess("");
      const result = await taskApi.addSelected({
        targetDate: taskPreview.targetDate || today,
        tasks: selectedTasks.map((task) => ({
          taskContent: task.taskContent,
          aiReason: task.aiReason,
          difficulty: task.difficulty,
        })),
      });
      await refreshTodayTasks();
      setTaskPreview(null);
      setSelectedDrafts([]);
      const archivedCount = result.archivedUnfinishedTaskCount || 0;
      const skippedText = result.skippedReasons?.length ? `，${result.skippedReasons.join("；")}` : "";
      const message = `任务已加入今日列表${archivedCount ? `，已归档 ${archivedCount} 个未完成任务` : ""}${skippedText}`;
      setTaskSuccess(message);
      if (result.skippedReasons?.length) setTaskError(result.skippedReasons.join("；"));
      Toast.show({ content: message });
    } catch (addError) {
      const message = addError.message || "任务加入失败";
      setTaskError(message);
      Toast.show({ content: message });
    } finally {
      setAddingTasks(false);
    }
  };

  const handleTaskToggle = async (task) => {
    const nextCompleted = !task.completed;
    try {
      await taskApi.check({ taskId: task.id, status: nextCompleted ? 1 : 0 });
      await refreshTodayTasks();
      setTaskError("");
      Toast.show({ content: nextCompleted ? "已打卡" : "已恢复未完成状态" });
    } catch (taskError) {
      const message = taskError.message || "任务更新失败";
      setTaskError(message);
      Toast.show({ content: message });
    }
  };

  return (
    <PageTransition>
      <div className={styles.page}>
        <AppCard className={styles.heroCard} glow>
          <div className={styles.heroTop}>
            <div className={styles.botInfo}>
              <Avatar src={user.avatar} style={{ "--size": "52px" }} />
              <div>
                <span className="hm-page-eyebrow">HealthMate AI</span>
                <h1>AI 健康建议</h1>
                <p>基于近期健康记录生成建议和任务，结果仅作日常管理参考。</p>
              </div>
            </div>
            <div className={styles.statusBadge}>
              {loading ? <DotLoading color="primary" /> : <span className={styles.statusDot} />}
              <span>{loading ? "正在分析最近记录..." : "已经整理完成"}</span>
            </div>
          </div>
        </AppCard>

        <AppCard title="今日建议" extra={<span className={styles.time}>更新于 {new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>}>
          {loading && (
            <div className={styles.loadingRow}>
              建议生成中 <DotLoading color="primary" />
            </div>
          )}
          {resumeHint && <div className={styles.warn}>{resumeHint}</div>}
          {(loading || generatingTasks || addingTasks) && (
            <ProcessSteps
              steps={adviceSteps}
              active={addingTasks ? 2 : generatingTasks ? 2 : loading ? 1 : 0}
              done={!loading && !generatingTasks && !addingTasks}
            />
          )}
          <MotionNotice className={styles.inlineNotice} color="alert" content={error} />
          <MotionNotice className={styles.inlineNotice} color="info" content={historyError} />
          <TypingStream text={displayText} loading={loading} />
          <div className={styles.actionBar}>
            <Button color="primary" onClick={forceGenerate}>
              重新生成
            </Button>
            <Button loading={generatingTasks} onClick={generateTaskPreview}>
              生成任务
            </Button>
          </div>
        </AppCard>

        <AppCard title="任务候选">
          {!taskPreview && <EmptyState title="暂无候选任务" description="点击生成任务后，可选择候选任务加入今日任务列表。" />}
          <MotionNotice className={styles.inlineNotice} color="alert" content={taskError} />
          <MotionNotice className={styles.inlineNotice} color="success" content={taskSuccess} />
          {taskPreview?.skippedReasons?.length > 0 && (
            <div className={styles.noticeStack}>
              {taskPreview.skippedReasons.map((reason) => (
                <NoticeBar key={reason} color="alert" content={reason} />
              ))}
            </div>
          )}
          {taskPreview?.candidates?.length > 0 && (
            <>
              <Checkbox.Group value={selectedDrafts} onChange={setSelectedDrafts}>
                <StaggerList className={styles.taskList}>
                  {taskPreview.candidates.map((task, index) => {
                    const draftValue = task.draftId || `${task.taskContent}-${index}`;
                    return (
                    <label key={draftValue} className={styles.task}>
                      <Checkbox value={draftValue} />
                      <div>
                        <h4>{task.taskContent}</h4>
                        <p>{task.aiReason}</p>
                        <span className={styles.taskMeta}>
                          难度：{task.difficulty || "-"}
                          {task.similarityWarning ? " · 可能与已有任务相似" : ""}
                        </span>
                      </div>
                    </label>
                    );
                  })}
                </StaggerList>
              </Checkbox.Group>
              <div className={styles.actionBar}>
                <Button color="primary" loading={addingTasks} onClick={addSelectedTasks}>
                  加入今日任务
                </Button>
              </div>
            </>
          )}
        </AppCard>

        <AppCard title="今日任务">
          <div className={styles.taskList}>
            {todoTasks.map((task) => (
              <Motion.div
                key={task.id}
                className={styles.task}
                layout
                whileTap={{ scale: 0.98 }}
                animate={{ backgroundColor: task.completed ? "rgba(229, 242, 239, 0.95)" : "rgba(248, 250, 249, 1)" }}
                transition={{ duration: 0.22 }}
              >
                <div>
                  <h4>{task.title}</h4>
                  <p>AI 建议缘由：{task.reason}</p>
                </div>
                <Button
                  size="small"
                  color={task.completed ? "success" : "primary"}
                  onClick={() => handleTaskToggle(task)}
                >
                  {task.completed ? "已打卡" : "去执行"}
                </Button>
              </Motion.div>
            ))}
          </div>
        </AppCard>

        <AppCard title="最近 AI 建议记录">
          <StaggerList className={styles.historyList}>
            {history.map((item) => (
              <article key={item.time} className={styles.historyItem}>
                <strong>{new Date(item.time).toLocaleDateString("zh-CN")}</strong>
                <p>{item.content}</p>
              </article>
            ))}
          </StaggerList>
          {!history.length && <EmptyState title="暂无历史建议" description="生成建议后，历史记录会显示在这里。" />}
        </AppCard>

        <Button className="hm-ghost-action" fill="outline" onClick={() => navigate("/dashboard")}>
          返回首页
        </Button>
      </div>
    </PageTransition>
  );
}

export default AIAdvicePage;
