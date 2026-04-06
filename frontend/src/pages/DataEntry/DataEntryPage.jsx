import { useMemo, useState } from "react";
import { Button, Form, Input, Selector, Space, Tag, TextArea, Toast } from "antd-mobile";
import { useNavigate } from "react-router-dom";
import AppCard from "../../components/common/AppCard";
import PageTransition from "../../components/common/PageTransition";
import RiskAlertModal from "../../components/feedback/RiskAlertModal";
import { detectHighRisk } from "../../utils/riskWords";
import { validateRange } from "../../utils/validators";
import styles from "./DataEntryPage.module.css";

const tabOptions = [
  { label: "自然语言录入", value: "nlp" },
  { label: "手动表单录入", value: "manual" },
];

function DataEntryPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("nlp");
  const [rawInput, setRawInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [riskVisible, setRiskVisible] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [manualForm] = Form.useForm();

  const hasRiskInput = useMemo(() => detectHighRisk(rawInput), [rawInput]);

  const parseNLP = async () => {
    if (!rawInput.trim()) {
      Toast.show({ content: "请先输入健康记录内容" });
      return;
    }
    if (hasRiskInput) {
      setRiskVisible(true);
      return;
    }
    setParsing(true);
    setTimeout(() => {
      setParsing(false);
      setParsed({
        sleepHours: 7,
        intakeCalories: 560,
        exerciseCalories: 320,
        tags: ["有氧训练", "低糖饮食", "睡眠正常"],
      });
    }, 1200);
  };

  const submitNLP = () => {
    if (hasRiskInput) {
      setRiskVisible(true);
      return;
    }
    Toast.show({ content: "数据提交成功" });
    navigate("/dashboard");
  };

  const submitManual = () => {
    const values = manualForm.getFieldsValue();
    const checks = [
      validateRange("睡眠时长", values.sleepHours, 0, 24),
      validateRange("饮食热量", values.intakeCalories, 0, 6000),
      validateRange("运动热量", values.exerciseCalories, 0, 4000),
    ].filter(Boolean);
    if (checks.length) {
      Toast.show({ content: checks[0] });
      return;
    }
    Toast.show({ content: "数据提交成功" });
    navigate("/dashboard");
  };

  const updateTag = (index, value) => {
    setParsed((prev) => ({
      ...prev,
      tags: prev.tags.map((item, i) => (i === index ? value : item)),
    }));
  };

  const removeTag = (index) => {
    setParsed((prev) => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  };

  return (
    <PageTransition>
      <div className={styles.page}>
        <AppCard title="健康数据录入">
          <Selector columns={2} options={tabOptions} value={[mode]} onChange={(value) => setMode(value[0])} />
        </AppCard>

        {mode === "nlp" ? (
          <AppCard title="自然语言录入">
            <TextArea
              value={rawInput}
              placeholder="例如：跑了 40 分钟，吃了一个苹果，睡了 7 小时"
              onChange={(val) => {
                setRawInput(val);
                if (detectHighRisk(val)) {
                  setRiskVisible(true);
                }
              }}
              className={styles.inputArea}
              autoSize={{ minRows: 5, maxRows: 8 }}
            />
            <Space className={styles.actionRow} block>
              <Button color="primary" loading={parsing} onClick={parseNLP} disabled={hasRiskInput}>
                {parsing ? "AI 解析中" : "解析内容"}
              </Button>
              <Button onClick={submitNLP} disabled={!parsed || hasRiskInput}>
                确认提交
              </Button>
            </Space>
            {parsed && (
              <div className={styles.resultCards}>
                <div className={styles.metric}>
                  睡眠 <Input value={`${parsed.sleepHours}`} onChange={(v) => setParsed((p) => ({ ...p, sleepHours: Number(v || 0) }))} /> 小时
                </div>
                <div className={styles.metric}>
                  摄入 <Input value={`${parsed.intakeCalories}`} onChange={(v) => setParsed((p) => ({ ...p, intakeCalories: Number(v || 0) }))} /> kcal
                </div>
                <div className={styles.metric}>
                  消耗 <Input value={`${parsed.exerciseCalories}`} onChange={(v) => setParsed((p) => ({ ...p, exerciseCalories: Number(v || 0) }))} /> kcal
                </div>
                <div className={styles.tags}>
                  {parsed.tags.map((tag, index) => (
                    <Tag key={tag + index} color="primary" fill="outline" onClose={() => removeTag(index)} closeable>
                      <Input value={tag} onChange={(v) => updateTag(index, v)} />
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </AppCard>
        ) : (
          <AppCard title="手动表单录入">
            <Form
              form={manualForm}
              layout="horizontal"
              footer={
                <Button color="primary" block onClick={submitManual}>
                  一键提交
                </Button>
              }
            >
              <Form.Item name="sleepHours" label="睡眠时长" rules={[{ required: true, message: "请输入睡眠时长" }]}>
                <Input type="number" placeholder="0-24 小时" />
              </Form.Item>
              <Form.Item name="intakeCalories" label="饮食热量" rules={[{ required: true, message: "请输入饮食热量" }]}>
                <Input type="number" placeholder="单位 kcal" />
              </Form.Item>
              <Form.Item name="exerciseCalories" label="运动热量" rules={[{ required: true, message: "请输入运动热量" }]}>
                <Input type="number" placeholder="单位 kcal" />
              </Form.Item>
            </Form>
          </AppCard>
        )}

        <RiskAlertModal visible={riskVisible} onClose={() => setRiskVisible(false)} />
      </div>
    </PageTransition>
  );
}

export default DataEntryPage;
