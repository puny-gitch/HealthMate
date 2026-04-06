import { Avatar, List, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
import { useAppStore } from "../../store/AppStore";
import styles from "./ProfilePage.module.css";

function ProfilePage() {
  const navigate = useNavigate();
  const {
    state: { user },
    actions,
  } = useAppStore();

  return (
    <PageTransition>
      <div className={styles.page}>
        <AppCard>
          <div className={styles.userInfo}>
            <Avatar src={user.avatar} style={{ "--size": "64px" }} />
            <div>
              <h2>{user.nickname}</h2>
              <p>
                {user.height}cm / {user.weight}kg / {user.goal}
              </p>
            </div>
          </div>
          <div className={styles.actions}>
            <span onClick={() => navigate("/profile-setup")}>修改健康目标</span>
            <span onClick={() => Toast.show({ content: "编辑个人信息接口待接入" })}>编辑个人信息</span>
            <span onClick={() => Toast.show({ content: "修改密码接口待接入" })}>修改密码</span>
          </div>
        </AppCard>

        <AppCard title="我的服务">
          <List mode="card">
            <List.Item onClick={() => navigate("/tasks")}>打卡历史</List.Item>
            <List.Item onClick={() => navigate("/trends")}>健康总结</List.Item>
            <List.Item onClick={() => Toast.show({ content: "系统设置开发中" })}>系统设置</List.Item>
            <List.Item
              onClick={() => {
                actions.logout();
                navigate("/auth/login");
              }}
            >
              退出登录
            </List.Item>
          </List>
        </AppCard>

        <p className={styles.disclaimer}>本产品为非医疗级健康管理工具，不替代专业医生诊断</p>
      </div>
    </PageTransition>
  );
}

export default ProfilePage;
