import styles from "./PageTransition.module.css";

function PageTransition({ children }) {
  return <div className={styles.page}>{children}</div>;
}

export default PageTransition;
