import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";

function formatValue(value, decimal) {
  if (typeof value === "number" && decimal) {
    return value.toFixed(decimal);
  }
  return String(value);
}

function AnimatedCounter({ from = 0, to, duration = 1.2, suffix = "", decimal, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(from);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(from, to, {
      duration,
      ease: [0.34, 1.56, 0.64, 1],
      onUpdate(value) {
        setDisplay(value);
      },
    });
    return () => controls.stop();
  }, [inView, from, to, duration]);

  return (
    <span ref={ref} className={className}>
      {formatValue(display, decimal)}
      {suffix}
    </span>
  );
}

export default AnimatedCounter;
