import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";

function formatValue(value, decimal) {
  const numericValue = Number(value || 0);
  if (decimal) {
    return numericValue.toFixed(decimal);
  }
  return String(Math.round(numericValue));
}

function AnimatedCounter({ from = 0, to, duration = 1.2, suffix = "", decimal, className }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(from);

  useEffect(() => {
    if (!inView) return;
    const start = Number(from || 0);
    const target = Number(to || 0);
    const controls = animate(start, target, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate(value) {
        const nextValue = target >= start ? Math.min(value, target) : Math.max(value, target);
        setDisplay(nextValue);
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
