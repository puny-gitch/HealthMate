/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from "react";

const AppStoreContext = createContext(null);

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const twoDaysAgo = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10);

const mockTasks = [
  {
    id: "t1",
    title: "喝水 2L",
    reason: "你下午容易疲惫，先把补水节奏找回来。",
    completed: false,
    date: today,
    slot: "today",
    category: "补水",
    progress: 6,
    baseProgress: 6,
    target: 8,
    unit: "杯",
  },
  {
    id: "t2",
    title: "23:30 前入睡",
    reason: "最近睡眠波动稍大，连续 3 天稳定早睡会更舒服。",
    completed: true,
    date: today,
    slot: "today",
    category: "睡眠",
    progress: 1,
    baseProgress: 0,
    target: 1,
    unit: "次",
  },
  {
    id: "t3",
    title: "晚饭后快走 20 分钟",
    reason: "今天不用做很猛的训练，轻一点也能把身体带起来。",
    completed: false,
    date: today,
    slot: "today",
    category: "运动",
    progress: 8,
    baseProgress: 8,
    target: 20,
    unit: "分钟",
  },
  {
    id: "t4",
    title: "下午茶换成无糖酸奶",
    reason: "最近甜食偏多，用更轻松的替代法比较容易坚持。",
    completed: true,
    date: yesterday,
    slot: "history",
    category: "饮食",
    progress: 1,
    baseProgress: 0,
    target: 1,
    unit: "次",
  },
  {
    id: "t5",
    title: "午间拉伸 5 分钟",
    reason: "久坐会让疲劳更明显，简单活动一下就很好。",
    completed: false,
    date: twoDaysAgo,
    slot: "history",
    category: "恢复",
    progress: 0,
    baseProgress: 0,
    target: 5,
    unit: "分钟",
  },
];

const initialRecommendations = [
  {
    content:
      "你这两天的节奏其实不错，今晚只要把入睡时间再提前一点点，整个人会轻很多。先别追求完美，我们把『早睡 + 轻运动』守住就很棒。",
    time: new Date().toISOString(),
  },
];

const initialEntries = [
  {
    id: "e1",
    summary: "晚饭后快走 25 分钟，吃了沙拉和鸡胸肉，状态还不错。",
    date: today,
    mood: "轻盈",
  },
  {
    id: "e2",
    summary: "昨天睡了 6.2 小时，下午有点困，奶茶喝了一杯。",
    date: yesterday,
    mood: "需要恢复",
  },
];

const initialState = {
  token: localStorage.getItem("healthmate_token") || "",
  user: {
    avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=HealthMate",
    nickname: "小宇",
    account: "xiaoyu",
    height: 172,
    weight: 67,
    goal: "改善睡眠",
    hasProfile: true,
    streakDays: 3,
    healthScore: 86,
    reminder: "23:10 放下手机，准备休息",
    medicalHistory: "无特殊病史",
  },
  tasks: mockTasks,
  recommendations: initialRecommendations,
  recentEntries: initialEntries,
  metrics: {
    week: {
      categories: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
      sleep: [6.1, 6.4, 6.8, 7.2, 6.6, 7.4, 7.1],
      intake: [1820, 1940, 1760, 1850, 2010, 1920, 1880],
      burn: [1660, 1710, 1800, 1730, 1690, 1900, 1840],
      tags: [
        { name: "稳定作息", value: 5 },
        { name: "轻运动", value: 4 },
        { name: "补水", value: 3 },
        { name: "少糖", value: 2 },
      ],
      insight: "最近睡眠有回升，但运动量比上周少了一点，保持轻运动就会更稳。",
      notices: ["昨天睡眠 6.1h，今晚尽量 23:30 前休息", "周末摄入偏高，今天适合清爽一点"],
    },
    month: {
      categories: Array.from({ length: 30 }, (_, index) => `${index + 1}日`),
      sleep: [6.3, 6.1, 6.4, 6.6, 6.5, 6.8, 6.9, 6.2, 6.4, 6.7, 6.9, 7.1, 6.8, 6.4, 6.6, 6.5, 6.9, 7.2, 7.0, 6.8, 6.7, 6.9, 7.1, 7.3, 6.8, 6.6, 6.9, 7.0, 7.2, 7.1],
      intake: [1890, 1780, 1850, 1930, 1760, 1810, 1880, 1960, 1840, 1770, 1800, 1860, 1910, 1980, 1790, 1830, 1870, 1900, 1940, 1880, 1800, 1760, 1820, 1890, 1930, 1860, 1790, 1840, 1880, 1910],
      burn: [1710, 1680, 1750, 1790, 1700, 1670, 1740, 1810, 1760, 1690, 1710, 1780, 1800, 1830, 1720, 1740, 1770, 1790, 1820, 1760, 1710, 1700, 1730, 1780, 1800, 1770, 1720, 1750, 1790, 1810],
      tags: [
        { name: "作息改善", value: 12 },
        { name: "蛋白补充", value: 8 },
        { name: "散步", value: 10 },
        { name: "高糖提醒", value: 4 },
      ],
      insight: "这个月整体更稳定了，最值得继续的是睡眠回升和晚饭后活动。",
      notices: ["过去 30 天中有 6 天睡眠低于 6.5h", "高糖摄入主要集中在周末，可以提前准备替代零食"],
    },
  },
};

export function AppStoreProvider({ children }) {
  const [state, setState] = useState(initialState);

  const actions = useMemo(
    () => ({
      setToken(token) {
        localStorage.setItem("healthmate_token", token);
        setState((prev) => ({ ...prev, token }));
      },
      logout() {
        localStorage.removeItem("healthmate_token");
        setState((prev) => ({ ...prev, token: "" }));
      },
      updateUser(payload) {
        setState((prev) => ({ ...prev, user: { ...prev.user, ...payload } }));
      },
      toggleTask(taskId) {
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  completed: !task.completed,
                  progress: task.completed ? task.baseProgress : task.target,
                }
              : task,
          ),
        }));
      },
      addRecommendation(content) {
        setState((prev) => ({
          ...prev,
          recommendations: [{ content, time: new Date().toISOString() }, ...prev.recommendations],
        }));
      },
      addTask(task) {
        setState((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
      },
      addEntry(entry) {
        setState((prev) => ({
          ...prev,
          recentEntries: [{ id: `entry-${Date.now()}`, ...entry }, ...prev.recentEntries].slice(0, 6),
        }));
      },
    }),
    [],
  );

  return <AppStoreContext.Provider value={{ state, actions }}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error("useAppStore 必须在 AppStoreProvider 内使用");
  }
  return context;
}
