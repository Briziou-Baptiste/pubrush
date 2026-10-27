import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    JSON,
    LargeBinary,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator, CHAR

from app.db import Base


# Helper for SQLite and PostgreSQL compatibility with UUIDs
class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type, otherwise uses CHAR(36), storing as stringified hex values.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID())
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == "postgresql":
            return str(value)
        else:
            if not isinstance(value, uuid.UUID):
                return str(uuid.UUID(str(value)))
            else:
                return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, uuid.UUID):
                return uuid.UUID(str(value))
            else:
                return value


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PhotoChallenge(Base):
    __tablename__ = "photo_challenges"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    barathon_id = Column(Integer, ForeignKey("barathons.id", ondelete="CASCADE"), nullable=False, index=True)
    creator_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    creator_membership_id = Column(Integer, ForeignKey("barathon_participants.id", ondelete="SET NULL"), nullable=True)

    state = Column(String(32), nullable=False, default="draft")  # draft, published, closed, cancelled, expired
    question = Column(Text, nullable=True)
    options = Column(JSON, nullable=True)
    correct_index = Column(SmallInteger, nullable=True)
    content_removed_at = Column(DateTime(timezone=True), nullable=True)

    create_key = Column(GUID, nullable=False, default=uuid.uuid4)
    create_fingerprint = Column(String(64), nullable=False)
    upload_code_hash = Column(String(64), nullable=True, index=True)
    code_expires_at = Column(DateTime(timezone=True), nullable=True)
    upload_claim_id = Column(GUID, nullable=True)
    upload_claim_expires_at = Column(DateTime(timezone=True), nullable=True)
    upload_claim_consumed_at = Column(DateTime(timezone=True), nullable=True)
    notice_version = Column(String(32), nullable=False, default="photo-private-2026-10-v1")
    confirmed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    draft_expires_at = Column(DateTime(timezone=True), nullable=False)
    retention_until = Column(DateTime(timezone=True), nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    terminal_at = Column(DateTime(timezone=True), nullable=True)
    terminal_reason = Column(Text, nullable=True)
    version = Column(BigInteger, nullable=False, default=1)
    expected_count = Column(SmallInteger, nullable=True)

    # Relationships
    barathon = relationship("Barathon")
    creator = relationship("User")
    audience = relationship("PhotoAudience", back_populates="challenge", cascade="all, delete-orphan", primaryjoin="PhotoChallenge.id == PhotoAudience.challenge_id")
    answers = relationship("PhotoAnswer", back_populates="challenge", cascade="all, delete-orphan", primaryjoin="PhotoChallenge.id == PhotoAnswer.challenge_id")
    results = relationship("PhotoResult", back_populates="challenge", uselist=False, cascade="all, delete-orphan", primaryjoin="PhotoChallenge.id == PhotoResult.challenge_id")
    media = relationship("PhotoMedia", back_populates="challenge", primaryjoin="PhotoChallenge.id == PhotoMedia.challenge_id")


class PhotoAudience(Base):
    __tablename__ = "photo_audience"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    challenge_id = Column(GUID, ForeignKey("photo_challenges.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    membership_id = Column(Integer, ForeignKey("barathon_participants.id", ondelete="SET NULL"), nullable=True)
    is_creator = Column(Boolean, nullable=False, default=False)

    revoked_at = Column(DateTime(timezone=True), nullable=True)
    result_seen_at = Column(DateTime(timezone=True), nullable=True)
    dare_assigned = Column(Boolean, nullable=True)
    personal_data_removed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("challenge_id", "user_id", name="uq_photo_audience_challenge_user"),
        UniqueConstraint("challenge_id", "id", name="uq_photo_audience_challenge_id"),
    )

    challenge = relationship("PhotoChallenge", back_populates="audience")
    user = relationship("User")
    answer = relationship("PhotoAnswer", back_populates="audience", uselist=False, cascade="all, delete-orphan")


class PhotoAnswer(Base):
    __tablename__ = "photo_answers"

    challenge_id = Column(GUID, ForeignKey("photo_challenges.id", ondelete="CASCADE"), nullable=False, primary_key=True)
    audience_id = Column(GUID, ForeignKey("photo_audience.id", ondelete="CASCADE"), nullable=False, primary_key=True)
    choice_index = Column(SmallInteger, nullable=True)
    passed = Column(Boolean, nullable=False, default=False)
    submitted_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    challenge = relationship("PhotoChallenge", back_populates="answers")
    audience = relationship("PhotoAudience", back_populates="answer")


class PhotoResult(Base):
    __tablename__ = "photo_results"

    challenge_id = Column(GUID, ForeignKey("photo_challenges.id", ondelete="CASCADE"), primary_key=True)
    closed_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    reason = Column(String(32), nullable=False)  # all_handled, deadline

    expected_count = Column(SmallInteger, nullable=False)
    correct_count = Column(SmallInteger, nullable=False)
    incorrect_count = Column(SmallInteger, nullable=False)
    passed_count = Column(SmallInteger, nullable=False)
    missing_count = Column(SmallInteger, nullable=False, default=0)
    creator_dare = Column(Boolean, nullable=False, default=False)

    challenge = relationship("PhotoChallenge", back_populates="results")


class PhotoMedia(Base):
    __tablename__ = "photo_media"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    challenge_id = Column(GUID, ForeignKey("photo_challenges.id", ondelete="SET NULL"), nullable=True, index=True)
    storage_key = Column(GUID, unique=True, nullable=False)
    state = Column(String(32), nullable=False, default="staged")  # staged, ready, delete_pending, deleted

    key_id = Column(String(32), nullable=False, default="k1")
    nonce = Column(LargeBinary, nullable=True)
    input_sha256 = Column(String(64), nullable=True)
    cipher_bytes = Column(Integer, nullable=True)
    jpeg_bytes = Column(Integer, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    purge_due_at = Column(DateTime(timezone=True), nullable=False)
    delete_requested_at = Column(DateTime(timezone=True), nullable=True)
    next_attempt_at = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    attempt_count = Column(Integer, nullable=False, default=0)

    challenge = relationship("PhotoChallenge", back_populates="media")


class PhotoRateEvent(Base):
    __tablename__ = "photo_rate_events"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    operation_id = Column(GUID, nullable=False)
    kind = Column(String(32), nullable=False)  # draft_create, publish
    occurred_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    __table_args__ = (
        UniqueConstraint("operation_id", "kind", name="uq_photo_rate_events_op_kind"),
    )
