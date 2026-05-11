import styles from "./AppCard.module.css";

function AppCard({ title, extra, children, className = "", glow, glass }) {
  const cls = [
    styles.card,
    glow ? styles.glow : "",
    glass ? styles.glass : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <section className={cls}>
      {(title || extra) && (
        <header className={styles.header}>
          {title && <h3>{title}</h3>}
          {extra}
        </header>
      )}
      {children}
    </section>
  );
}

export default AppCard;
