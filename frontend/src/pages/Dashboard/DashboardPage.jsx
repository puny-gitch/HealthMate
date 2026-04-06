import { Avatar, Button, ProgressCircle } from "antd-mobile";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
import EChartPanel from "../../components/charts/EChartPanel";
import { useAppStore } from "../../store/AppStore";
import { buildSleepSeries, buildTrendOption, weekDays } from "../../utils/chartOptions";
import styles from "./DashboardPage.module.css";

const sleepData = [7.2, 6.4, 5.8, 7.1, 6.2, 7.5, 6.8];
const intakeData = [1850, 2100, 2080, 1760, 1900, 2200, 1980];
const burnData = [1650, 1780, 1820, 1680, 1750, 1950, 1850];

function DashboardPage() {
  const navigate = useNavigate();
  const {
    state: { user, tasks },
  } = useAppStore();

  const progress = useMemo(() => {
    const total = tasks.filter((task) => task.date === "today").length || 1;
    const done = tasks.filter((task) => task.date === "today" && task.completed).length;
    return Math.round((done / total) * 100);
  }, [tasks]);

  const sleepOption = buildTrendOption({
    title: "近 7 天睡眠时长趋势",
    categories: weekDays,
    yName: "小时",
    series: buildSleepSeries(sleepData),
  });

  const calorieOption = buildTrendOption({
    title: "近 7 天热量摄入/消耗",
    categories: weekDays,
    yName: "kcal",
    series: [
      { name: "摄入", type: "line", smooth: true, data: intakeData },
      { name: "消耗", type: "line", smooth: true, data: burnData },
    ],
  });

  return (
    <PageTransition>
      <div className={styles.page}>
        <AppCard className={styles.profileCard}>
          <div className={styles.profileTop}>
            <Avatar src={user.avatar} style={{ "--size": "54px" }} />
            <div>
              <h2>{user.nickname}</h2>
              <p>当前目标：{user.goal}</p>
            </div>
          </div>
          <div className={styles.progressWrap}>
            <ProgressCircle percent={progress} style={{ "--size": "92px", "--track-width": "10px" }}>
              <span>{progress}%</span>
            </ProgressCircle>
            <div>
              <h4>今日任务完成率</h4>
              <p>继续保持你的节奏，身体正在给出正反馈。</p>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <EChartPanel option={sleepOption} />
        </AppCard>
        <AppCard>
          <EChartPanel option={calorieOption} />
        </AppCard>

        <div className={styles.quickActions}>
          <Button color="primary" size="large" block onClick={() => navigate("/data-entry")}>
            立即录入健康数据
          </Button>
          <div className={styles.links}>
            <span onClick={() => navigate("/ai-advice")}>查看今日 AI 建议</span>
            <span onClick={() => navigate("/tasks")}>我的打卡任务</span>
            <span onClick={() => navigate("/trends")}>健康趋势分析</span>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

export default DashboardPage;
