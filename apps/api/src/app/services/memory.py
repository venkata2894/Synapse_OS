from __future__ import annotations

from app.models.enums import MemoryPromotionStatus


def suggest_promotion(importance: int, confidence: float) -> bool:
    # Hybrid policy: auto-suggest high-signal entries, manual confirmation required.
    return importance >= 4 and confidence >= 0.7


def apply_promotion_status(approved: bool) -> MemoryPromotionStatus:
    return MemoryPromotionStatus.PROMOTED if approved else MemoryPromotionStatus.SUGGESTED

