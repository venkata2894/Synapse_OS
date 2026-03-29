"""initial scaffold entities

Revision ID: 0001_initial
Revises:
Create Date: 2026-03-28
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("objective", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("owner", sa.String(length=255), nullable=False),
        sa.Column("manager_agent_id", sa.String(length=36), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "agents",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("project_id", sa.String(length=36), sa.ForeignKey("projects.id"), nullable=True),
        sa.Column("capabilities", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("memory_profile_id", sa.String(length=255), nullable=True),
        sa.Column("evaluation_profile_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("project_id", sa.String(length=36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("parent_task_id", sa.String(length=36), sa.ForeignKey("tasks.id"), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("created_by", sa.String(length=36), nullable=False),
        sa.Column("assigned_to", sa.String(length=36), nullable=True),
        sa.Column("priority", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("dependencies", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("acceptance_criteria", sa.Text(), nullable=False),
        sa.Column("context_refs", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("blocker_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "worklogs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("task_id", sa.String(length=36), sa.ForeignKey("tasks.id"), nullable=False),
        sa.Column("agent_id", sa.String(length=36), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("action_type", sa.String(length=50), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("detailed_log", sa.Text(), nullable=False),
        sa.Column("artifacts", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "handovers",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("task_id", sa.String(length=36), sa.ForeignKey("tasks.id"), nullable=False),
        sa.Column("project_id", sa.String(length=36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("from_agent_id", sa.String(length=36), nullable=False),
        sa.Column("to_agent_id", sa.String(length=36), nullable=False),
        sa.Column("completed_work", sa.Text(), nullable=False),
        sa.Column("pending_work", sa.Text(), nullable=False),
        sa.Column("blockers", sa.Text(), nullable=False),
        sa.Column("risks", sa.Text(), nullable=False),
        sa.Column("next_steps", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "evaluations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("project_id", sa.String(length=36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("task_id", sa.String(length=36), sa.ForeignKey("tasks.id"), nullable=False),
        sa.Column("agent_id", sa.String(length=36), sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("evaluator_agent_id", sa.String(length=36), nullable=False),
        sa.Column("score_completion", sa.Integer(), nullable=False),
        sa.Column("score_quality", sa.Integer(), nullable=False),
        sa.Column("score_reliability", sa.Integer(), nullable=False),
        sa.Column("score_handover", sa.Integer(), nullable=False),
        sa.Column("score_context", sa.Integer(), nullable=False),
        sa.Column("score_clarity", sa.Integer(), nullable=False),
        sa.Column("score_improvement", sa.Integer(), nullable=False),
        sa.Column("missed_points", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("strengths", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("weaknesses", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("recommendations", sa.Text(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "evaluation_override_audit",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("evaluation_id", sa.String(length=36), sa.ForeignKey("evaluations.id"), nullable=False),
        sa.Column("owner_id", sa.String(length=255), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("original_scores", sa.JSON(), nullable=False),
        sa.Column("override_scores", sa.JSON(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "memory_entries",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("project_id", sa.String(length=36), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("task_id", sa.String(length=36), sa.ForeignKey("tasks.id"), nullable=True),
        sa.Column("agent_id", sa.String(length=36), sa.ForeignKey("agents.id"), nullable=True),
        sa.Column("memory_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source_ref", sa.String(length=255), nullable=True),
        sa.Column("importance", sa.Integer(), nullable=False),
        sa.Column("is_curated", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("promotion_status", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("memory_entries")
    op.drop_table("evaluation_override_audit")
    op.drop_table("evaluations")
    op.drop_table("handovers")
    op.drop_table("worklogs")
    op.drop_table("tasks")
    op.drop_table("agents")
    op.drop_table("projects")

