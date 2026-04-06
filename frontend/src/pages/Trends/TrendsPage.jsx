import { Button, DatePicker, Selector, Toast } from "antd-mobile";
import { useMemo, useState } from "react";
import AppCard from "../../components/common/AppCard";
import EChartPanel from "../../components/charts/EChartPanel";
import PageTransition from "../../components/common/PageTransition";
import { buildPieOption, buildSleepSeries, buildTrendOption, buildWordCloudOption, monthDays, weekDays } from "../../utils/chartOptions";
import styles from "./TrendsPage.module.css";

const dimensionOptions = [
  { label: "周", value: "week" },
  { label: "月", value: "month" },
];

const trendTypeOptions = [
  { label: "睡眠", value: "sleep" },
  { label: "热量", value: "calorie" },
  { label: "运动", value: "exercise" },
];

function TrendsPage() {
  const [dimension, setDimension] = useState("week");
  const [trendType, setTrendType] = useState("sleep");
  const [dateVisible, setDateVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const categories = dimension === "week" ? weekDays : monthDays;
  const trendData = useMemo(() => {
    const count = categories.length;
    const sleep = Array.from({ length: count }, (_, i) => Number((6 + Math.sin(i / 2) * 1.5 + 1).toFixed(1)));
    const intake = Array.from({ length: count }, (_, i) => 1700 + ((i * 97) % 500) + i * 3);
    const burn = Array.from({ length: count }, (_, i) => 1500 + ((i * 79) % 450) + i * 4);
    const exercise = Array.from({ length: count }, (_, i) => 200 + ((i * 67) % 380));
    return { sleep, intake, burn, exercise };
  }, [categories.length]);

  const trendOption = useMemo(() => {
    if (trendType === "sleep") {
      return buildTrendOption({
        title: `${dimension === "week" ? "近 7 天" : "近 30 天"}睡眠趋势`,
        categories,
        yName: "小时",
        series: buildSleepSeries(trendData.sleep),
      });
    }
    if (trendType === "calorie") {
      return buildTrendOption({
        title: "热量摄入/消耗趋势",
        categories,
        yName: "kcal",
        series: [
          { name: "摄入", type: "line", smooth: true, data: trendData.intake },
          { name: "消耗", type: "line", smooth: true, data: trendData.burn },
        ],
      });
    }
    return buildTrendOption({
      title: "运动热量趋势",
      categories,
      yName: "kcal",
      series: [{ name: "运动消耗", type: "line", smooth: true, data: trendData.exercise }],
    });
  }, [dimension, trendType, categories, trendData]);

  const pieOption = buildPieOption([
    { name: "睡眠不足", value: 3 },
    { name: "高糖摄入", value: 3 },
    { name: "运动达标", value: 5 },
    { name: "作息稳定", value: 4 },
  ]);

  const wordCloudOption = buildWordCloudOption([
    { name: "低糖饮食", value: 80 },
    { name: "稳定作息", value: 68 },
    { name: "快走", value: 54 },
    { name: "深睡眠", value: 42 },
    { name: "减压", value: 34 },
    { name: "补水", value: 30 },
  ]);

  return (
    <PageTransition>
      <div className={styles.page}>
        <AppCard title="健康数据可视化趋势">
          <div className={styles.filters}>
            <Selector options={dimensionOptions} value={[dimension]} onChange={(v) => setDimension(v[0])} columns={2} />
            <Selector options={trendTypeOptions} value={[trendType]} onChange={(v) => setTrendType(v[0])} columns={3} />
            <Button size="small" onClick={() => setDateVisible(true)}>
              日期筛选
            </Button>
            <Button size="small" color="primary" fill="outline" onClick={() => Toast.show({ content: "数据导出接口待接入" })}>
              数据导出
            </Button>
          </div>
        </AppCard>

        <section className={styles.grid}>
          <AppCard className={styles.left}>
            <EChartPanel option={trendOption} height={360} />
          </AppCard>
          <div className={styles.right}>
            <AppCard title="健康标签分布">
              <EChartPanel option={pieOption} height={240} />
            </AppCard>
            <AppCard title="健康关键词词云">
              <EChartPanel option={wordCloudOption} height={220} />
            </AppCard>
            <AppCard title="统计结论">
              <p className={styles.note}>近 7 天你有 3 天摄入高糖，建议减少甜食并用坚果替换高糖零食。</p>
            </AppCard>
          </div>
        </section>

        <DatePicker
          visible={dateVisible}
          value={selectedDate}
          onClose={() => setDateVisible(false)}
          onConfirm={(date) => setSelectedDate(date)}
          title="选择日期"
        />
      </div>
    </PageTransition>
  );
}

export default TrendsPage;
