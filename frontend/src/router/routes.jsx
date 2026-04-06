import { Navigate } from "react-router-dom";
import { AuthGuard, GuestGuard } from "./guards";
import AuthPage from "../pages/Auth/AuthPage";
import ProfileSetupPage from "../pages/ProfileSetup/ProfileSetupPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import DataEntryPage from "../pages/DataEntry/DataEntryPage";
import AIAdvicePage from "../pages/AIAdvice/AIAdvicePage";
import TasksPage from "../pages/Tasks/TasksPage";
import TrendsPage from "../pages/Trends/TrendsPage";
import ProfilePage from "../pages/Profile/ProfilePage";
import MainLayout from "../layouts/MainLayout";

const routes = [
  { path: "/", element: <Navigate to="/dashboard" replace /> },
  {
    // 游客路由：仅允许未登录用户访问登录/注册页。
    element: <GuestGuard />,
    children: [{ path: "/auth/:mode", element: <AuthPage /> }],
  },
  {
    // 业务主路由：必须登录且完成档案后才可进入。
    element: <AuthGuard />,
    children: [
      { path: "/profile-setup", element: <ProfileSetupPage /> },
      {
        element: <MainLayout />,
        children: [
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/data-entry", element: <DataEntryPage /> },
          { path: "/ai-advice", element: <AIAdvicePage /> },
          { path: "/tasks", element: <TasksPage /> },
          { path: "/trends", element: <TrendsPage /> },
          { path: "/profile", element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
];

export default routes;
