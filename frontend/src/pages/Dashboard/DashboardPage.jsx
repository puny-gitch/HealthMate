import { Avatar, Button, ProgressBar, Toast } from "antd-mobile";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
import { useAppStore } from "../../store/AppStore";
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

  const todayTasks = useMemo(() => tasks.filter((task) => task.slot === "today"), [tasks]);
  const progress = useMemo(() => {
    const total = todayTasks.length || 1;
    const done = todayTasks.filter((task) => task.completed).length;
    return Math.round((done / total) * 100);
  }, [todayTasks]);

  const latestAdvice = recommendations[0]?.content ?? "今天的建议正在路上，我们先从一件简单的小事开始。";
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
    const total = metrics.week.sleep.reduce((sum, item) => sum + item, 0);
    return (total / metrics.week.sleep.length).toFixed(1);
  }, [metrics.week.sleep]);

  const trendHighlights = [
    { title: "睡眠", value: `${sleepAverage}h`, delta: "较上周 +0.4h", note: "恢复感在变好" },
    { title: "运动", value: "轻量达标", delta: "本周 4 天有活动", note: "保持而不是冲刺" },
    { title: "热量", value: "1880 kcal", delta: "整体平稳", note: "周末稍微高一些" },
  ];

  return (
    <PageTransition>
      <div className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroIntro}>
            <span className="hm-page-eyebrow">HealthMate Daily Brief</span>
            <h1>
              {getGreeting()}，{user.nickname}
              <span>你已经连续坚持 {user.streakDays} 天了。</span>
            </h1>
            <p>{completionMood.copy}</p>
            <div className={styles.heroMeta}>
              <span className="hm-soft-pill">目标：{user.goal}</span>
              <span className="hm-soft-pill">健康分 {user.healthScore}</span>
              <span className="hm-soft-pill">提醒：{user.reminder}</span>
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
                      onClick={() => {
                        actions.toggleTask(task.id);
                        Toast.show({ content: task.completed ? "已恢复为待完成" : "完成得很好，继续保持" });
                      }}
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
            <p className={styles.entryText}>{recentEntries[0]?.summary}</p>
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
