import { useMemo, useState } from "react";
import { Button, Form, Input, Toast } from "antd-mobile";
import { EyeInvisibleOutline, EyeOutline } from "antd-mobile-icons";
import { useNavigate, useParams } from "react-router-dom";
import { useAppStore } from "../../store/AppStore";
import { validateAccount, validatePassword, passwordStrength } from "../../utils/validators";
import PageTransition from "../../components/common/PageTransition";
import styles from "./AuthPage.module.css";

function AuthPage() {
  const { mode } = useParams();
  const isRegister = mode === "register";
  const navigate = useNavigate();
  const { actions } = useAppStore();
  const [visible, setVisible] = useState(false);
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
    if (isRegister && values.account === "healthmate") {
      Toast.show({ content: "用户名已存在，请更换后重试" });
      return;
    }
    if (!isRegister && values.password !== "health123") {
      Toast.show({ content: "账号或密码错误，请重新输入" });
      return;
    }
    actions.updateUser({ account: values.account, nickname: values.account });
    actions.setToken(`mock-jwt-token-${Date.now()}`);
    Toast.show({ content: isRegister ? "注册成功，请完善健康档案" : "登录成功" });
    navigate("/profile-setup");
  };

  return (
    <PageTransition>
      <div className={styles.page}>
        <div className={styles.panel}>
          <h1>{isRegister ? "注册 HealthMate" : "登录 HealthMate"}</h1>
          <p>你的健康伴侣，从今天开始科学管理。</p>
          <Form form={form} layout="horizontal" footer={<Button color="primary" block onClick={onSubmit}>{isRegister ? "立即注册" : "登录"}</Button>}>
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
              <div className={styles.strengthWrap}>
                <span>密码强度</span>
                <div className={styles.strengthBar}>
                  <i className={strength >= 1 ? styles.active : ""} />
                  <i className={strength >= 2 ? styles.active : ""} />
                  <i className={strength >= 3 ? styles.active : ""} />
                  <i className={strength >= 4 ? styles.active : ""} />
                </div>
              </div>
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
