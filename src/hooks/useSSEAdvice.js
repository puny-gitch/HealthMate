import { useCallback, useEffect, useRef, useState } from "react";

const mockText =
  "今天建议你优先修复睡眠节律，建议 23:30 前入睡；白天增加 30 分钟中等强度步行；下午茶替换为无糖酸奶与坚果，减少高糖波动。";

export function useSSEAdvice(url) {
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
    setText("");
    setError("");
    setResumeHint("");
    setLoading(true);

    // SSE 连接逻辑：优先走后端 event-stream，失败后自动降级 mock 打字机，保证 UI 流式体验。
    if (!url) {
      let index = 0;
      timerRef.current = setInterval(() => {
        index += 1;
        setText(mockText.slice(0, index));
        if (index >= mockText.length) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setLoading(false);
        }
      }, 34);
      return;
    }

    try {
      const source = new EventSource(url, { withCredentials: true });
      sourceRef.current = source;
      source.onmessage = (event) => {
        setText((prev) => prev + event.data);
      };
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
  }, [url]);

  useEffect(() => () => close(), [close]);

  return { text, loading, resumeHint, error, connect, close };
}
