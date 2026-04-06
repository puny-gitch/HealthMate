import { useMemo } from "react";
import { Button, Form, Input, Radio, TextArea, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import PageTransition from "../../components/common/PageTransition";
import { useAppStore } from "../../store/AppStore";
import styles from "./ProfileSetupPage.module.css";

const goals = ["减脂", "增肌", "改善睡眠", "保持健康"];

function ProfileSetupPage() {
  const [form] = Form.useForm();
  const values = Form.useWatch([], form);
  const navigate = useNavigate();
  const { actions } = useAppStore();

  const canSubmit = useMemo(() => Boolean(values?.gender && values?.height && values?.weight && values?.goal), [values]);

  const handleSave = () => {
    const formValues = form.getFieldsValue();
    actions.updateUser({
      gender: formValues.gender,
      height: Number(formValues.height),
      weight: Number(formValues.weight),
      goal: formValues.goal,
      injuryHistory: formValues.injuryHistory || "",
      allergyHistory: formValues.allergyHistory || "",
      hasProfile: true,
    });
    Toast.show({ content: "档案保存成功，即将为你生成初始健康建议" });
    navigate("/dashboard");
  };

  return (
    <PageTransition>
      <div className={styles.page}>
        <PageHeader title="基础健康档案" />
        <Form
          form={form}
          layout="horizontal"
          className={styles.form}
          footer={
            <Button color="primary" block disabled={!canSubmit} onClick={handleSave}>
              保存档案
            </Button>
          }
        >
          <Form.Item name="gender" label="性别*" rules={[{ required: true, message: "请选择性别" }]}>
            <Radio.Group>
              <Radio value="男">男</Radio>
              <Radio value="女">女</Radio>
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
