import styles from "./TypingStream.module.css";

function TypingStream({ text, loading }) {
  return (
    <div className={styles.wrapper}>
      <p className={styles.text}>
        {text}
        {loading && <span className={styles.cursor}>|</span>}
      </p>
      {loading && <div className={styles.loading}>AI 正在生成建议...</div>}
    </div>
  );
}

export default TypingStream;
