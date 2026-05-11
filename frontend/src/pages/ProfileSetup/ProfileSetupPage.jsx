import { useMemo, useState } from "react";
import { Button, Form, Input, Selector, TextArea, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import PageTransition from "../../components/common/PageTransition";
import MotionNotice from "../../components/feedback/MotionNotice";
import { useAppStore } from "../../store/AppStore";
import { profileApi } from "../../services/api";
import { mapProfile } from "../../utils/backendMappers";
import styles from "./ProfileSetupPage.module.css";

const goals = ["减脂", "增肌", "改善睡眠", "保持健康"];
const genderOptions = [
  { label: "男", value: 1 },
  { label: "女", value: 2 },
];
const goalOptions = goals.map((goal) => ({ label: goal, value: goal }));

function ProfileSetupPage() {
  const [form] = Form.useForm();
  const values = Form.useWatch([], form);
  const navigate = useNavigate();
  const {
    state: { user },
    actions,
  } = useAppStore();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedText, setSavedText] = useState("");

  const canSubmit = useMemo(
    () => values?.gender?.[0] != null && Boolean(values?.height && values?.weight && values?.goal?.[0]),
    [values],
  );

  const handleSave = async () => {
    const formValues = form.getFieldsValue();
    try {
      setSaving(true);
      setSaveError("");
      setSavedText("");
      const profile = await profileApi.saveProfile({
        gender: Number(formValues.gender?.[0]),
        height: Number(formValues.height),
        weight: Number(formValues.weight),
        healthGoal: formValues.goal?.[0],
        injuryHistory: formValues.injuryHistory || "无",
        allergyHistory: formValues.allergyHistory || "无",
      });
      actions.updateUser(mapProfile(profile));
      Toast.show({ content: "档案保存成功" });
      setSavedText("已保存");
      await new Promise((resolve) => {
        window.setTimeout(resolve, 420);
      });
      navigate("/dashboard");
    } catch (error) {
      const message = error.message || "档案保存失败";
      setSaveError(message);
      Toast.show({ content: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
      <div className={styles.page}>
        <div className={styles.hero}>
          <PageHeader title="基础健康档案" />
          <div className={styles.heroBody}>
            <div>
              <span className="hm-page-eyebrow">Profile Setup</span>
              <h1>完善健康基础信息</h1>
              <p>这些信息会用于记录解析、趋势统计和候选任务生成。</p>
            </div>
            <div className={styles.heroMeta}>
              <strong>{user.goal || "保持健康"}</strong>
              <span>当前目标</span>
            </div>
          </div>
        </div>

        <section className={styles.formShell}>
          <MotionNotice className={styles.formNotice} color="alert" content={saveError} />
          <Form
            form={form}
            initialValues={{
              gender: user.gender != null ? [user.gender] : [],
              height: user.height,
              weight: user.weight,
              goal: user.goal ? [user.goal] : [],
              injuryHistory: user.injuryHistory || "",
              allergyHistory: user.allergyHistory || "",
            }}
            layout="horizontal"
            className={styles.form}
            footer={
              <Button color="primary" block loading={saving} disabled={!canSubmit} onClick={handleSave}>
                {savedText || "保存档案"}
              </Button>
            }
          >
            <div className={styles.formSection}>
              <h2>基础数据</h2>
              <Form.Item name="gender" label="性别*" rules={[{ required: true, message: "请选择性别" }]}>
                <Selector options={genderOptions} columns={2} />
              </Form.Item>
              <div className={styles.inlineFields}>
                <Form.Item name="height" label="身高*" rules={[{ required: true, message: "请输入身高" }]}>
                  <Input type="number" placeholder="cm" clearable />
                </Form.Item>
                <Form.Item name="weight" label="体重*" rules={[{ required: true, message: "请输入体重" }]}>
                  <Input type="number" placeholder="kg" clearable />
                </Form.Item>
              </div>
            </div>

            <div className={styles.formSection}>
              <h2>健康目标</h2>
              <Form.Item name="goal" label="目标*" rules={[{ required: true, message: "请选择目标" }]}>
                <Selector options={goalOptions} columns={2} />
              </Form.Item>
            </div>

            <div className={styles.formSection}>
              <h2>健康备注</h2>
              <Form.Item name="injuryHistory" label="伤病史">
                <TextArea placeholder="如：膝盖偶尔不适" autoSize={{ minRows: 2, maxRows: 4 }} />
              </Form.Item>
              <Form.Item name="allergyHistory" label="过敏史">
                <TextArea placeholder="如：无明确食物过敏" autoSize={{ minRows: 2, maxRows: 4 }} />
              </Form.Item>
            </div>
          </Form>
        </section>
      </div>
    </PageTransition>
  );
}

export default ProfileSetupPage;
