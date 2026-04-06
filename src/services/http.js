import axios from "axios";

// Axios 公共请求实例：后续联调时只需替换 baseURL 或通过 .env 注入。
const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api",
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
  (response) => response.data,
  (error) => Promise.reject(error),
);

export default http;
