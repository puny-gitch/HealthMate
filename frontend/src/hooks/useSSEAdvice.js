import { useCallback, useEffect, useRef, useState } from "react";

export function useSSEAdvice(url, { onAdvice } = {}) {
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

  const connect = useCallback((nextUrl = url) => {
    close();
    setText("");
    setError("");
    setResumeHint("");
    setLoading(true);

    if (!nextUrl) {
      setError("缺少后端建议流地址");
      setLoading(false);
      return;
    }

    try {
      const source = new EventSource(nextUrl);
      sourceRef.current = source;
      source.addEventListener("message", (event) => {
        setText((prev) => prev + event.data);
      });
      source.addEventListener("advice", (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.adviceText) {
            setText(payload.adviceText);
            onAdvice?.(payload.adviceText);
          }
        } catch {
          setError("建议数据解析失败");
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
  }, [close, onAdvice, url]);

  useEffect(() => () => close(), [close]);

  return { text, loading, resumeHint, error, connect, close };
}
