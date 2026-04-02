from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    created_barathons: Mapped[list["Barathon"]] = relationship(
        back_populates="creator",
        cascade="all, delete-orphan"
    )

    barathon_links: Mapped[list["BarathonParticipant"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )


class Barathon(Base):
    __tablename__ = "barathons"
    __table_args__ = (
        CheckConstraint(
            "status IN ('planned', 'started', 'completed', 'stopped', 'failed')",
            name="chk_barathons_status",
        ),
        CheckConstraint(
            "travel_time_between_bars_minutes >= 0",
            name="chk_barathons_travel_time",
        ),
        CheckConstraint(
            "max_time_in_bar_minutes > 0",
            name="chk_barathons_max_time_in_bar",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    start_datetime: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    end_datetime: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    has_started: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="planned", server_default="planned")
    travel_time_between_bars_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    max_time_in_bar_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    creator: Mapped["User"] = relationship(back_populates="created_barathons")

    participants: Mapped[list["BarathonParticipant"]] = relationship(
        back_populates="barathon",
        cascade="all, delete-orphan",
    )

    stops: Mapped[list["BarathonStop"]] = relationship(
        back_populates="barathon",
        cascade="all, delete-orphan",
        order_by="BarathonStop.stop_order",
    )


class BarathonParticipant(Base):
    __tablename__ = "barathon_participants"
    __table_args__ = (
        UniqueConstraint("barathon_id", "user_id", name="uq_barathon_participant"),
        CheckConstraint(
            "role IN ('creator', 'participant', 'co_host')",
            name="chk_barathon_participants_role",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    barathon_id: Mapped[int] = mapped_column(
        ForeignKey("barathons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="participant", server_default="participant")
    joined_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    barathon: Mapped["Barathon"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship(back_populates="barathon_links")


class BarathonStop(Base):
    __tablename__ = "barathon_stops"
    __table_args__ = (
        UniqueConstraint("barathon_id", "stop_order", name="uq_barathon_stop_order"),
        CheckConstraint(
            "stop_type IN ('bar', 'food', 'meeting_point', 'other')",
            name="chk_barathon_stops_type",
        ),
        CheckConstraint(
            "latitude >= -90 AND latitude <= 90",
            name="chk_barathon_stops_latitude",
        ),
        CheckConstraint(
            "longitude >= -180 AND longitude <= 180",
            name="chk_barathon_stops_longitude",
        ),
        CheckConstraint(
            "stop_order >= 1",
            name="chk_barathon_stops_order",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    barathon_id: Mapped[int] = mapped_column(
        ForeignKey("barathons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    stop_type: Mapped[str] = mapped_column(String(20), nullable=False, default="bar", server_default="bar")
    latitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    stop_order: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    is_completed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    
    entered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
    )

    left_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
    )
    
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True,
    )

    barathon: Mapped["Barathon"] = relationship(back_populates="stops")

class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    participant_assignments: Mapped[list["BarathonParticipantRole"]] = relationship(
        back_populates="role",
        cascade="all, delete-orphan",
    )

class BarathonParticipantRole(Base):
    __tablename__ = "barathon_participant_roles"
    __table_args__ = (
        UniqueConstraint("barathon_id", "user_id", name="uq_barathon_role_user"),
        UniqueConstraint("barathon_id", "role_id", name="uq_barathon_role_unique"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    barathon_id: Mapped[int] = mapped_column(
        ForeignKey("barathons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role_id: Mapped[int] = mapped_column(
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    barathon: Mapped["Barathon"] = relationship()
    user: Mapped["User"] = relationship()
    role: Mapped["Role"] = relationship(back_populates="participant_assignments")
