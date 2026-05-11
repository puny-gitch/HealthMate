import { useCallback, useEffect, useMemo, useRef } from "react";
import { Avatar, Button, Checkbox, DotLoading, NoticeBar, Toast } from "antd-mobile";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
import StaggerList from "../../components/common/StaggerList";
import TypingStream from "../../components/feedback/TypingStream";
import { useSSEAdvice } from "../../hooks/useSSEAdvice";
import { useAppStore } from "../../store/AppStore";
import { adviceApi, taskApi } from "../../services/api";
import { API_BASE_URL } from "../../services/http";
import { mapTask } from "../../utils/backendMappers";
import styles from "./AIAdvicePage.module.css";

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
  const sseUrl = token ? `${API_BASE_URL}/advice/stream?token=${encodeURIComponent(token)}` : "";
  const refreshTodayTasks = useCallback(async () => {
    const result = await taskApi.today();
    actions.setTasks((result.tasks || []).map((task) => mapTask(task, "today")));
  }, [actions]);
  const { text, loading, error, resumeHint, connect } = useSSEAdvice(sseUrl);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    let active = true;
    adviceApi
      .history()
      .then((history) => {
        if (!active) return;
        actions.setRecommendations(
          (history || []).map((item) => ({
            content: item.adviceText,
            time: item.createdAt,
          })),
        );
      })
      .catch(() => {});

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
      const result = await taskApi.generatePreview({ targetDate: today, maxTasks: 3 });
      setTaskPreview(result);
      setSelectedDrafts((result.candidates || []).map((task) => task.draftId));
      if (!result.candidates?.length) {
        Toast.show({ content: "暂无可加入的候选任务。" });
      }
    } catch (previewError) {
      Toast.show({
        content: previewError.message?.includes("404")
          ? "当前后端未启用任务候选接口，请重启最新后端服务。"
          : previewError.message || "候选任务生成失败",
      });
    } finally {
      setGeneratingTasks(false);
    }
  };

  const addSelectedTasks = async () => {
    const selectedTasks = (taskPreview?.candidates || []).filter((task) => selectedDrafts.includes(task.draftId));
    if (!selectedTasks.length) {
      Toast.show({ content: "请至少选择一个候选任务。" });
      return;
    }
    try {
      setAddingTasks(true);
      await taskApi.addSelected({
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
      Toast.show({ content: "任务已加入今日列表" });
    } catch (addError) {
      Toast.show({ content: addError.message || "任务加入失败" });
    } finally {
      setAddingTasks(false);
    }
  };

  const handleTaskToggle = async (task) => {
    const nextCompleted = !task.completed;
    try {
      await taskApi.check({ taskId: task.id, status: nextCompleted ? 1 : 0 });
      await refreshTodayTasks();
      Toast.show({ content: nextCompleted ? "已打卡" : "已恢复未完成状态" });
    } catch (taskError) {
      Toast.show({ content: taskError.message || "任务更新失败" });
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
          {error && <div className={styles.warn}>{error}</div>}
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
          {!taskPreview && <p className="hm-section-copy">点击"生成任务"后，可选择候选任务加入今日任务列表。</p>}
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
                  {taskPreview.candidates.map((task) => (
                    <label key={task.draftId} className={styles.task}>
                      <Checkbox value={task.draftId} />
                      <div>
                        <h4>{task.taskContent}</h4>
                        <p>{task.aiReason}</p>
                        <span className={styles.taskMeta}>
                          难度：{task.difficulty || "-"}
                          {task.similarityWarning ? " · 可能与已有任务相似" : ""}
                        </span>
                      </div>
                    </label>
                  ))}
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
              <div key={task.id} className={styles.task}>
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
              </div>
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
          {!history.length && <p className="hm-section-copy">暂无历史建议。</p>}
        </AppCard>

        <Button className="hm-ghost-action" fill="outline" onClick={() => navigate("/dashboard")}>
          返回首页
        </Button>
      </div>
    </PageTransition>
  );
}

export default AIAdvicePage;
