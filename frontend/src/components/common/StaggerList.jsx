import { motion } from "framer-motion";
import { Children, isValidElement } from "react";

const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
  },
};

function StaggerList({ children, className, as: Tag = "div", stagger = 0.06 }) {
  const customContainer = {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren: 0.08 },
    },
  };

  return (
    <motion.div
      className={className}
      variants={customContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-30px" }}
    >
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        return (
          <motion.div variants={item}>
            {child}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export default StaggerList;
