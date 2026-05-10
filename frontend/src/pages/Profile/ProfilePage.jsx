import { Avatar, Button, List, Toast } from "antd-mobile";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
import { useAppStore } from "../../store/AppStore";
import { adviceApi, healthApi, profileApi } from "../../services/api";
import { mapHealthRecord, mapProfile } from "../../utils/backendMappers";
import styles from "./ProfilePage.module.css";

function ProfilePage() {
  const navigate = useNavigate();
  const {
    state: { user, recentEntries, recommendations },
    actions,
  } = useAppStore();

  useEffect(() => {
    let active = true;
    Promise.allSettled([profileApi.getProfile(), healthApi.getRecentRecords({ days: 30 }), adviceApi.history()]).then(
      ([profileResult, recordsResult, adviceResult]) => {
        if (!active) return;
        if (profileResult.status === "fulfilled") actions.updateUser(mapProfile(profileResult.value));
        if (recordsResult.status === "fulfilled") {
          actions.setRecentEntries((recordsResult.value.records || []).map(mapHealthRecord));
        }
        if (adviceResult.status === "fulfilled") {
          actions.setRecommendations(
            (adviceResult.value || []).map((item) => ({
              content: item.adviceText,
              time: item.createdAt,
            })),
          );
        }
      },
    );

    return () => {
      active = false;
    };
  }, [actions]);

  return (
    <PageTransition>
      <div className={styles.page}>
        <AppCard className={styles.heroCard}>
          <div className={styles.userInfo}>
            <Avatar src={user.avatar} style={{ "--size": "72px" }} />
            <div>
              <span className="hm-page-eyebrow">我的健康伙伴档案</span>
              <h1>{user.nickname}</h1>
              <p>
                目标：{user.goal} · 后端用户 ID：{user.userId || "-"}
              </p>
            </div>
          </div>
          <div className={styles.metrics}>
            <div>
              <strong>{user.height} cm</strong>
              <span>身高</span>
            </div>
            <div>
              <strong>{user.weight} kg</strong>
              <span>体重</span>
            </div>
            <div>
              <strong>{recentEntries.length}</strong>
              <span>近期记录</span>
            </div>
            <div>
              <strong>{recommendations.length}</strong>
              <span>AI 陪伴次数</span>
            </div>
          </div>
        </AppCard>

        <AppCard title="我的节奏">
          <div className={styles.planGrid}>
            <article className={styles.planCard}>
              <span className="hm-page-eyebrow">提醒</span>
              <strong>{recommendations[0]?.content ? "已有后端 AI 建议" : "暂无后端提醒"}</strong>
              <p>{recommendations[0]?.content || "进入 AI 建议页后，后端会生成今日建议。"}</p>
            </article>
            <article className={styles.planCard}>
              <span className="hm-page-eyebrow">病史备注</span>
              <strong>{user.medicalHistory}</strong>
              <p>目前档案以轻量健康管理为主，不替代专业医疗判断。</p>
            </article>
          </div>
          <div className={styles.actions}>
            <Button color="primary" onClick={() => navigate("/profile-setup")}>
              修改档案
            </Button>
            <Button onClick={() => navigate("/profile-setup")}>修改目标</Button>
          </div>
        </AppCard>

        <AppCard title="更多操作">
          <List mode="card">
            <List.Item onClick={() => navigate("/tasks")}>查看任务历史</List.Item>
            <List.Item onClick={() => navigate("/trends")}>查看健康数据</List.Item>
            <List.Item onClick={() => Toast.show({ content: "当前后端未提供成就数据接口。" })}>我的成就</List.Item>
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

        <p className={styles.disclaimer}>HealthMate 是陪伴式健康管理工具，不替代医生诊疗建议。</p>
      </div>
    </PageTransition>
  );
}

export default ProfilePage;
