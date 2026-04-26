import { useEffect, useMemo, useRef } from "react";
import { Avatar, Button, DotLoading, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
import TypingStream from "../../components/feedback/TypingStream";
import { useSSEAdvice } from "../../hooks/useSSEAdvice";
import { useAppStore } from "../../store/AppStore";
import styles from "./AIAdvicePage.module.css";

function AIAdvicePage() {
  const navigate = useNavigate();
  const { text, loading, error, resumeHint, connect } = useSSEAdvice(import.meta.env.VITE_SSE_ADVICE_URL || "");
  const savedTextRef = useRef("");
  const {
    state: { tasks, recommendations, user },
    actions,
  } = useAppStore();

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (text && !loading && savedTextRef.current !== text) {
      savedTextRef.current = text;
      actions.addRecommendation(text);
    }
  }, [text, loading, actions]);

  const todoTasks = useMemo(() => tasks.filter((task) => task.slot === "today").slice(0, 3), [tasks]);
  const history = recommendations.slice(0, 3);
  const displayText = text || recommendations[0]?.content || "";

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
                  onClick={() => {
                    actions.toggleTask(task.id);
                    Toast.show({ content: task.completed ? "已恢复未完成状态" : "做得很好，记得给自己一点肯定" });
                  }}
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
          </div>
        </AppCard>

        <Button onClick={() => navigate("/dashboard")}>返回首页</Button>
      </div>
    </PageTransition>
  );
}

export default AIAdvicePage;
