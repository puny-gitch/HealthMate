import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppOutline, UserOutline, FileOutline, SetOutline } from "antd-mobile-icons";
import { TabBar } from "antd-mobile";
import styles from "./MainLayout.module.css";

const tabs = [
  { key: "/dashboard", title: "首页", icon: <AppOutline /> },
  { key: "/data-entry", title: "录入", icon: <FileOutline /> },
  { key: "/ai-advice", title: "建议", icon: <SetOutline /> },
  { key: "/profile", title: "我的", icon: <UserOutline /> },
];

function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className={styles.layout}>
      <main className={styles.main}>
        <Outlet />
      </main>
      <div className={styles.tabbar}>
        <TabBar activeKey={location.pathname} onChange={(value) => navigate(value)}>
          {tabs.map((tab) => (
            <TabBar.Item key={tab.key} icon={tab.icon} title={tab.title} />
          ))}
        </TabBar>
      </div>
    </div>
  );
}

export default MainLayout;
