import { useMemo, useState } from "react";
import { Button, Selector } from "antd-mobile";
import AppCard from "../../components/common/AppCard";
import EChartPanel from "../../components/charts/EChartPanel";
import PageTransition from "../../components/common/PageTransition";
import { useAppStore } from "../../store/AppStore";
import { buildPieOption, buildSleepSeries, buildTrendOption } from "../../utils/chartOptions";
import styles from "./TrendsPage.module.css";

const dimensionOptions = [
  { label: "周", value: "week" },
  { label: "月", value: "month" },
];

function TrendsPage() {
  const [dimension, setDimension] = useState("week");
  const {
    state: { metrics },
  } = useAppStore();

  const currentMetrics = metrics[dimension];
  const sleepAverage = useMemo(() => {
    const total = currentMetrics.sleep.reduce((sum, value) => sum + value, 0);
    return (total / currentMetrics.sleep.length).toFixed(1);
  }, [currentMetrics]);
  const intakeAverage = useMemo(() => {
    const total = currentMetrics.intake.reduce((sum, value) => sum + value, 0);
    return Math.round(total / currentMetrics.intake.length);
  }, [currentMetrics]);
  const burnAverage = useMemo(() => {
    const total = currentMetrics.burn.reduce((sum, value) => sum + value, 0);
    return Math.round(total / currentMetrics.burn.length);
  }, [currentMetrics]);

  const sleepOption = useMemo(
    () =>
      buildTrendOption({
        title: dimension === "week" ? "近 7 天睡眠趋势" : "近 30 天睡眠趋势",
        categories: currentMetrics.categories,
        yName: "小时",
        series: buildSleepSeries(currentMetrics.sleep),
      }),
    [dimension, currentMetrics],
  );

  const calorieOption = useMemo(
    () =>
      buildTrendOption({
        title: "摄入 vs 消耗",
        categories: currentMetrics.categories,
        yName: "kcal",
        series: [
          { name: "摄入", type: "line", smooth: true, data: currentMetrics.intake },
          { name: "消耗", type: "line", smooth: true, data: currentMetrics.burn },
        ],
      }),
    [currentMetrics],
  );

  const pieOption = useMemo(() => buildPieOption(currentMetrics.tags), [currentMetrics.tags]);

  return (
    <PageTransition>
      <div className={styles.page}>
        <AppCard className={styles.heroCard}>
          <div className={styles.heroTop}>
            <div>
              <span className="hm-page-eyebrow">数据复盘</span>
              <h1>别把数据当成绩单，把它当提醒就够了</h1>
              <p>{currentMetrics.insight}</p>
            </div>
            <Selector options={dimensionOptions} value={[dimension]} onChange={(value) => setDimension(value[0])} columns={2} />
          </div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <strong>{sleepAverage}h</strong>
              <span>平均睡眠</span>
            </div>
            <div className={styles.summaryCard}>
              <strong>{intakeAverage} kcal</strong>
              <span>平均摄入</span>
            </div>
            <div className={styles.summaryCard}>
              <strong>{burnAverage} kcal</strong>
              <span>平均消耗</span>
            </div>
          </div>
        </AppCard>

        <section className={styles.grid}>
          <AppCard>
            <EChartPanel option={sleepOption} height={320} />
          </AppCard>
          <AppCard>
            <EChartPanel option={calorieOption} height={320} />
          </AppCard>
        </section>

        <section className={styles.bottomGrid}>
          <AppCard title="标签分布">
            <EChartPanel option={pieOption} height={240} />
          </AppCard>

          <AppCard title="温柔提醒">
            <div className={styles.noticeList}>
              {currentMetrics.notices.map((notice) => (
                <article key={notice} className={styles.noticeItem}>
                  <strong>提醒</strong>
                  <p>{notice}</p>
                </article>
              ))}
            </div>
            <Button fill="outline" size="small">
              导出数据
            </Button>
          </AppCard>
        </section>
      </div>
    </PageTransition>
  );
}

export default TrendsPage;
