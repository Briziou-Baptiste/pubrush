import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class PhotoChallengeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(..., min_length=3, max_length=180)
    options: List[str] = Field(..., min_length=2, max_length=4)
    correct_index: int = Field(..., ge=0, le=3)
    notice_version: str = Field("photo-private-2026-10-v1", max_length=32)

    @field_validator("options")
    @classmethod
    def validate_options(cls, v: List[str]) -> List[str]:
        cleaned = [opt.strip() for opt in v]
        for opt in cleaned:
            if len(opt) < 1 or len(opt) > 60:
                raise ValueError("Chaque option doit comporter entre 1 et 60 caractères.")
        # Check uniqueness case-insensitively
        lower_set = {opt.lower() for opt in cleaned}
        if len(lower_set) != len(cleaned):
            raise ValueError("Les propositions doivent être uniques.")
        return cleaned

    @field_validator("correct_index")
    @classmethod
    def validate_correct_index(cls, v: int, values) -> int:
        # Note: in pydantic v2 options might not be validated yet if accessed from info
        return v


class PhotoDraftResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    state: str
    upload_code: str
    code_expires_at: datetime
    draft_expires_at: datetime
    notice_version: str


class PhotoClaimUploadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(..., min_length=10, max_length=10)


class PhotoClaimUploadResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    upload_token: str
    challenge_id: uuid.UUID
    expires_at: datetime


class PhotoSubmissionRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    choice_index: Optional[int]
    passed: bool
    submitted_at: datetime


class PhotoResultRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    closed_at: datetime
    reason: str
    expected_count: int
    correct_count: int
    incorrect_count: int
    passed_count: int
    missing_count: Optional[int] = 0
    creator_dare: bool
    my_dare_assigned: Optional[bool] = None


class PhotoChallengeItemRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: uuid.UUID
    version: int
    state: str
    question: Optional[str] = None
    options: Optional[List[str]] = None
    correct_index: Optional[int] = None
    expires_at: Optional[datetime] = None
    my_submission: Optional[PhotoSubmissionRead] = None
    can_answer: bool
    photo_available: bool
    results: Optional[PhotoResultRead] = None


class PhotoMysteryStateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    server_time: datetime
    enabled: bool
    can_create: bool
    pending_count: int
    unseen_results_count: int
    items: List[PhotoChallengeItemRead]


class PhotoAnswerPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    choice_index: Optional[int] = None
    passed: bool = False

    @field_validator("passed")
    @classmethod
    def validate_answer(cls, passed_val: bool, info) -> bool:
        choice = info.data.get("choice_index")
        if passed_val and choice is not None:
            raise ValueError("Une réponse 'Passer' ne doit pas comporter de choix.")
        if not passed_val and choice is None:
            raise ValueError("Un choix doit être sélectionné si vous ne passez pas.")
        return passed_val


class PhotoPublishPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notice_version: str = Field("photo-private-2026-10-v1", max_length=32)
