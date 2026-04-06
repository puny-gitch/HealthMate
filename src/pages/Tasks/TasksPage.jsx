import { useMemo, useState } from "react";
import { Button, Selector, Toast } from "antd-mobile";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
import { useAppStore } from "../../store/AppStore";
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

  const list = useMemo(() => tasks.filter((task) => (filter === "history" ? true : task.date === filter || task.date === "today")), [tasks, filter]);
  const completion = useMemo(() => {
    const total = list.length || 1;
    const done = list.filter((task) => task.completed).length;
    return Math.round((done / total) * 100);
  }, [list]);

  return (
    <PageTransition>
      <div className={styles.page}>
        <AppCard title="任务打卡">
          <Selector options={options} value={[filter]} onChange={(value) => setFilter(value[0])} columns={3} />
        </AppCard>

        <div className={styles.cards}>
          {list.map((task) => (
            <article key={task.id} className={`${styles.taskCard} ${task.completed ? styles.done : ""}`}>
              <div>
                <h3>{task.title}</h3>
                <p>AI 缘由：{task.reason}</p>
              </div>
              <Button
                size="small"
                color={task.completed ? "default" : "primary"}
                className={styles.checkBtn}
                onClick={() => {
                  actions.toggleTask(task.id);
                  Toast.show({ content: task.completed ? "已取消打卡" : "打卡成功" });
                }}
              >
                {task.completed ? "取消打卡" : "立即打卡"}
              </Button>
            </article>
          ))}
        </div>

        <AppCard title="完成率统计">
          <p className={styles.summary}>本周完成率 {completion}%，{completion >= 80 ? "继续保持！" : "再加把劲，你可以做得更好！"}</p>
        </AppCard>
      </div>
    </PageTransition>
  );
}

export default TasksPage;
