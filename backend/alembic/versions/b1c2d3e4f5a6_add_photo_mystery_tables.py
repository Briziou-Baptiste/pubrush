"""add_photo_mystery_tables

Revision ID: b1c2d3e4f5a6
Revises: a7b8c9d0e1f2
Create Date: 2026-10-27 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. photo_secure_guests
    op.create_table(
        "photo_secure_guests",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("barathon_id", sa.Integer(), sa.ForeignKey("barathons.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 2. photo_challenges
    op.create_table(
        "photo_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("barathon_id", sa.Integer(), sa.ForeignKey("barathons.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("creator_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("creator_membership_id", sa.Integer(), sa.ForeignKey("barathon_participants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("state", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("question", sa.Text(), nullable=True),
        sa.Column("options", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("correct_index", sa.SmallInteger(), nullable=True),
        sa.Column("content_removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("create_key", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("create_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("upload_code_hash", sa.String(length=64), nullable=True, index=True),
        sa.Column("code_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("upload_claim_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("upload_claim_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("upload_claim_consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notice_version", sa.String(length=32), nullable=False, server_default="photo-private-2026-10-v1"),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("draft_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("retention_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("terminal_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("terminal_reason", sa.Text(), nullable=True),
        sa.Column("version", sa.BigInteger(), nullable=False, server_default="1"),
        sa.Column("expected_count", sa.SmallInteger(), nullable=True),
    )

    # 3. photo_audience
    op.create_table(
        "photo_audience",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("challenge_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("photo_challenges.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("membership_id", sa.Integer(), sa.ForeignKey("barathon_participants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_creator", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("result_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dare_assigned", sa.Boolean(), nullable=True),
        sa.Column("personal_data_removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("challenge_id", "user_id", name="uq_photo_audience_challenge_user"),
        sa.UniqueConstraint("challenge_id", "id", name="uq_photo_audience_challenge_id"),
    )

    # 4. photo_answers
    op.create_table(
        "photo_answers",
        sa.Column("challenge_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("photo_challenges.id", ondelete="CASCADE"), nullable=False, primary_key=True),
        sa.Column("audience_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("photo_audience.id", ondelete="CASCADE"), nullable=False, primary_key=True),
        sa.Column("choice_index", sa.SmallInteger(), nullable=True),
        sa.Column("passed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 5. photo_results
    op.create_table(
        "photo_results",
        sa.Column("challenge_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("photo_challenges.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reason", sa.String(length=32), nullable=False),
        sa.Column("expected_count", sa.SmallInteger(), nullable=False),
        sa.Column("correct_count", sa.SmallInteger(), nullable=False),
        sa.Column("incorrect_count", sa.SmallInteger(), nullable=False),
        sa.Column("passed_count", sa.SmallInteger(), nullable=False),
        sa.Column("missing_count", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("creator_dare", sa.Boolean(), nullable=False, server_default="false"),
    )

    # 6. photo_media
    op.create_table(
        "photo_media",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("challenge_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("photo_challenges.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("storage_key", postgresql.UUID(as_uuid=True), unique=True, nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False, server_default="staged"),
        sa.Column("key_id", sa.String(length=32), nullable=False, server_default="k1"),
        sa.Column("nonce", sa.LargeBinary(), nullable=True),
        sa.Column("input_sha256", sa.String(length=64), nullable=True),
        sa.Column("cipher_bytes", sa.Integer(), nullable=True),
        sa.Column("jpeg_bytes", sa.Integer(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("purge_due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("delete_requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
    )

    # 7. photo_rate_events
    op.create_table(
        "photo_rate_events",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("operation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("operation_id", "kind", name="uq_photo_rate_events_op_kind"),
    )


def downgrade() -> None:
    op.drop_table("photo_rate_events")
    op.drop_table("photo_media")
    op.drop_table("photo_results")
    op.drop_table("photo_answers")
    op.drop_table("photo_audience")
    op.drop_table("photo_challenges")
    op.drop_table("photo_secure_guests")
