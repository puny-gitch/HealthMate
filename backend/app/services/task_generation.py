from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from difflib import SequenceMatcher
import json
from uuid import uuid4

import httpx

from app.core.config import get_settings
from app.models.daily_task import DailyTask
from app.services.task import TaskService


@dataclass
class TaskCandidate:
    draft_id: str
    task_content: str
    ai_reason: str
    difficulty: str
    similarity_warning: bool = False


class TaskGenerationService:
    def __init__(self):
        self.task_service = TaskService()

    def generate_candidates(self, context: dict, max_tasks: int = 3) -> tuple[list[TaskCandidate], list[str]]:
        completed_contents = self._task_contents(context, "today_completed_task_contents", "completed_tasks")
        pending_contents = self._task_contents(context, "today_unfinished_task_contents", "pending_tasks")
        candidates = self._build_ai_candidates(context, max_tasks) or self._build_rule_candidates(context)
        result: list[TaskCandidate] = []
        skipped: list[str] = []

        for candidate in candidates:
            if self.is_similar_to_any(candidate.task_content, completed_contents):
                skipped.append(f"已完成任务中已有相似任务：{candidate.task_content}")
                continue
            similar_pending = self._find_similar(candidate.task_content, pending_contents)
            if similar_pending:
                optimized = self._optimize_pending_task(candidate, similar_pending)
                if not self.is_similar_to_any(optimized.task_content, [item.task_content for item in result]):
                    result.append(optimized)
                continue
            if not self.is_similar_to_any(candidate.task_content, [item.task_content for item in result]):
                result.append(candidate)
            if len(result) >= max_tasks:
                break

        if not result:
            skipped.append("今日已完成或待办任务覆盖了主要建议方向，暂不生成重复任务。")
        return result[:max_tasks], skipped

    def build_context(
        self,
        user,
        health_records: list,
        today_tasks: list[DailyTask],
        history_tasks: list[DailyTask],
        latest_advice,
        latest_summary,
        target_date: date,
    ) -> dict:
        completed = [task for task in today_tasks if task.status == 1]
        pending = [task for task in today_tasks if task.status == 0]
        return {
            "target_date": target_date.isoformat(),
            "profile": {
                "userId": user.user_id if user else None,
                "gender": user.gender if user else None,
                "height": float(user.height) if user and user.height is not None else None,
                "weight": float(user.weight) if user and user.weight is not None else None,
                "healthGoal": user.health_goal if user else None,
                "injuryHistory": user.injury_history if user else None,
                "allergyHistory": user.allergy_history if user else None,
                "medicalHistory": user.medical_history if user else None,
            },
            "health_records": [self._serialize_health_record(record) for record in health_records],
            "all_tasks": [self._serialize_task(task) for task in history_tasks],
            "today_completed_tasks": [self._serialize_task(task) for task in completed],
            "today_unfinished_tasks": [self._serialize_task(task) for task in pending],
            "today_completed_task_contents": [task.task_content for task in completed],
            "today_unfinished_task_contents": [task.task_content for task in pending],
            "history_completion_rate": self.task_service.completion_rate(history_tasks),
            "latest_advice": latest_advice.advice_text if latest_advice else None,
            "latest_summary": {
                "summaryContent": latest_summary.summary_content,
                "healthTrend": latest_summary.health_trend,
                "summaryDate": latest_summary.summary_date.isoformat(),
            }
            if latest_summary
            else None,
        }

    def _build_rule_candidates(self, context: dict) -> list[TaskCandidate]:
        profile = context.get("profile") or {}
        goal = profile.get("healthGoal") or context.get("health_goal") or "保持健康"
        injury = profile.get("injuryHistory") or context.get("injury_history") or ""
        records = context.get("health_records") or context.get("recent_records") or []
        avg_sleep = self._avg([record.get("sleepMinutes") for record in records if record.get("sleepMinutes") is not None])
        intake_total = sum(record.get("estimatedIntakeKcal") or 0 for record in records)
        burn_total = sum(record.get("estimatedBurnKcal") or 0 for record in records)
        latest_tags = []
        for record in records[-5:]:
            latest_tags.extend(record.get("healthTags") or [])

        candidates: list[TaskCandidate] = []
        if avg_sleep and avg_sleep < 420:
            candidates.append(
                TaskCandidate(
                    str(uuid4()),
                    "23:30 前放下电子设备并准备入睡",
                    "近期睡眠偏少，先稳定作息比增加训练更重要",
                    "easy",
                )
            )

        low_impact = any(word in injury for word in ["膝", "踝", "腰", "腿"])
        if "减脂" in goal or burn_total < max(intake_total * 0.08, 150):
            content = "晚饭后快走 20 分钟，避免跑跳动作" if low_impact else "晚饭后快走或慢跑 20 分钟"
            reason = "结合减脂目标和伤病史，优先选择低冲击运动" if low_impact else "提升日常消耗，并且强度适合持续执行"
            candidates.append(TaskCandidate(str(uuid4()), content, reason, "easy"))

        if any("饮食" in tag or "糖" in tag for tag in latest_tags) or intake_total > 0:
            candidates.append(
                TaskCandidate(
                    str(uuid4()),
                    "下一餐先记录主食、蛋白质和饮料",
                    "补齐饮食结构信息，后续建议会更贴合实际摄入",
                    "easy",
                )
            )

        if context.get("history_completion_rate", 0) < 50:
            candidates.append(
                TaskCandidate(
                    str(uuid4()),
                    "选择一个 10 分钟内能完成的小健康动作",
                    "近期完成率偏低，降低任务门槛更容易恢复节奏",
                    "easy",
                )
            )

        candidates.append(
            TaskCandidate(
                str(uuid4()),
                "今晚睡前补充一条真实健康记录",
                "持续记录能让建议和趋势判断更准确",
                "easy",
            )
        )
        return candidates

    def _build_ai_candidates(self, context: dict, max_tasks: int) -> list[TaskCandidate]:
        settings = get_settings()
        if settings.ai_mode != "llm" or not settings.llm_api_base or not settings.llm_api_key:
            return []
        try:
            response = httpx.post(
                self._chat_completions_url(settings.llm_api_base),
                headers={
                    "Authorization": f"Bearer {settings.llm_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.llm_model,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "你是健康习惯任务生成器，只输出 JSON。"
                                "必须基于用户档案、全部健康记录、全部任务及状态生成候选任务。"
                                "严禁生成与 today_completed_tasks 中已完成任务语义相似的任务。"
                                "如果与 today_unfinished_tasks 相似，应生成优化版任务，降低难度或调整时间。"
                                "不要输出疾病诊断、处方或高风险医疗建议。"
                            ),
                        },
                        {
                            "role": "user",
                            "content": (
                                "请生成 1 到 "
                                f"{max_tasks} 个候选任务，返回 JSON："
                                "{\"candidates\":[{\"taskContent\":\"...\",\"aiReason\":\"...\","
                                "\"difficulty\":\"easy|medium|hard\",\"similarityWarning\":false}],"
                                "\"skippedReasons\":[\"...\"]}。"
                                "任务必须短小、可执行、当天能完成。"
                                "上下文如下："
                                f"{json.dumps(context, ensure_ascii=False, default=str)}"
                            ),
                        },
                    ],
                    "temperature": 0.4,
                    "response_format": {"type": "json_object"},
                },
                timeout=settings.llm_timeout_seconds,
            )
            response.raise_for_status()
            payload = json.loads(response.json()["choices"][0]["message"]["content"])
            raw_candidates = payload.get("candidates") or []
            return [
                TaskCandidate(
                    str(item.get("draftId") or uuid4()),
                    str(item.get("taskContent") or "").strip(),
                    str(item.get("aiReason") or "基于用户历史健康数据生成").strip(),
                    str(item.get("difficulty") or "easy").strip(),
                    bool(item.get("similarityWarning", False)),
                )
                for item in raw_candidates
                if isinstance(item, dict) and str(item.get("taskContent") or "").strip()
            ][:max_tasks]
        except Exception:
            return []

    def _optimize_pending_task(self, candidate: TaskCandidate, pending_content: str) -> TaskCandidate:
        return TaskCandidate(
            str(uuid4()),
            f"优化未完成任务：{self._soften_task(pending_content)}",
            f"已有相似未完成任务，本次不新增重复方向，而是降低难度：{candidate.ai_reason}",
            "easy",
            True,
        )

    def _soften_task(self, content: str) -> str:
        if "20" in content:
            return content.replace("20", "10")
        if "30" in content:
            return content.replace("30", "15")
        return f"{content}，先完成一半目标"

    def is_similar_to_any(self, content: str, others: list[str]) -> bool:
        return bool(self._find_similar(content, others))

    def _find_similar(self, content: str, others: list[str]) -> str | None:
        for other in others:
            if self._similarity(content, other) >= 0.58:
                return other
        return None

    def _similarity(self, left: str, right: str) -> float:
        left_tokens = self._tokens(left)
        right_tokens = self._tokens(right)
        overlap = len(left_tokens & right_tokens) / max(len(left_tokens | right_tokens), 1)
        sequence = SequenceMatcher(None, left, right).ratio()
        return max(overlap, sequence)

    def _tokens(self, text: str) -> set[str]:
        keywords = {
            "睡眠",
            "入睡",
            "早睡",
            "快走",
            "跑步",
            "运动",
            "饮食",
            "记录",
            "主食",
            "蛋白质",
            "饮料",
            "晚饭",
            "减脂",
        }
        return {word for word in keywords if word in text}

    def _avg(self, values: list[int]) -> int:
        if not values:
            return 0
        return int(sum(values) / len(values))

    def _task_contents(self, context: dict, new_key: str, legacy_key: str) -> list[str]:
        if context.get(new_key):
            return list(context[new_key])
        legacy = context.get(legacy_key) or []
        return [task.task_content for task in legacy if hasattr(task, "task_content")]

    def _serialize_health_record(self, record) -> dict:
        return {
            "recordId": record.record_id,
            "recordDate": record.record_date.isoformat(),
            "recordedAt": record.recorded_at.isoformat(),
            "recordType": record.record_type,
            "rawInput": record.raw_input,
            "sleepMinutes": record.sleep_minutes,
            "estimatedIntakeKcal": record.estimated_intake_kcal,
            "estimatedBurnKcal": record.estimated_burn_kcal,
            "nutritionDetails": record.nutrition_details,
            "exerciseDetails": record.exercise_details,
            "healthTags": record.health_tags or [],
            "confidence": record.confidence,
        }

    def _serialize_task(self, task: DailyTask) -> dict:
        return {
            "taskId": task.task_id,
            "taskDate": task.task_date.isoformat(),
            "taskContent": task.task_content,
            "status": task.status,
            "statusText": {0: "unfinished", 1: "completed", 2: "archived"}.get(task.status, "unknown"),
            "aiReason": task.ai_reason,
            "updatedAt": task.updated_at.isoformat(),
        }

    def _chat_completions_url(self, api_base: str) -> str:
        base = api_base.rstrip("/")
        if base.endswith("/chat/completions"):
            return base
        return f"{base}/chat/completions"
