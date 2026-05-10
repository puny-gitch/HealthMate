import { useCallback, useEffect, useRef, useState } from "react";

export function useSSEAdvice(url, { onTasks } = {}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [resumeHint, setResumeHint] = useState("");
  const [error, setError] = useState("");
  const sourceRef = useRef(null);
  const timerRef = useRef(null);

  const close = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    close();
    setText("");
    setError("");
    setResumeHint("");
    setLoading(true);

    if (!url) {
      setError("缺少后端建议流地址");
      setLoading(false);
      return;
    }

    try {
      const source = new EventSource(url);
      sourceRef.current = source;
      source.addEventListener("message", (event) => {
        setText((prev) => prev + event.data);
      });
      source.addEventListener("tasks", (event) => {
        try {
          onTasks?.(JSON.parse(event.data));
        } catch {
          setError("任务数据解析失败");
        }
      });
      source.onerror = () => {
        setResumeHint("网络波动，正在尝试断点续传...");
        setError("连接中断，已保留已生成内容");
        setLoading(false);
        source.close();
      };
      source.addEventListener("done", () => {
        setLoading(false);
        source.close();
      });
    } catch {
      setError("建议流加载失败，请稍后重试");
      setLoading(false);
    }
  }, [close, onTasks, url]);

  useEffect(() => () => close(), [close]);

  return { text, loading, resumeHint, error, connect, close };
}
