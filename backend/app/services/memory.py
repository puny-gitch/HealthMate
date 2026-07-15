from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.core.config import get_settings
from app.services.vector_store import VectorDocument, get_vector_store_service


@dataclass(frozen=True)
class SemanticMemory:
    text: str
    memory_type: str
    source_type: str | None
    source_id: str | None
    importance: int
    score: float | None = None


class MemoryService:
    """Semantic long-term memory backed by Qdrant."""

    def __init__(self):
        self.settings = get_settings()
        self.vector_store = get_vector_store_service()

    def remember(
        self,
        user_id: int,
        text: str,
        memory_type: str,
        source_type: str | None = None,
        source_id: str | None = None,
        importance: int = 1,
    ) -> bool:
        if not text.strip():
            return False
        payload = {
            "user_id": user_id,
            "memory_type": memory_type,
            "source_type": source_type,
            "source_id": source_id,
            "importance": importance,
            "created_at": datetime.utcnow().isoformat(),
        }
        count = self.vector_store.upsert_texts(self.settings.qdrant_memory_collection, [(text, payload)])
        return count > 0

    def retrieve(
        self,
        user_id: int,
        query: str,
        memory_types: list[str] | None = None,
        top_k: int = 5,
    ) -> list[SemanticMemory]:
        filters = {"user_id": user_id}
        if memory_types:
            filters["memory_type"] = memory_types
        docs = self.vector_store.search(
            self.settings.qdrant_memory_collection,
            query,
            filters=filters,
            top_k=top_k,
        )
        return [self._from_document(doc) for doc in docs]

    def _from_document(self, doc: VectorDocument) -> SemanticMemory:
        payload = doc.payload
        return SemanticMemory(
            text=doc.text,
            memory_type=str(payload.get("memory_type") or "general"),
            source_type=payload.get("source_type"),
            source_id=payload.get("source_id"),
            importance=int(payload.get("importance") or 1),
            score=doc.score,
        )
