from __future__ import annotations

import os

import pytest

# Keep tests deterministic and independent from local Postgres .env settings.
os.environ["DATABASE_URL"] = "sqlite:///./sentientops_test.db"
os.environ["SENTIENTOPS_SEED_DEMO_DATA"] = "false"

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.services.repository import Repository


@pytest.fixture(autouse=True)
def reset_database_state():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        Repository(session).clear_all()
    finally:
        session.close()
    yield
    session = SessionLocal()
    try:
        Repository(session).clear_all()
    finally:
        session.close()
