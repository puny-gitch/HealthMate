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
      actions.setToken(loginResult.token);
      const profile = await profileApi.getProfile();
      const user = mapProfile(profile);
      actions.updateUser(user);
      Toast.show({ content: isRegister ? "注册成功，请完善健康档案" : "登录成功" });
      navigate(user.hasProfile ? "/dashboard" : "/profile-setup");
    } catch (error) {
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
          <p>你的健康伴侣，从今天开始科学管理。</p>
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
              rules={[{ required: true, message: "请输入账号" }]}
            >
              <Input placeholder="请输入账号" clearable />
            </Form.Item>
            <Form.Item
              name="password"
              label={isRegister ? "密码*" : "密码"}
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
                <Form.Item
                  name="confirmPassword"
                  label="确认密码*"
                  rules={[{ required: true, message: "请再次输入密码" }]}
                >
                  <Input placeholder="请再次输入密码" type={visible ? "text" : "password"} clearable />
                </Form.Item>
                <div className={styles.strengthWrap}>
                  <span>密码强度</span>
                  <div className={styles.strengthBar}>
                    <i className={strength >= 1 ? styles.active : ""} />
                    <i className={strength >= 2 ? styles.active : ""} />
                    <i className={strength >= 3 ? styles.active : ""} />
                    <i className={strength >= 4 ? styles.active : ""} />
                  </div>
                </div>
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
