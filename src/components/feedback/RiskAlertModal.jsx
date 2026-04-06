import { Modal } from "antd-mobile";

function RiskAlertModal({ visible, onClose }) {
  return (
    <Modal
      visible={visible}
      title={<span style={{ color: "#f56c6c" }}>高危告警</span>}
      content="检测到高危症状，请立即就医"
      closeOnAction
      actions={[{ key: "confirm", text: "我知道了", danger: true }]}
      onAction={onClose}
      onClose={onClose}
    />
  );
}

export default RiskAlertModal;
