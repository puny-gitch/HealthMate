import { motion as Motion } from "framer-motion";
import styles from "./EmptyState.module.css";

function EmptyState({ title, description, className = "" }) {
  return (
    <Motion.div
      className={`${styles.emptyState} ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
    >
      <strong>{title}</strong>
      {description && <span>{description}</span>}
    </Motion.div>
  );
}

export default EmptyState;
