import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";
export const AUTH_EXPIRED_EVENT = "healthmate:auth-expired";

// Axios 公共请求实例：后续联调时只需替换 baseURL 或通过 .env 注入。
const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
});

// 请求拦截器：统一注入 JWT token。
http.interceptors.request.use((config) => {
  const token = localStorage.getItem("healthmate_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一错误处理占位，便于后续接业务状态码。
http.interceptors.response.use(
  (response) => {
    const payload = response.data;
    if (payload && typeof payload === "object" && "code" in payload) {
      if (payload.code === 0) return payload.data;
      const businessError = new Error(payload.message || "请求失败");
      businessError.code = payload.code;
      businessError.data = payload.data;
      businessError.status = response.status;
      return Promise.reject(businessError);
    }
    return payload;
  },
  (error) => {
    const status = error.response?.status;
    const payload = error.response?.data;
    const message = payload?.message || error.message || "请求失败";
    if (status === 401) {
      localStorage.removeItem("healthmate_token");
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    const normalizedError = new Error(message);
    normalizedError.code = payload?.code || status;
    normalizedError.data = payload?.data;
    normalizedError.status = status;
    return Promise.reject(normalizedError);
  },
);

export default http;
