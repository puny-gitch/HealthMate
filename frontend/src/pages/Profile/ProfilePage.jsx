import { Avatar, Button, Toast } from "antd-mobile";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
import MotionNotice from "../../components/feedback/MotionNotice";
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
  const [loadWarnings, setLoadWarnings] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([profileApi.getProfile(), healthApi.getRecentRecords({ days: 30 }), adviceApi.history()]).then(
      ([profileResult, recordsResult, adviceResult]) => {
        if (!active) return;
        const warnings = [];
        if (profileResult.status === "fulfilled") actions.updateUser(mapProfile(profileResult.value));
        else warnings.push(`档案信息加载失败：${profileResult.reason?.message || "请稍后重试"}`);
        if (recordsResult.status === "fulfilled") {
          actions.setRecentEntries((recordsResult.value.records || []).map(mapHealthRecord));
        } else {
          warnings.push(`健康记录加载失败：${recordsResult.reason?.message || "请稍后重试"}`);
        }
        if (adviceResult.status === "fulfilled") {
          actions.setRecommendations(
            (adviceResult.value || []).map((item) => ({
              content: item.adviceText,
              time: item.createdAt,
            })),
          );
        } else {
          warnings.push(`AI 建议加载失败：${adviceResult.reason?.message || "请稍后重试"}`);
        }
        setLoadWarnings(warnings);
      },
    );

    return () => {
      active = false;
    };
  }, [actions]);

  const latestAdvice = recommendations[0]?.content || "暂无 AI 建议，进入 AI 建议页后可生成新的健康建议。";
  const profileMeta = [
    { label: "身高", value: user.height ? `${user.height} cm` : "-" },
    { label: "体重", value: user.weight ? `${user.weight} kg` : "-" },
    { label: "记录", value: recentEntries.length },
    { label: "建议", value: recommendations.length },
  ];
  const quickActions = [
    { label: "编辑档案", desc: "更新基础信息和健康目标", action: () => navigate("/profile-setup"), primary: true },
    { label: "健康趋势", desc: "查看睡眠、摄入和消耗变化", action: () => navigate("/trends") },
    { label: "任务历史", desc: "回顾每日健康任务执行情况", action: () => navigate("/tasks") },
    { label: "我的成就", desc: "功能待接入", action: () => Toast.show({ content: "成就功能待接入。" }) },
  ];
  const historyRows = [
    { label: "伤病史", value: user.injuryHistory || "无" },
    { label: "过敏史", value: user.allergyHistory || "无" },
  ];

  return (
    <PageTransition>
      <div className={styles.page}>
        {loadWarnings.length > 0 && (
          <div className={styles.noticeStack}>
            {loadWarnings.map((warning) => (
              <MotionNotice key={warning} color="info" content={warning} />
            ))}
          </div>
        )}

        <section className={styles.hero}>
          <div className={styles.identity}>
            <Avatar src={user.avatar} className={styles.avatar} style={{ "--size": "76px" }} />
            <div className={styles.identityText}>
              <span className="hm-page-eyebrow">HealthMate Profile</span>
              <h1>{user.nickname}</h1>
            </div>
          </div>

          <div className={styles.heroPanel}>
            <div className={styles.idBlock}>
              <span>用户 ID</span>
              <strong>{user.userId || "-"}</strong>
            </div>
            <Button className={styles.editButton} fill="outline" onClick={() => navigate("/profile-setup")}>
              编辑档案
            </Button>
          </div>
        </section>

        <section className={styles.overview}>
          <div className={styles.metricRail}>
            {profileMeta.map((item) => (
              <div className={styles.metricItem} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <AppCard className={styles.adviceCard}>
            <div className={styles.cardHead}>
              <div>
                <span className="hm-page-eyebrow">当前建议</span>
                <h2>最新健康建议</h2>
              </div>
              <Button className="hm-ghost-action" fill="outline" size="small" onClick={() => navigate("/ai-advice")}>
                查看 AI 建议
              </Button>
            </div>
            <p>{latestAdvice}</p>
          </AppCard>
        </section>

        <section className={styles.contentGrid}>
          <AppCard className={styles.profileCard}>
            <div className={styles.cardHead}>
              <div>
                <span className="hm-page-eyebrow">档案摘要</span>
                <h2>基础健康信息</h2>
              </div>
            </div>
            <dl className={styles.detailList}>
              <div>
                <dt>健康目标</dt>
                <dd>{user.goal}</dd>
              </div>
              {historyRows.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
              {recentEntries[0]?.summary && (
                <div>
                  <dt>最近记录</dt>
                  <dd>{recentEntries[0].summary}</dd>
                </div>
              )}
            </dl>
          </AppCard>

          <AppCard className={styles.actionCard}>
            <div className={styles.cardHead}>
              <div>
                <span className="hm-page-eyebrow">快捷入口</span>
                <h2>常用操作</h2>
              </div>
            </div>
            <div className={styles.actionList}>
              {quickActions.map((item) => (
                <button
                  className={`${styles.actionItem} ${item.primary ? styles.primaryAction : ""}`}
                  key={item.label}
                  onClick={item.action}
                  type="button"
                >
                  <span>
                    <strong>{item.label}</strong>
                    <em>{item.desc}</em>
                  </span>
                  <b>→</b>
                </button>
              ))}
            </div>
          </AppCard>
        </section>

        <footer className={styles.footer}>
          <span>HealthMate 是陪伴式健康管理工具，不替代医生诊疗建议。</span>
          <Button
            fill="none"
            size="small"
            onClick={() => {
              actions.logout();
              navigate("/auth/login");
            }}
          >
            退出登录
          </Button>
        </footer>
      </div>
    </PageTransition>
  );
}

export default ProfilePage;
