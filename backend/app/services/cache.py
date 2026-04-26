import json
import time
from typing import Any

from app.core.config import get_settings


_memory_cache: dict[str, tuple[float, str]] = {}


class CacheService:
    def __init__(self):
        self.settings = get_settings()
        self._redis = self._build_redis_client()

    def get_json(self, key: str) -> Any | None:
        raw_value = self._get(key)
        if raw_value is None:
            return None
        try:
            return json.loads(raw_value)
        except json.JSONDecodeError:
            return None

    def set_json(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        self._set(key, json.dumps(value, ensure_ascii=False), ttl_seconds or self.settings.cache_ttl_seconds)

    def _build_redis_client(self):
        if not self.settings.redis_url:
            return None
        try:
            import redis

            return redis.Redis.from_url(self.settings.redis_url, decode_responses=True)
        except Exception:
            return None

    def _get(self, key: str) -> str | None:
        if self._redis:
            try:
                return self._redis.get(key)
            except Exception:
                return None

        entry = _memory_cache.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if expires_at < time.time():
            _memory_cache.pop(key, None)
            return None
        return value

    def _set(self, key: str, value: str, ttl_seconds: int) -> None:
        if self._redis:
            try:
                self._redis.setex(key, ttl_seconds, value)
                return
            except Exception:
                pass

        _memory_cache[key] = (time.time() + ttl_seconds, value)
