import { NoticeBar } from "antd-mobile";
import { motion as Motion } from "framer-motion";

function MotionNotice({ className, color = "info", content }) {
  if (!content) return null;

  return (
    <Motion.div
      className={className}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
    >
      <NoticeBar color={color} content={content} />
    </Motion.div>
  );
}

export default MotionNotice;
