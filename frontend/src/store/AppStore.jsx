/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from "react";

const AppStoreContext = createContext(null);

const emptyMetrics = {
  categories: [],
  sleep: [],
  intake: [],
  burn: [],
  tags: [],
  insight: "暂无健康记录，先完成一次记录后再查看趋势。",
  notices: ["暂无健康记录"],
};

const initialState = {
  token: localStorage.getItem("healthmate_token") || "",
  user: {
    userId: null,
    username: "",
    nickname: "用户",
    gender: null,
    height: null,
    weight: null,
    goal: "保持健康",
    hasProfile: false,
    streakDays: 0,
    healthScore: 0,
    reminder: "暂无后端提醒",
    medicalHistory: "暂无",
  },
  tasks: [],
  recommendations: [],
  recentEntries: [],
  metrics: {
    week: emptyMetrics,
    month: emptyMetrics,
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
        setState({ ...initialState, token: "", tasks: [], recommendations: [], recentEntries: [] });
      },
      updateUser(payload) {
        setState((prev) => ({ ...prev, user: { ...prev.user, ...payload } }));
      },
      setTasks(tasks) {
        setState((prev) => ({ ...prev, tasks }));
      },
      toggleTask(taskId, completed) {
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  completed,
                  progress: completed ? task.target : task.baseProgress,
                }
              : task,
          ),
        }));
      },
      setRecommendations(recommendations) {
        setState((prev) => ({ ...prev, recommendations }));
      },
      addRecommendation(content) {
        setState((prev) => ({
          ...prev,
          recommendations: [{ content, time: new Date().toISOString() }, ...prev.recommendations],
        }));
      },
      addTasks(tasks) {
        setState((prev) => {
          const merged = new Map(prev.tasks.map((task) => [task.id, task]));
          tasks.forEach((task) => {
            merged.set(task.id, { ...merged.get(task.id), ...task });
          });
          return { ...prev, tasks: Array.from(merged.values()) };
        });
      },
      setRecentEntries(recentEntries) {
        setState((prev) => ({ ...prev, recentEntries }));
      },
      addEntry(entry) {
        setState((prev) => ({
          ...prev,
          recentEntries: [{ id: `entry-${Date.now()}`, ...entry }, ...prev.recentEntries].slice(0, 6),
        }));
      },
      setMetrics(dimension, metrics) {
        setState((prev) => ({
          ...prev,
          metrics: {
            ...prev.metrics,
            [dimension]: metrics,
          },
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
