from fastapi import APIRouter, Depends

from app.db.session import engine
from app.services.repository import Repository, get_repository

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
def readiness(repo: Repository = Depends(get_repository)) -> dict:
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
    except Exception as exc:  # pragma: no cover - readiness only
        return {"status": "error", "database": "down", "detail": str(exc)}

    return {
        "status": "ok",
        "database": "up",
        "outbox_lag_seconds": round(repo.outbox_lag_seconds(), 2),
    }
