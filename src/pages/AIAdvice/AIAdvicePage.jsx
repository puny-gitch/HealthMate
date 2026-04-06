import { useEffect, useMemo } from "react";
import { Button, DotLoading, Toast } from "antd-mobile";
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
  const {
    state: { tasks },
    actions,
  } = useAppStore();

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (text && !loading) {
      actions.addRecommendation(text);
    }
  }, [text, loading, actions]);

  const todoTasks = useMemo(() => tasks.slice(0, 3), [tasks]);

  return (
    <PageTransition>
      <div className={styles.page}>
        <AppCard title="AI 健康建议" extra={<span className={styles.time}>生成时间：{new Date().toLocaleString("zh-CN")}</span>}>
          {loading && (
            <div className={styles.loadingRow}>
              建议生成中 <DotLoading color="primary" />
            </div>
          )}
          {resumeHint && <div className={styles.warn}>{resumeHint}</div>}
          {error && <div className={styles.warn}>{error}</div>}
          <TypingStream text={text} loading={loading} />
        </AppCard>

        <AppCard title="今日可执行任务">
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
                    Toast.show({ content: task.completed ? "已取消打卡" : "打卡成功" });
                  }}
                >
                  {task.completed ? "已打卡" : "打卡"}
                </Button>
              </div>
            ))}
          </div>
        </AppCard>

        <div className={styles.bottomBtns}>
          <Button onClick={() => navigate("/dashboard")}>返回首页</Button>
          <Button color="primary" fill="outline" onClick={() => Toast.show({ content: "历史建议接口待接入" })}>
            查看历史建议
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}

export default AIAdvicePage;
