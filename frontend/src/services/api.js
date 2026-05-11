import http from "./http";

// 以下方法为接口占位，保持参数结构稳定，后续可直接联调后端。
export const authApi = {
  login: (payload) => http.post("/auth/login", payload),
  register: (payload) => http.post("/auth/register", payload),
};

export const profileApi = {
  getProfile: () => http.get("/profile"),
  saveProfile: (payload) => http.post("/profile", payload),
  updateProfile: (payload) => http.put("/profile", payload),
};

export const healthApi = {
  parseData: (payload) => http.post("/health/parse", payload),
  parseRecordAI: (payload) => http.post("/health/record/parse-ai", payload),
  confirmRecord: (payload) => http.post("/health/record/confirm", payload),
  submitData: (payload) => http.post("/health/data", payload),
  getDashboard: () => http.get("/health/dashboard"),
  getTrends: (params) => http.get("/health/trends", { params }),
  getRecentRecords: (params) => http.get("/health/record/recent", { params }),
  exportData: (params) => http.get("/health/export", { params, responseType: "blob" }),
};

export const adviceApi = {
  history: () => http.get("/advice/history"),
};

export const taskApi = {
  today: () => http.get("/task/today"),
  history: (params) => http.get("/task/history", { params }),
  check: (payload) => http.post("/task/check", payload),
  generatePreview: (payload) => http.post("/task/generate-preview", payload),
  addSelected: (payload) => http.post("/task/add-selected", payload),
};
