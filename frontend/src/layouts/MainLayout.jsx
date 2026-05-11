import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { TabBar } from "antd-mobile";
import { AppOutline, FileOutline, SetOutline, UserOutline } from "antd-mobile-icons";
import { useAppStore } from "../store/AppStore";
import styles from "./MainLayout.module.css";

const tabs = [
  { key: "/dashboard", title: "首页", icon: <AppOutline /> },
  { key: "/data-entry", title: "记录", icon: <FileOutline /> },
  { key: "/ai-advice", title: "AI建议", icon: <SetOutline /> },
  { key: "/tasks", title: "任务", icon: <span className={styles.textIcon}>✓</span> },
  { key: "/trends", title: "数据", icon: <span className={styles.textIcon}>▦</span> },
];

function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    state: { user },
  } = useAppStore();

  const activeKey = tabs.find((tab) => location.pathname.startsWith(tab.key))?.key ?? "";

  return (
    <div className={styles.layout}>
      <div className={`${styles.orb} ${styles.orb1}`} />
      <div className={`${styles.orb} ${styles.orb2}`} />
      <div className={`${styles.orb} ${styles.orb3}`} />
      <main className={styles.main}>
        <button className={styles.profileButton} onClick={() => navigate("/profile")} type="button">
          <h1 className={styles.brandTitle}>HealthMate</h1>
          <div className={styles.profileMeta}>
            <strong>{user.nickname}</strong>
            <span>个人中心</span>
          </div>
          <span className={styles.profileArrow}>
            <UserOutline />
          </span>
        </button>
        <Outlet />
      </main>
      <div className={styles.tabbar}>
        <TabBar activeKey={activeKey} onChange={(value) => navigate(value)}>
          {tabs.map((tab) => (
            <TabBar.Item
              key={tab.key}
              icon={
                <span
                  className={
                    activeKey === tab.key
                      ? `${styles.primaryIcon} ${styles.primaryIconActive} ${styles.iconLift}`
                      : `${styles.iconWrap} ${styles.iconWrapInactive}`
                  }
                >
                  {tab.icon}
                </span>
              }
              title={<span className={activeKey === tab.key ? styles.activeTitle : styles.title}>{tab.title}</span>}
            />
          ))}
        </TabBar>
      </div>
    </div>
  );
}

export default MainLayout;
