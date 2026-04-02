from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: int
    email: EmailStr
    username: str
    is_admin: bool

    model_config = {
        "from_attributes": True
    }


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    is_admin: bool

    model_config = {
        "from_attributes": True
    }


class BarathonStopCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    stop_type: str = Field(default="bar")
    latitude: float
    longitude: float
    stop_order: int = Field(ge=1)

    @field_validator("stop_type")
    @classmethod
    def validate_stop_type(cls, value: str) -> str:
        allowed = {"bar", "food", "meeting_point", "other"}
        if value not in allowed:
            raise ValueError(f"stop_type must be one of: {', '.join(sorted(allowed))}")
        return value

    @field_validator("latitude")
    @classmethod
    def validate_latitude(cls, value: float) -> float:
        if value < -90 or value > 90:
            raise ValueError("latitude must be between -90 and 90")
        return value

    @field_validator("longitude")
    @classmethod
    def validate_longitude(cls, value: float) -> float:
        if value < -180 or value > 180:
            raise ValueError("longitude must be between -180 and 180")
        return value


class BarathonStopRead(BaseModel):
    id: int
    name: str
    stop_type: str
    latitude: float
    longitude: float
    stop_order: int

    model_config = {
        "from_attributes": True
    }


class BarathonCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    start_datetime: datetime
    travel_time_between_bars_minutes: int = Field(ge=0)
    max_time_in_bar_minutes: int = Field(gt=0)
    stops: list[BarathonStopCreate] = Field(default_factory=list)


class BarathonRead(BaseModel):
    id: int
    name: str
    start_datetime: datetime
    has_started: bool
    status: str
    travel_time_between_bars_minutes: int
    max_time_in_bar_minutes: int
    created_by_user_id: int
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    stops: list[BarathonStopRead] = []

    model_config = {
        "from_attributes": True
    }

class UpdateBarathonStartDatetime(BaseModel):
    start_datetime: datetime

class BarathonParticipantRead(BaseModel):
    id: int
    role: str
    user: UserRead

    model_config = {
        "from_attributes": True
    }


class BarathonCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    start_datetime: datetime
    end_datetime: datetime
    travel_time_between_bars_minutes: int = Field(ge=0)
    max_time_in_bar_minutes: int = Field(gt=0)
    participant_user_ids: list[int] = Field(default_factory=list)
    stops: list[BarathonStopCreate] = Field(default_factory=list)


class BarathonRead(BaseModel):
    id: int
    name: str
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    has_started: bool
    status: str
    travel_time_between_bars_minutes: int
    max_time_in_bar_minutes: int
    created_by_user_id: int
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    participants: list[BarathonParticipantRead] = []
    stops: list[BarathonStopRead] = []

    model_config = {
        "from_attributes": True
    }

class BarathonParticipantsUpdate(BaseModel):
    participant_user_ids: list[int] = Field(default_factory=list)

class ActiveBarathonStopRead(BaseModel):
    id: int
    name: str
    stop_type: str
    latitude: float
    longitude: float
    stop_order: int

    model_config = {
        "from_attributes": True
    }


class ActiveBarathonRead(BaseModel):
    id: int
    name: str
    status: str
    start_datetime: datetime
    end_datetime: Optional[datetime] = None
    max_time_in_bar_minutes: int
    travel_time_between_bars_minutes: int
    stops: list[ActiveBarathonStopRead] = []

    model_config = {
        "from_attributes": True
    }

class RoleRead(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    model_config = {
        "from_attributes": True
    }
class BarathonParticipantWithUserRead(BaseModel):
    id: int
    role: str
    user: UserRead

    model_config = {
        "from_attributes": True
    }
class BarathonParticipantRoleAssignmentInput(BaseModel):
    user_id: int
    role_id: int
    
class AssignBarathonRolesPayload(BaseModel):
    assignments: list[BarathonParticipantRoleAssignmentInput]
    
class BarathonParticipantRoleRead(BaseModel):
    id: int
    assigned_at: datetime
    user: UserRead
    role: RoleRead

    model_config = {
        "from_attributes": True
    }
