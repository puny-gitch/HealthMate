from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
import math
import re
from typing import Iterable

from app.core.config import get_settings


@dataclass(frozen=True)
class KnowledgeChunk:
    source: str
    title: str
    content: str


@dataclass(frozen=True)
class KnowledgeHit:
    source: str
    title: str
    content: str
    score: float


class KnowledgeService:
    def __init__(self):
        settings = get_settings()
        base_dir = Path(__file__).resolve().parents[2] / settings.knowledge_dir
        self.base_dir = base_dir
        self.embedding_model = settings.knowledge_embedding_model
        self.top_k = settings.knowledge_top_k
        self._chunks = self._load_chunks()
        self._embeddings = self._build_embeddings(self._chunks)

    def search(self, query: str, top_k: int | None = None) -> list[KnowledgeHit]:
        query = (query or "").strip()
        if not query or not self._chunks:
            return []
        limit = top_k or self.top_k
        query_vector = self._embed(query)
        if query_vector is None:
            return self._keyword_search(query, limit)
        scored: list[KnowledgeHit] = []
        for chunk, vector in zip(self._chunks, self._embeddings):
            if vector is None:
                continue
            score = self._cosine_similarity(query_vector, vector)
            if score <= 0:
                continue
            scored.append(KnowledgeHit(chunk.source, chunk.title, chunk.content, score))
        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[:limit] if scored else self._keyword_search(query, limit)

    def render_context(self, query: str, top_k: int | None = None) -> str:
        hits = self.search(query, top_k=top_k)
        if not hits:
            return ""
        return "\n\n".join(
            [
                f"[{hit.source}::{hit.title}]\n{hit.content}"
                for hit in hits
            ]
        )

    def keywords(self, text: str) -> list[str]:
        tokens = re.findall(r"[\u4e00-\u9fff]{2,8}|[a-zA-Z0-9_]+", text or "")
        stopwords = {"今天", "最近", "目前", "感觉", "还有", "这个", "那个", "以及", "一个"}
        return [token for token in tokens if token not in stopwords][:8]

    def _load_chunks(self) -> list[KnowledgeChunk]:
        chunks: list[KnowledgeChunk] = []
        if not self.base_dir.exists():
            return chunks
        for file_path in sorted(self.base_dir.glob("*.md")):
            source = file_path.stem
            text = file_path.read_text(encoding="utf-8")
            chunks.extend(self._split_markdown(source, text))
        return chunks

    def _split_markdown(self, source: str, text: str) -> list[KnowledgeChunk]:
        chunks: list[KnowledgeChunk] = []
        current_title = "概述"
        current_lines: list[str] = []
        for line in text.splitlines():
            if line.startswith("## "):
                if current_lines:
                    content = "\n".join(current_lines).strip()
                    if content:
                        chunks.append(KnowledgeChunk(source, current_title, content))
                current_title = line[3:].strip() or "未命名"
                current_lines = []
            elif line.startswith("# "):
                continue
            else:
                current_lines.append(line)
        if current_lines:
            content = "\n".join(current_lines).strip()
            if content:
                chunks.append(KnowledgeChunk(source, current_title, content))
        return chunks

    def _build_embeddings(self, chunks: Iterable[KnowledgeChunk]) -> list[list[float] | None]:
        return [self._embed(f"{chunk.title}\n{chunk.content}") for chunk in chunks]

    def _embed(self, text: str) -> list[float] | None:
        try:
            from sentence_transformers import SentenceTransformer
        except Exception:
            return None
        model = self._get_model()
        vector = model.encode([text], normalize_embeddings=True)[0]
        return [float(v) for v in vector]

    @lru_cache(maxsize=1)
    def _get_model(self):
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(self.embedding_model)

    def _keyword_search(self, query: str, top_k: int) -> list[KnowledgeHit]:
        query_terms = set(self.keywords(query))
        if not query_terms:
            return []
        scored: list[KnowledgeHit] = []
        for chunk in self._chunks:
            text = f"{chunk.title}\n{chunk.content}"
            overlap = sum(1 for term in query_terms if term in text)
            if overlap <= 0:
                continue
            score = overlap / max(len(query_terms), 1)
            scored.append(KnowledgeHit(chunk.source, chunk.title, chunk.content, score))
        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[:top_k]

    def _cosine_similarity(self, left: list[float], right: list[float]) -> float:
        dot = sum(a * b for a, b in zip(left, right))
        left_norm = math.sqrt(sum(a * a for a in left))
        right_norm = math.sqrt(sum(b * b for b in right))
        if not left_norm or not right_norm:
            return 0.0
        return dot / (left_norm * right_norm)


@lru_cache(maxsize=1)
def get_knowledge_service() -> KnowledgeService:
    return KnowledgeService()
