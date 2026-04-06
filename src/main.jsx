import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd-mobile";
import zhCN from "antd-mobile/es/locales/zh-CN";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AppStoreProvider } from "./store/AppStore";
import "./styles/theme.css";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        colorPrimary: "#409EFF",
        colorSuccess: "#67C23A",
      }}
    >
      <BrowserRouter>
        <AppStoreProvider>
          <App />
        </AppStoreProvider>
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
);
