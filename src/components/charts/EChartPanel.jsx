import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import "echarts-wordcloud";
import styles from "./EChartPanel.module.css";

function EChartPanel({ option, height = 260 }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    // 图表实例生命周期：初始化 -> 监听 resize -> 卸载时销毁，避免内存泄漏。
    chartRef.current = echarts.init(containerRef.current);
    const chart = chartRef.current;
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    if (chartRef.current && option) {
      chartRef.current.setOption(option, true);
    }
  }, [option]);

  return <div ref={containerRef} className={styles.chart} style={{ height }} />;
}

export default EChartPanel;
