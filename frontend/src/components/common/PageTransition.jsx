import { motion as Motion } from "framer-motion";

const variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

const transition = { duration: 0.58, ease: [0.22, 1, 0.36, 1] };

function PageTransition({ children }) {
  return (
    <Motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={transition}
    >
      {children}
    </Motion.div>
  );
}

export default PageTransition;
