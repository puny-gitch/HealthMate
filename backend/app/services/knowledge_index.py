from __future__ import annotations

from app.core.config import get_settings
from app.services.knowledge import get_knowledge_service
from app.services.vector_store import get_vector_store_service


class KnowledgeIndexService:
    def __init__(self):
        self.settings = get_settings()
        self.knowledge_service = get_knowledge_service()
        self.vector_store = get_vector_store_service()

    def index_markdown_knowledge(self) -> dict:
        chunks = self.knowledge_service.chunks()
        items = [
            (
                f"{chunk.title}\n{chunk.content}",
                {
                    "source": chunk.source,
                    "title": chunk.title,
                    "topic": chunk.source,
                    "tags": [chunk.source],
                    "risk_level": "normal",
                },
            )
            for chunk in chunks
        ]
        indexed = self.vector_store.upsert_texts(self.settings.qdrant_knowledge_collection, items)
        return {
            "collection": self.settings.qdrant_knowledge_collection,
            "totalChunks": len(chunks),
            "indexedChunks": indexed,
            "qdrantAvailable": self.vector_store.available(),
        }
