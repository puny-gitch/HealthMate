import { Avatar, Button, ProgressBar, Toast } from "antd-mobile";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
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
      if (dashboardResult.status === "fulfilled") {
        setCompletionRate(dashboardResult.value.completionRate || 0);
        actions.setMetrics("week", mapTrend(dashboardResult.value));
      }
      if (taskResult.status === "fulfilled") {
        actions.setTasks((taskResult.value.tasks || []).map((task) => mapTask(task, "today")));
        setCompletionRate(taskResult.value.completionRate || 0);
      }
      if (recordResult.status === "fulfilled") {
        actions.setRecentEntries((recordResult.value.records || []).map(mapHealthRecord));
      }
      if (adviceResult.status === "fulfilled") {
        actions.setRecommendations(
          (adviceResult.value || []).map((item) => ({
            content: item.adviceText,
            time: item.createdAt,
          })),
        );
      }
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

  const latestAdvice = recommendations[0]?.content ?? "暂无后端 AI 建议，进入 AI 建议页生成今日建议。";
  const completionMood =
    progress >= 80
      ? {
          label: "状态很稳",
          copy: "今天的执行感不错，继续按这个节奏走，身体会给你很温柔的反馈。",
        }
      : progress >= 40
        ? {
            label: "节奏在线",
            copy: "已经有开始行动的感觉了，再完成一件小任务，今天就很完整。",
          }
        : {
            label: "慢慢来就好",
            copy: "不用追求一口气做很多，我们先把最容易的一件事完成。",
          };

  const sleepAverage = useMemo(() => {
    if (!metrics.week.sleep.length) return "0.0";
    const total = metrics.week.sleep.reduce((sum, item) => sum + item, 0);
    return (total / metrics.week.sleep.length).toFixed(1);
  }, [metrics.week.sleep]);

  const trendHighlights = [
    { title: "睡眠", value: `${sleepAverage}h`, delta: "近 7 天平均", note: metrics.week.insight },
    {
      title: "摄入",
      value: `${metrics.week.intake.at(-1) || 0} kcal`,
      delta: "最近一次记录",
      note: "来自后端健康记录",
    },
    {
      title: "消耗",
      value: `${metrics.week.burn.at(-1) || 0} kcal`,
      delta: "最近一次记录",
      note: "来自后端健康记录",
    },
  ];

  const handleTaskToggle = async (task) => {
    const nextCompleted = !task.completed;
    try {
      await taskApi.check({ taskId: task.id, status: nextCompleted ? 1 : 0 });
      await refreshTodayTasks();
      Toast.show({ content: nextCompleted ? "已完成" : "已恢复为待完成" });
    } catch (error) {
      Toast.show({ content: error.message || "任务更新失败" });
    }
  };

  return (
    <PageTransition>
      <div className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroIntro}>
            <span className="hm-page-eyebrow">HealthMate Daily Brief</span>
            <h1>
              {getGreeting()}，{user.nickname}
              <span>当前目标：{user.goal}</span>
            </h1>
            <p>{completionMood.copy}</p>
            <div className={styles.heroMeta}>
              <span className="hm-soft-pill">目标：{user.goal}</span>
              <span className="hm-soft-pill">近期记录 {recentEntries.length} 条</span>
              <span className="hm-soft-pill">今日任务 {todayTasks.length} 项</span>
            </div>
          </div>

          <AppCard className={styles.scoreCard}>
            <div className={styles.scoreHeader}>
              <Avatar src={user.avatar} style={{ "--size": "54px" }} />
              <div>
                <strong>{completionMood.label}</strong>
                <span>今天的健康节奏在这里</span>
              </div>
            </div>
            <div className={styles.scoreValue}>{progress}%</div>
            <ProgressBar percent={progress} />
            <div className={styles.scoreFoot}>
              <span>
                已完成 {todayTasks.filter((task) => task.completed).length} / {todayTasks.length} 个任务
              </span>
              <Button fill="none" size="small" onClick={() => navigate("/tasks")}>
                查看全部
              </Button>
            </div>
          </AppCard>
        </section>

        <AppCard className={styles.adviceCard}>
          <div className={styles.sectionHead}>
            <div>
              <span className="hm-page-eyebrow">AI 陪伴建议</span>
              <h2 className="hm-section-title">今天先做小调整，不需要太用力</h2>
            </div>
            <Button fill="none" size="small" onClick={() => navigate("/ai-advice")}>
              沉浸查看
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

        <AppCard>
          <div className={styles.sectionHead}>
            <div>
              <span className="hm-page-eyebrow">今日任务</span>
              <h2 className="hm-section-title">轻一点，也能形成闭环</h2>
            </div>
          </div>
          <div className={styles.taskList}>
            {!todayTasks.length && <p className="hm-section-copy">暂无后端任务，进入 AI 建议页可生成今日任务。</p>}
            {todayTasks.map((task) => {
              const ratio = task.target ? (task.progress / task.target) * 100 : 0;
              return (
                <article key={task.id} className={`${styles.taskItem} ${task.completed ? styles.done : ""}`}>
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
                </article>
              );
            })}
          </div>
        </AppCard>

        <section className={styles.quickGrid}>
          <AppCard className={styles.quickCard}>
            <span className="hm-page-eyebrow">快速记录</span>
            <h2 className="hm-section-title">随手说一句，也算认真照顾自己</h2>
            <p className="hm-section-copy">少输入一点，反而更容易坚持。你可以打字，也可以先从一句简单的话开始。</p>
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
            <h2 className="hm-section-title">{recentEntries[0]?.mood}</h2>
            <p className={styles.entryText}>{recentEntries[0]?.summary || "暂无后端健康记录"}</p>
            <button className={styles.linkButton} onClick={() => navigate("/data-entry")} type="button">
              继续补充今天的感受
            </button>
          </AppCard>
        </section>

        <section className={styles.trendGrid}>
          {trendHighlights.map((item) => (
            <AppCard key={item.title} className={styles.highlightCard}>
              <span className="hm-page-eyebrow">{item.title}</span>
              <strong>{item.value}</strong>
              <em>{item.delta}</em>
              <p>{item.note}</p>
            </AppCard>
          ))}
        </section>
      </div>
    </PageTransition>
  );
}

export default DashboardPage;
