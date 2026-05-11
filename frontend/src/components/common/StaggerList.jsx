import { motion as Motion } from "framer-motion";
import { Children, isValidElement } from "react";

const item = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
  },
};

function StaggerList({ children, className, stagger = 0.06 }) {
  const customContainer = {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren: 0.08 },
    },
  };

  return (
    <Motion.div
      className={className}
      variants={customContainer}
      initial="hidden"
      animate="visible"
    >
      {Children.map(children, (child, index) => {
        if (!isValidElement(child)) return child;
        return (
          <Motion.div variants={item} key={child.key ?? index}>
            {child}
          </Motion.div>
        );
      })}
    </Motion.div>
  );
}

export default StaggerList;
