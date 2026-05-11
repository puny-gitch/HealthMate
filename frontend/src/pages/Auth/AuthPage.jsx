import { useMemo, useState } from "react";
import { Button, Form, Input, Toast } from "antd-mobile";
import { EyeInvisibleOutline, EyeOutline } from "antd-mobile-icons";
import { useNavigate, useParams } from "react-router-dom";
import { useAppStore } from "../../store/AppStore";
import { authApi, profileApi } from "../../services/api";
import { mapProfile } from "../../utils/backendMappers";
import { validateAccount, validatePassword, passwordStrength } from "../../utils/validators";
import PageTransition from "../../components/common/PageTransition";
import styles from "./AuthPage.module.css";

function AuthPage() {
  const { mode } = useParams();
  const isRegister = mode === "register";
  const navigate = useNavigate();
  const { actions } = useAppStore();
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const password = Form.useWatch("password", form);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const showStrength = isRegister && Boolean(password);

  const onSubmit = async () => {
    const values = form.getFieldsValue();
    const accountError = validateAccount(values.account);
    const passwordError = validatePassword(values.password);
    if (accountError || passwordError) {
      Toast.show({ content: accountError || passwordError });
      return;
    }
    if (isRegister && values.password !== values.confirmPassword) {
      Toast.show({ content: "两次密码不一致" });
      return;
    }

    try {
      setSubmitting(true);
      if (isRegister) {
        await authApi.register({
          account: values.account,
          password: values.password,
          confirmPassword: values.confirmPassword,
        });
      }
      const loginResult = await authApi.login({ account: values.account, password: values.password });
      if (!loginResult?.token) {
        throw new Error("登录响应缺少 token");
      }
      actions.setToken(loginResult.token);
      let user = mapProfile(loginResult);
      actions.updateUser(user);
      try {
        const profile = await profileApi.getProfile();
        user = mapProfile(profile);
        actions.updateUser(user);
      } catch (profileError) {
        if (loginResult.profileCompleted) {
          Toast.show({ content: profileError.message || "档案信息同步失败，已先进入首页" });
        }
      }
      Toast.show({ content: isRegister ? "注册成功，请完善健康档案" : "登录成功" });
      navigate(user.hasProfile ? "/dashboard" : "/profile-setup");
    } catch (error) {
      actions.logout();
      Toast.show({ content: error.message || "登录失败" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <div className={styles.page}>
        <div className={styles.panel}>
          <h1>{isRegister ? "注册 HealthMate" : "登录 HealthMate"}</h1>
          <p>{isRegister ? "创建账号后需要完善基础健康档案。" : "登录后进入健康记录和任务管理。"}</p>
          <Form
            form={form}
            layout="horizontal"
            footer={
              <Button color="primary" block loading={submitting} onClick={onSubmit}>
                {isRegister ? "立即注册" : "登录"}
              </Button>
            }
          >
            <Form.Item
              name="account"
              label={isRegister ? "账号*" : "账号"}
              help={isRegister ? "建议使用 4-20 位字母、数字或下划线。" : ""}
              rules={[{ required: true, message: "请输入账号" }]}
            >
              <Input placeholder="请输入账号" clearable />
            </Form.Item>
            <Form.Item
              name="password"
              label={isRegister ? "密码*" : "密码"}
              help={isRegister ? "至少 6 位，需包含字母和数字。" : ""}
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input
                placeholder="至少 6 位，含字母和数字"
                type={visible ? "text" : "password"}
                clearable
                extra={
                  <div className={styles.eye} onClick={() => setVisible((v) => !v)}>
                    {visible ? <EyeOutline /> : <EyeInvisibleOutline />}
                  </div>
                }
              />
            </Form.Item>
            {isRegister && (
              <>
                {showStrength && (
                  <div className={styles.strengthWrap}>
                    <div className={styles.strengthLabel}>
                      <span>密码强度</span>
                      <em>{["", "较弱", "一般", "良好", "较强"][strength]}</em>
                    </div>
                    <div className={styles.strengthTrack}>
                      <span className={styles[`strength${strength}`]} />
                    </div>
                    <div className={styles.strengthTips}>
                      <span className={/[A-Za-z]/.test(password) ? styles.tipActive : ""}>字母</span>
                      <span className={/\d/.test(password) ? styles.tipActive : ""}>数字</span>
                      <span className={password.length >= 8 ? styles.tipActive : ""}>8 位以上</span>
                    </div>
                  </div>
                )}
                <Form.Item
                  name="confirmPassword"
                  label="确认密码*"
                  help="需与上方密码完全一致。"
                  rules={[{ required: true, message: "请再次输入密码" }]}
                >
                  <Input placeholder="请再次输入密码" type={visible ? "text" : "password"} clearable />
                </Form.Item>
              </>
            )}
          </Form>
          <div className={styles.footer}>
            <span onClick={() => Toast.show({ content: "忘记密码功能待接入" })}>忘记密码</span>
            <span onClick={() => navigate(isRegister ? "/auth/login" : "/auth/register")}>
              {isRegister ? "已有账号，去登录" : "没有账号，去注册"}
            </span>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

export default AuthPage;
