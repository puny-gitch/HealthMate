import styles from "./AppCard.module.css";

function AppCard({ title, extra, children, className = "" }) {
  return (
    <section className={`${styles.card} ${className}`}>
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
