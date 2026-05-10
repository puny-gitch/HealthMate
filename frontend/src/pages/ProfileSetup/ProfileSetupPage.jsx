import { useMemo, useState } from "react";
import { Button, Form, Input, Radio, TextArea, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import PageTransition from "../../components/common/PageTransition";
import { useAppStore } from "../../store/AppStore";
import { profileApi } from "../../services/api";
import { mapProfile } from "../../utils/backendMappers";
import styles from "./ProfileSetupPage.module.css";

const goals = ["减脂", "增肌", "改善睡眠", "保持健康"];

function ProfileSetupPage() {
  const [form] = Form.useForm();
  const values = Form.useWatch([], form);
  const navigate = useNavigate();
  const {
    state: { user },
    actions,
  } = useAppStore();
  const [saving, setSaving] = useState(false);

  const canSubmit = useMemo(
    () => values?.gender != null && Boolean(values?.height && values?.weight && values?.goal),
    [values],
  );

  const handleSave = async () => {
    const formValues = form.getFieldsValue();
    const medicalHistory = [
      formValues.injuryHistory ? `伤病史：${formValues.injuryHistory}` : "",
      formValues.allergyHistory ? `过敏史：${formValues.allergyHistory}` : "",
    ]
      .filter(Boolean)
      .join("；");

    try {
      setSaving(true);
      const profile = await profileApi.saveProfile({
        gender: Number(formValues.gender),
        height: Number(formValues.height),
        weight: Number(formValues.weight),
        healthGoal: formValues.goal,
        medicalHistory: medicalHistory || "无",
      });
      actions.updateUser(mapProfile(profile));
      Toast.show({ content: "档案保存成功" });
      navigate("/dashboard");
    } catch (error) {
      Toast.show({ content: error.message || "档案保存失败" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
      <div className={styles.page}>
        <PageHeader title="基础健康档案" />
        <Form
          form={form}
          initialValues={{
            gender: user.gender,
            height: user.height,
            weight: user.weight,
            goal: user.goal,
            injuryHistory: user.medicalHistory === "暂无" ? "" : user.medicalHistory,
          }}
          layout="horizontal"
          className={styles.form}
          footer={
            <Button color="primary" block loading={saving} disabled={!canSubmit} onClick={handleSave}>
              保存档案
            </Button>
          }
        >
          <Form.Item name="gender" label="性别*" rules={[{ required: true, message: "请选择性别" }]}>
            <Radio.Group>
              <Radio value={1}>男</Radio>
              <Radio value={2}>女</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="height" label="身高*" rules={[{ required: true, message: "请输入身高" }]}>
            <Input type="number" placeholder="请输入身高（cm）" clearable />
          </Form.Item>
          <Form.Item name="weight" label="体重*" rules={[{ required: true, message: "请输入体重" }]}>
            <Input type="number" placeholder="请输入体重（kg）" clearable />
          </Form.Item>
          <Form.Item name="goal" label="健康目标*" rules={[{ required: true, message: "请选择目标" }]}>
            <Radio.Group className={styles.goalGroup}>
              {goals.map((goal) => (
                <Radio key={goal} value={goal}>
                  {goal}
                </Radio>
              ))}
            </Radio.Group>
          </Form.Item>
          <Form.Item name="injuryHistory" label="伤病史">
            <TextArea placeholder="如有请填写，便于生成更准确建议" autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item name="allergyHistory" label="过敏史">
            <TextArea placeholder="如有请填写过敏源或反应情况" autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
        </Form>
      </div>
    </PageTransition>
  );
}

export default ProfileSetupPage;
