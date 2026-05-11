import { motion as Motion } from "framer-motion";
import styles from "./ProcessSteps.module.css";

function ProcessSteps({ steps, active = 0, done = false }) {
  return (
    <div className={styles.steps}>
      {steps.map((step, index) => {
        const state = done || index < active ? "done" : index === active ? "active" : "idle";
        return (
          <Motion.div
            className={`${styles.step} ${styles[state]}`}
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: index * 0.04 }}
          >
            <span />
            <em>{step}</em>
          </Motion.div>
        );
      })}
    </div>
  );
}

export default ProcessSteps;
