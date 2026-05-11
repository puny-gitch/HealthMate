import { Modal } from "antd-mobile";

function RiskAlertModal({ visible, onClose, message }) {
  return (
    <Modal
      visible={visible}
      title={<span style={{ color: "#f56c6c" }}>高危告警</span>}
      content={message || "检测到高危症状，请立即就医或咨询专业医生。本条记录不会作为普通健康记录保存。"}
      closeOnAction
      actions={[{ key: "confirm", text: "我知道了", danger: true }]}
      onAction={onClose}
      onClose={onClose}
    />
  );
}

export default RiskAlertModal;
