"""production workflow, outbox, and idempotency tables

Revision ID: 0002_production_workflow_outbox
Revises: 0001_initial
Create Date: 2026-03-30
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_production_workflow_outbox"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("parent_task_depth", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("tasks", sa.Column("evaluation_queued", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("evaluations", sa.Column("override_reason", sa.Text(), nullable=True))

    op.create_table(
        "project_process_configs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("project_id", sa.String(length=36), sa.ForeignKey("projects.id"), nullable=False, unique=True),
        sa.Column("template_name", sa.String(length=120), nullable=False),
        sa.Column("workflow_stages", sa.JSON(), nullable=False),
        sa.Column("transition_matrix", sa.JSON(), nullable=False),
        sa.Column("wip_limits", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "task_transitions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("task_id", sa.String(length=36), sa.ForeignKey("tasks.id"), nullable=False),
        sa.Column("project_id", sa.String(length=36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("from_status", sa.String(length=50), nullable=False),
        sa.Column("to_status", sa.String(length=50), nullable=False),
        sa.Column("actor_id", sa.String(length=255), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_task_transitions_task_id", "task_transitions", ["task_id"])

    op.create_table(
        "outbox_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("aggregate_type", sa.String(length=120), nullable=False),
        sa.Column("aggregate_id", sa.String(length=255), nullable=False),
        sa.Column("project_id", sa.String(length=36), nullable=True),
        sa.Column("event_type", sa.String(length=120), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("retry_count", sa.Integer(), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_outbox_events_status_available_at", "outbox_events", ["status", "available_at"])

    op.create_table(
        "idempotency_records",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False, unique=True),
        sa.Column("response", sa.JSON(), nullable=False),
        sa.Column("stored_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("idempotency_records")
    op.drop_index("ix_outbox_events_status_available_at", table_name="outbox_events")
    op.drop_table("outbox_events")
    op.drop_index("ix_task_transitions_task_id", table_name="task_transitions")
    op.drop_table("task_transitions")
    op.drop_table("project_process_configs")
    op.drop_column("evaluations", "override_reason")
    op.drop_column("tasks", "evaluation_queued")
    op.drop_column("tasks", "parent_task_depth")
