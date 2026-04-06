export const weekDays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
export const monthDays = Array.from({ length: 30 }, (_, i) => `${i + 1}日`);

const axisStyle = {
  axisLine: { lineStyle: { color: "#c8d3dc" } },
  axisLabel: { color: "#5b6776" },
  splitLine: { lineStyle: { color: "rgba(64,158,255,0.08)" } },
};

export function buildTrendOption({ title, categories, series, yName = "" }) {
  return {
    color: ["#409EFF", "#67C23A", "#f56c6c"],
    tooltip: { trigger: "axis" },
    grid: { left: 16, right: 16, top: 52, bottom: 18, containLabel: true },
    title: {
      text: title,
      left: 10,
      top: 10,
      textStyle: { fontSize: 14, color: "#1f2d3d", fontWeight: 600 },
    },
    xAxis: { type: "category", data: categories, ...axisStyle },
    yAxis: { type: "value", name: yName, ...axisStyle },
    series,
  };
}

export function buildSleepSeries(data) {
  return [
    {
      name: "睡眠时长",
      type: "line",
      smooth: true,
      data,
      symbolSize: 9,
      lineStyle: { width: 3 },
      itemStyle: {
        color: (params) => (params.value < 6 ? "#f56c6c" : "#409EFF"),
      },
      markLine: {
        silent: true,
        lineStyle: { color: "#f56c6c", type: "dashed" },
        data: [{ yAxis: 6, name: "低于 6 小时预警" }],
      },
    },
  ];
}

export function buildPieOption(data) {
  return {
    tooltip: { trigger: "item" },
    legend: { bottom: 4 },
    series: [
      {
        name: "健康标签",
        type: "pie",
        radius: ["45%", "72%"],
        itemStyle: {
          borderColor: "#fff",
          borderWidth: 2,
        },
        data,
      },
    ],
  };
}

export function buildWordCloudOption(data) {
  return {
    tooltip: { show: true },
    series: [
      {
        type: "wordCloud",
        shape: "circle",
        width: "100%",
        height: "100%",
        sizeRange: [12, 38],
        rotationRange: [-45, 45],
        gridSize: 8,
        textStyle: {
          color: () => ["#409EFF", "#67C23A", "#7cb7ff", "#2c7be5", "#3b9f7d"][Math.floor(Math.random() * 5)],
        },
        data,
      },
    ],
  };
}
