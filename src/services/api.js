import http from "./http";

// 以下方法为接口占位，保持参数结构稳定，后续可直接联调后端。
export const authApi = {
  login: (payload) => http.post("/auth/login", payload),
  register: (payload) => http.post("/auth/register", payload),
};

export const profileApi = {
  saveProfile: (payload) => http.post("/profile", payload),
  updateProfile: (payload) => http.put("/profile", payload),
};

export const healthApi = {
  submitData: (payload) => http.post("/health/data", payload),
  getDashboard: () => http.get("/health/dashboard"),
  getTrends: (params) => http.get("/health/trends", { params }),
  exportData: (params) => http.get("/health/export", { params }),
};

export const adviceApi = {
  history: () => http.get("/advice/history"),
};
