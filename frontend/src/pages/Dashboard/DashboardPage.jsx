import { Button, ProgressBar, Toast } from "antd-mobile";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import AppCard from "../../components/common/AppCard";
import AnimatedCounter from "../../components/common/AnimatedCounter";
import PageTransition from "../../components/common/PageTransition";
import StaggerList from "../../components/common/StaggerList";
import EmptyState from "../../components/feedback/EmptyState";
import MotionNotice from "../../components/feedback/MotionNotice";
import { useAppStore } from "../../store/AppStore";
import { adviceApi, healthApi, taskApi } from "../../services/api";
import { mapHealthRecord, mapTask, mapTrend } from "../../utils/backendMappers";
import styles from "./DashboardPage.module.css";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function DashboardPage() {
  const navigate = useNavigate();
  const {
    state: { user, tasks, recommendations, recentEntries, metrics },
    actions,
  } = useAppStore();
  const [expanded, setExpanded] = useState(false);
  const [completionRate, setCompletionRate] = useState(0);
  const [loadWarnings, setLoadWarnings] = useState([]);
  const [operationError, setOperationError] = useState("");

  const refreshTodayTasks = async () => {
    const result = await taskApi.today();
    actions.setTasks((result.tasks || []).map((task) => mapTask(task, "today")));
    setCompletionRate(result.completionRate || 0);
  };

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      healthApi.getDashboard(),
      taskApi.today(),
      healthApi.getRecentRecords({ days: 7 }),
      adviceApi.history(),
    ]).then(([dashboardResult, taskResult, recordResult, adviceResult]) => {
      if (!active) return;
      const warnings = [];
      if (dashboardResult.status === "fulfilled") {
        setCompletionRate(dashboardResult.value.completionRate || 0);
        actions.setMetrics("week", mapTrend(dashboardResult.value));
      } else {
        warnings.push(`首页概览加载失败：${dashboardResult.reason?.message || "请稍后重试"}`);
      }
      if (taskResult.status === "fulfilled") {
        actions.setTasks((taskResult.value.tasks || []).map((task) => mapTask(task, "today")));
        setCompletionRate(taskResult.value.completionRate || 0);
      } else {
        warnings.push(`今日任务加载失败：${taskResult.reason?.message || "请稍后重试"}`);
      }
      if (recordResult.status === "fulfilled") {
        actions.setRecentEntries((recordResult.value.records || []).map(mapHealthRecord));
      } else {
        warnings.push(`最近记录加载失败：${recordResult.reason?.message || "请稍后重试"}`);
      }
      if (adviceResult.status === "fulfilled") {
        actions.setRecommendations(
          (adviceResult.value || []).map((item) => ({
            content: item.adviceText,
            time: item.createdAt,
          })),
        );
      } else {
        warnings.push(`AI 建议加载失败：${adviceResult.reason?.message || "请稍后重试"}`);
      }
      setLoadWarnings(warnings);
    });

    return () => {
      active = false;
    };
  }, [actions]);

  const todayTasks = useMemo(() => tasks.filter((task) => task.slot === "today"), [tasks]);
  const progress = useMemo(() => {
    if (completionRate) return completionRate;
    const total = todayTasks.length || 1;
    const done = todayTasks.filter((task) => task.completed).length;
    return Math.round((done / total) * 100);
  }, [completionRate, todayTasks]);

  const latestAdvice = recommendations[0]?.content ?? "暂无 AI 建议，可进入 AI 建议页生成。";
  const sleepAverage = useMemo(() => {
    if (!metrics.week.sleep.length) return 0;
    const total = metrics.week.sleep.reduce((sum, item) => sum + item, 0);
    return total / metrics.week.sleep.length;
  }, [metrics.week.sleep]);

  const trendHighlights = [
    { title: "睡眠", value: sleepAverage, suffix: "h", delta: "近 7 天平均", decimal: 1 },
    {
      title: "摄入",
      value: metrics.week.intake.at(-1) || 0,
      suffix: " kcal",
      delta: "最近一次记录",
      decimal: 0,
    },
    {
      title: "消耗",
      value: metrics.week.burn.at(-1) || 0,
      suffix: " kcal",
      delta: "最近一次记录",
      decimal: 0,
    },
  ];

  const handleTaskToggle = async (task) => {
    const nextCompleted = !task.completed;
    try {
      await taskApi.check({ taskId: task.id, status: nextCompleted ? 1 : 0 });
      await refreshTodayTasks();
      setOperationError("");
      Toast.show({ content: nextCompleted ? "已完成" : "已恢复为待完成" });
    } catch (error) {
      const message = error.message || "任务更新失败";
      setOperationError(message);
      Toast.show({ content: message });
    }
  };

  return (
    <PageTransition>
      <div className={styles.page}>
        {(loadWarnings.length > 0 || operationError) && (
          <div className={styles.noticeStack}>
            <MotionNotice color="alert" content={operationError} />
            {loadWarnings.map((warning) => (
              <MotionNotice key={warning} color="info" content={warning} />
            ))}
          </div>
        )}

        <section className={styles.hero}>
          <div className={styles.heroIntro}>
            <span className="hm-page-eyebrow">首页概览</span>
            <h1>{getGreeting()}，{user.nickname}</h1>
            <p>今日有 {todayTasks.length} 项任务，最近记录 {recentEntries.length} 条。</p>
          </div>

          <AppCard className={styles.scoreCard} glow>
            <div className={styles.scoreHeader}>
              <div>
                <strong>今日任务</strong>
                <span>
                  已完成 {todayTasks.filter((task) => task.completed).length} / {todayTasks.length}
                </span>
              </div>
              <div className={styles.progressBadge}>
                <strong>
                  <AnimatedCounter to={progress} suffix="%" duration={1} />
                </strong>
              </div>
            </div>
            <ProgressBar percent={progress} />
            <div className={styles.scoreFoot}>
              <Button className="hm-ghost-action" fill="outline" size="small" onClick={() => navigate("/tasks")}>
                查看全部
              </Button>
            </div>
          </AppCard>
        </section>

        <AppCard className={styles.adviceCard}>
          <div className={styles.sectionHead}>
            <div>
              <span className="hm-page-eyebrow">AI 建议</span>
              <h2 className="hm-section-title">最新健康建议</h2>
            </div>
            <Button className="hm-ghost-action" fill="outline" size="small" onClick={() => navigate("/ai-advice")}>
              查看详情
            </Button>
          </div>
          <p className={styles.adviceText}>
            {expanded || latestAdvice.length <= 84 ? latestAdvice : `${latestAdvice.slice(0, 84)}...`}
          </p>
          <div className={styles.adviceFooter}>
            <button className={styles.linkButton} onClick={() => setExpanded((value) => !value)} type="button">
              {expanded ? "收起建议" : "展开完整建议"}
            </button>
            <span>基于最近 7 天睡眠、任务完成率和记录习惯生成</span>
          </div>
        </AppCard>

        <AppCard title="今日任务">
          <div className={styles.taskList}>
            {!todayTasks.length && <EmptyState title="暂无今日任务" description="可进入 AI 建议页生成候选任务。" />}
            <StaggerList className={styles.taskListInner}>
              {todayTasks.map((task) => {
                const ratio = task.target ? (task.progress / task.target) * 100 : 0;
                return (
                  <Motion.article
                    key={task.id}
                    layout
                    whileTap={{ scale: 0.985 }}
                    className={`${styles.taskItem} ${task.completed ? styles.done : ""}`}
                  >
                    <div className={styles.taskTop}>
                      <div>
                        <h3>{task.title}</h3>
                        <p>{task.reason}</p>
                      </div>
                      <Button
                        size="small"
                        color={task.completed ? "success" : "primary"}
                        fill={task.completed ? "solid" : "outline"}
                        onClick={() => handleTaskToggle(task)}
                      >
                        {task.completed ? "已完成" : "去完成"}
                      </Button>
                    </div>
                    <div className={styles.taskMeta}>
                      <span>{task.category}</span>
                      <span>
                        {task.progress}/{task.target}
                        {task.unit}
                      </span>
                    </div>
                    <ProgressBar percent={Math.min(ratio, 100)} />
                  </Motion.article>
                );
              })}
            </StaggerList>
          </div>
        </AppCard>

        <section className={styles.quickGrid}>
          <AppCard className={styles.quickCard} glow>
            <span className="hm-page-eyebrow">快速记录</span>
            <h2 className="hm-section-title">记录今日状态</h2>
            <p className="hm-section-copy">输入睡眠、饮食、运动等信息，系统会解析为结构化记录。</p>
            <div className={styles.quickButtons}>
              <Button color="primary" onClick={() => navigate("/data-entry")}>
                记录今天状态
              </Button>
              <Button
                onClick={() =>
                  Toast.show({
                    content: "语音入口已预留，当前版本先用文字输入更稳定。",
                  })
                }
              >
                语音入口
              </Button>
            </div>
          </AppCard>

          <AppCard className={styles.entryCard}>
            <span className="hm-page-eyebrow">最近一次记录</span>
            <h2 className="hm-section-title">{recentEntries[0]?.mood || "暂无"}</h2>
            <p className={styles.entryText}>{recentEntries[0]?.summary || "暂无记录"}</p>
            <button className={`${styles.linkButton} ${styles.recordLink}`} onClick={() => navigate("/data-entry")} type="button">
              补充记录
            </button>
          </AppCard>
        </section>

        <section className={styles.trendGrid}>
          {trendHighlights.map((item) => (
            <AppCard key={item.title} className={styles.highlightCard}>
              <span className="hm-page-eyebrow">{item.title}</span>
              <strong>
                <AnimatedCounter to={item.value} suffix={item.suffix} decimal={item.decimal} duration={1} />
              </strong>
              <em>{item.delta}</em>
            </AppCard>
          ))}
        </section>
      </div>
    </PageTransition>
  );
}

export default DashboardPage;
