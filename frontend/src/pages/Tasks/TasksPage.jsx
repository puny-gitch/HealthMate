import { useEffect, useMemo, useState } from "react";
import { Button, ProgressBar, Selector, Toast } from "antd-mobile";
import AppCard from "../../components/common/AppCard";
import AnimatedCounter from "../../components/common/AnimatedCounter";
import PageTransition from "../../components/common/PageTransition";
import StaggerList from "../../components/common/StaggerList";
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
    state: { tasks },
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

  const doneCount = todayTasks.filter((task) => task.completed).length;
  const pendingCount = Math.max(todayTasks.length - doneCount, 0);
  const summary = `今日 ${todayTasks.length} 项，已完成 ${doneCount} 项。`;

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
          <div className={styles.overviewHead}>
            <div>
              <span className="hm-page-eyebrow">任务概览</span>
              <h1>健康任务</h1>
              <p>{summary}</p>
            </div>
            <Selector
              className={styles.scopeSelector}
              options={options}
              value={[filter]}
              onChange={(value) => {
                if (value[0]) setFilter(value[0]);
              }}
              columns={3}
            />
          </div>
          <div className={styles.overviewGrid}>
            <div className={styles.overviewMetric}>
              <strong>
                <AnimatedCounter to={completion} suffix="%" duration={0.8} />
              </strong>
              <span>进度</span>
            </div>
            <div className={styles.overviewMetric}>
              <strong>
                <AnimatedCounter to={pendingCount} duration={0.6} />
              </strong>
              <span>待完成</span>
            </div>
            <div className={styles.overviewMetric}>
              <strong>
                <AnimatedCounter to={list.length} duration={0.6} />
              </strong>
              <span>当前列表</span>
            </div>
          </div>
          <ProgressBar percent={completion} />
        </AppCard>

        <div className={styles.cards}>
          <StaggerList>
            {list.map((task) => {
              const ratio = task.target ? (task.progress / task.target) * 100 : 0;
              return (
                <article key={task.id} className={`${styles.taskCard} ${task.completed ? styles.done : ""}`}>
                  <div className={styles.taskTop}>
                    <div>
                      <h3>{task.title}</h3>
                      <p>{task.reason}</p>
                    </div>
                    <Button
                      size="small"
                      color={task.completed ? "success" : "primary"}
                      fill={task.completed ? "solid" : "outline"}
                      className={styles.checkBtn}
                      onClick={() => {
                        handleTaskToggle(task);
                      }}
                    >
                      {task.completed ? "已完成" : "去打卡"}
                    </Button>
                  </div>
                  <div className={styles.taskMeta}>
                    <span>{task.category}</span>
                    <span>{task.date}</span>
                    <span>
                      {task.progress}/{task.target}
                      {task.unit}
                    </span>
                    <span>{Math.round(Math.min(ratio, 100))}%</span>
                  </div>
                  <ProgressBar percent={Math.min(ratio, 100)} />
                </article>
              );
            })}
          </StaggerList>
          {!list.length && <AppCard title="暂无任务">可在 AI 建议页生成候选任务并选择加入。</AppCard>}
        </div>
      </div>
    </PageTransition>
  );
}

export default TasksPage;
