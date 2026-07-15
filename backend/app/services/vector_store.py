from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any
from uuid import uuid4

from app.core.config import get_settings


@dataclass(frozen=True)
class VectorDocument:
    id: str
    text: str
    payload: dict[str, Any]
    score: float | None = None


class VectorStoreService:
    """Thin Qdrant wrapper used by RAG and semantic memory.

    The service degrades to no-op when Qdrant or the embedding model is not
    available, keeping local development lightweight while preserving the
    production-oriented design.
    """

    def __init__(self):
        self.settings = get_settings()
        self._client = self._build_client()

    def available(self) -> bool:
        return self._client is not None

    def search(
        self,
        collection_name: str,
        query: str,
        filters: dict[str, Any] | None = None,
        top_k: int = 5,
    ) -> list[VectorDocument]:
        if not self._client or not query.strip():
            return []
        vector = self._embed(query)
        if vector is None:
            return []
        try:
            points = self._client.search(
                collection_name=collection_name,
                query_vector=vector,
                query_filter=self._build_filter(filters or {}),
                limit=top_k,
                with_payload=True,
            )
        except Exception:
            return []
        result: list[VectorDocument] = []
        for point in points:
            payload = dict(point.payload or {})
            text = str(payload.get("text") or "")
            result.append(VectorDocument(str(point.id), text, payload, float(point.score)))
        return result

    def upsert_texts(
        self,
        collection_name: str,
        items: list[tuple[str, dict[str, Any]]],
    ) -> int:
        if not self._client or not items:
            return 0
        vectors = []
        for text, payload in items:
            vector = self._embed(text)
            if vector is None:
                continue
            vectors.append((text, payload, vector))
        if not vectors:
            return 0
        self._ensure_collection(collection_name, len(vectors[0][2]))
        try:
            from qdrant_client.models import PointStruct

            points = [
                PointStruct(
                    id=str(uuid4()),
                    vector=vector,
                    payload={**payload, "text": text},
                )
                for text, payload, vector in vectors
            ]
            self._client.upsert(collection_name=collection_name, points=points)
            return len(points)
        except Exception:
            return 0

    def _build_client(self):
        if not self.settings.qdrant_url:
            return None
        try:
            from qdrant_client import QdrantClient

            return QdrantClient(url=self.settings.qdrant_url, api_key=self.settings.qdrant_api_key or None)
        except Exception:
            return None

    def _ensure_collection(self, collection_name: str, vector_size: int) -> None:
        if not self._client:
            return
        try:
            self._client.get_collection(collection_name)
            return
        except Exception:
            pass
        try:
            from qdrant_client.models import Distance, VectorParams

            self._client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
            )
        except Exception:
            return

    def _build_filter(self, filters: dict[str, Any]):
        if not filters:
            return None
        try:
            from qdrant_client.models import FieldCondition, Filter, MatchAny, MatchValue

            conditions = []
            for key, value in filters.items():
                if value is None:
                    continue
                match = MatchAny(any=value) if isinstance(value, list) else MatchValue(value=value)
                conditions.append(FieldCondition(key=key, match=match))
            return Filter(must=conditions) if conditions else None
        except Exception:
            return None

    def _embed(self, text: str) -> list[float] | None:
        try:
            model = self._get_model(self.settings.embedding_model)
            vector = model.encode([text], normalize_embeddings=True)[0]
            return [float(item) for item in vector]
        except Exception:
            return None

    @staticmethod
    @lru_cache(maxsize=2)
    def _get_model(model_name: str):
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(model_name)


@lru_cache(maxsize=1)
def get_vector_store_service() -> VectorStoreService:
    return VectorStoreService()
