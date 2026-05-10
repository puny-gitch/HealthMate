import { useCallback, useEffect, useMemo, useRef } from "react";
import { Avatar, Button, DotLoading, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
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
  const sseUrl = token ? `${API_BASE_URL}/advice/stream?token=${encodeURIComponent(token)}` : "";
  const refreshTodayTasks = useCallback(async () => {
    const result = await taskApi.today();
    actions.setTasks((result.tasks || []).map((task) => mapTask(task, "today")));
  }, [actions]);
  const handleTasks = useCallback(
    async (items) => {
      actions.addTasks((items || []).map((task) => mapTask({ ...task, status: 0 }, "today")));
      try {
        await refreshTodayTasks();
      } catch {
        // SSE 已经提供了任务数据，刷新失败时保留流式返回的结果。
      }
    },
    [actions, refreshTodayTasks],
  );
  const { text, loading, error, resumeHint, connect } = useSSEAdvice(sseUrl, { onTasks: handleTasks });

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
  const displayText = text || recommendations[0]?.content || "暂无后端 AI 建议。";

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
        <AppCard className={styles.heroCard}>
          <div className={styles.heroTop}>
            <div className={styles.botInfo}>
              <Avatar src={user.avatar} style={{ "--size": "52px" }} />
              <div>
                <span className="hm-page-eyebrow">HealthMate AI</span>
                <h1>像朋友一样给你一点点推动</h1>
                <p>不是批评，也不是打分，而是帮你把今天过得更轻一点。</p>
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
            <Button fill="outline" onClick={() => Toast.show({ content: "收到，这条建议会作为你的偏好记录下来。" })}>
              有帮助
            </Button>
            <Button color="primary" onClick={() => connect()}>
              重新生成
            </Button>
          </div>
        </AppCard>

        <AppCard title="生成的行动建议">
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

        <AppCard title="最近几次 AI 陪伴记录">
          <div className={styles.historyList}>
            {history.map((item) => (
              <article key={item.time} className={styles.historyItem}>
                <strong>{new Date(item.time).toLocaleDateString("zh-CN")}</strong>
                <p>{item.content}</p>
              </article>
            ))}
            {!history.length && <p className="hm-section-copy">暂无后端历史建议。</p>}
          </div>
        </AppCard>

        <Button onClick={() => navigate("/dashboard")}>返回首页</Button>
      </div>
    </PageTransition>
  );
}

export default AIAdvicePage;
