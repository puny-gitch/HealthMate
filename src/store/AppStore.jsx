/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState } from "react";

const AppStoreContext = createContext(null);

const mockTasks = [
  { id: "t1", title: "晚饭后快走 30 分钟", reason: "有助于提升热量消耗，降低血糖波动", completed: false, date: "today" },
  { id: "t2", title: "23:30 前入睡", reason: "改善深睡比例，减少白天疲劳", completed: true, date: "today" },
  { id: "t3", title: "少糖饮食 1 天", reason: "近 7 天高糖摄入偏多", completed: false, date: "week" },
];

const initialState = {
  token: localStorage.getItem("healthmate_token") || "",
  user: {
    avatar: "https://api.dicebear.com/7.x/notionists/svg?seed=HealthMate",
    nickname: "健康伙伴",
    account: "",
    height: 172,
    weight: 67,
    goal: "改善睡眠",
    hasProfile: false,
  },
  tasks: mockTasks,
  recommendations: [],
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
          tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task)),
        }));
      },
      addRecommendation(content) {
        setState((prev) => ({ ...prev, recommendations: [{ content, time: new Date().toISOString() }, ...prev.recommendations] }));
      },
      addTask(task) {
        setState((prev) => ({ ...prev, tasks: [task, ...prev.tasks] }));
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
