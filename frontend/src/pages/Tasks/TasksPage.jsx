import { useEffect, useMemo, useState } from "react";
import { Button, ProgressBar, Selector, Toast } from "antd-mobile";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
import { useAppStore } from "../../store/AppStore";
import { taskApi } from "../../services/api";
import { mapTask } from "../../utils/backendMappers";
import styles from "./TasksPage.module.css";

const options = [
  { label: "今日", value: "today" },
  { label: "本周", value: "week" },
  { label: "历史", value: "history" },
];

function TasksPage() {
  const [filter, setFilter] = useState("today");
  const {
    state: { tasks, user },
    actions,
  } = useAppStore();
  const [completionRate, setCompletionRate] = useState(0);

  const refreshTasks = async () => {
    const [todayResult, historyResult] = await Promise.allSettled([taskApi.today(), taskApi.history()]);
    const today = todayResult.status === "fulfilled" ? todayResult.value.tasks || [] : [];
    const history = historyResult.status === "fulfilled" ? historyResult.value.tasks || [] : [];
    const todayIds = new Set(today.map((task) => task.taskId));
    const merged = [
      ...today.map((task) => mapTask(task, "today")),
      ...history.filter((task) => !todayIds.has(task.taskId)).map((task) => mapTask(task, "history")),
    ];
    actions.setTasks(merged);
    if (todayResult.status === "fulfilled") setCompletionRate(todayResult.value.completionRate || 0);
  };

  useEffect(() => {
    let active = true;
    Promise.allSettled([taskApi.today(), taskApi.history()]).then(([todayResult, historyResult]) => {
      if (!active) return;
      const today = todayResult.status === "fulfilled" ? todayResult.value.tasks || [] : [];
      const history = historyResult.status === "fulfilled" ? historyResult.value.tasks || [] : [];
      const todayIds = new Set(today.map((task) => task.taskId));
      const merged = [
        ...today.map((task) => mapTask(task, "today")),
        ...history.filter((task) => !todayIds.has(task.taskId)).map((task) => mapTask(task, "history")),
      ];
      actions.setTasks(merged);
      if (todayResult.status === "fulfilled") setCompletionRate(todayResult.value.completionRate || 0);
    });

    return () => {
      active = false;
    };
  }, [actions]);

  const todayTasks = useMemo(() => tasks.filter((task) => task.slot === "today"), [tasks]);
  const list = useMemo(() => {
    if (filter === "today") return todayTasks;
    if (filter === "history") return tasks.filter((task) => task.slot !== "today");
    return tasks;
  }, [tasks, filter, todayTasks]);

  const completion = useMemo(() => {
    if (completionRate) return completionRate;
    const total = todayTasks.length || 1;
    const done = todayTasks.filter((task) => task.completed).length;
    return Math.round((done / total) * 100);
  }, [completionRate, todayTasks]);

  const summary =
    completion >= 80
      ? "今天很稳，适合保持，不用再额外加码。"
      : completion >= 40
        ? "已经有行动了，再完成一项就会很舒服。"
        : "别着急补作业，先完成最轻的一件事就好。";

  const handleTaskToggle = async (task) => {
    const nextCompleted = !task.completed;
    try {
      await taskApi.check({ taskId: task.id, status: nextCompleted ? 1 : 0 });
      await refreshTasks();
      Toast.show({ content: nextCompleted ? "已完成" : "已恢复为未完成" });
    } catch (error) {
      Toast.show({ content: error.message || "任务更新失败" });
    }
  };

  return (
    <PageTransition>
      <div className={styles.page}>
        <AppCard className={styles.heroCard}>
          <span className="hm-page-eyebrow">行为闭环</span>
          <div className={styles.heroTop}>
            <div>
              <h1>任务不是负担，是把目标拆小一点</h1>
              <p>{summary}</p>
            </div>
            <div className={styles.streakCard}>
              <strong>{completion}%</strong>
              <span>今日完成率</span>
              <em>{user.goal}</em>
            </div>
          </div>
          <ProgressBar percent={completion} />
        </AppCard>

        <AppCard title="查看范围">
          <Selector options={options} value={[filter]} onChange={(value) => setFilter(value[0])} columns={3} />
        </AppCard>

        <div className={styles.cards}>
          {list.map((task) => {
            const ratio = task.target ? (task.progress / task.target) * 100 : 0;
            return (
              <article key={task.id} className={`${styles.taskCard} ${task.completed ? styles.done : ""}`}>
                <div className={styles.taskBody}>
                  <div className={styles.taskHeader}>
                    <span className={styles.category}>{task.category}</span>
                    <span className={styles.date}>{task.date}</span>
                  </div>
                  <h3>{task.title}</h3>
                  <p>AI 缘由：{task.reason}</p>
                  <div className={styles.progressRow}>
                    <span>
                      {task.progress}/{task.target}
                      {task.unit}
                    </span>
                    <span>{Math.round(Math.min(ratio, 100))}%</span>
                  </div>
                  <ProgressBar percent={Math.min(ratio, 100)} />
                </div>

                <Button
                  size="small"
                  color={task.completed ? "success" : "primary"}
                  className={styles.checkBtn}
                  onClick={() => {
                    handleTaskToggle(task);
                  }}
                >
                  {task.completed ? "已完成" : "去打卡"}
                </Button>
              </article>
            );
          })}
          {!list.length && <AppCard title="暂无任务">进入 AI 建议页生成今日建议后，后端会同步创建任务。</AppCard>}
        </div>

        <AppCard title="今天的小结">
          <p className={styles.summary}>{summary}</p>
        </AppCard>
      </div>
    </PageTransition>
  );
}

export default TasksPage;
