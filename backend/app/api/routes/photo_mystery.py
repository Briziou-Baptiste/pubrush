import uuid
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.deps.auth import get_current_user
from app.core.rate_limiter import InMemoryRateLimiter
from app.db import get_db
from app.models import Barathon, User
from app.photo_schemas import (
    PhotoAnswerPayload,
    PhotoChallengeCreate,
    PhotoChallengeItemRead,
    PhotoClaimUploadRequest,
    PhotoClaimUploadResponse,
    PhotoDraftResponse,
    PhotoMysteryStateResponse,
    PhotoPublishPayload,
)
from app.security import decode_access_token
from app.services.photo_service import PhotoService


router = APIRouter(tags=["photo-mystery"])

claim_upload_limiter = InMemoryRateLimiter(requests_limit=15, window_seconds=60)
MAX_UPLOAD_BYTES = 2 * 1024 * 1024  # 2 MiB


def get_barathon_or_404(barathon_id: int, db: Session = Depends(get_db)) -> Barathon:
    b = db.get(Barathon, barathon_id)
    if not b:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Barathon introuvable.",
        )
    return b


# 1. État global du jeu pour un barathon
@router.get(
    "/barathons/{barathon_id}/photo-mystery",
    response_model=PhotoMysteryStateResponse,
)
def get_photo_mystery_state(
    barathon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    barathon: Barathon = Depends(get_barathon_or_404),
):
    return PhotoService.get_state(db, barathon, current_user)


# 2. Création d'un défi (draft) par un auteur
@router.post(
    "/barathons/{barathon_id}/photo-mystery/challenges",
    response_model=PhotoDraftResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_challenge_draft(
    barathon_id: int,
    payload: PhotoChallengeCreate,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    barathon: Barathon = Depends(get_barathon_or_404),
):
    key = uuid.uuid4()
    if idempotency_key:
        try:
            key = uuid.UUID(idempotency_key)
        except ValueError:
            pass

    return PhotoService.create_draft(db, barathon, current_user, payload, key)


# 3. Échange atomique du code de capture contre un jeton d'upload (pour la page web)
@router.post(
    "/photo-mystery/claim-upload",
    response_model=PhotoClaimUploadResponse,
    dependencies=[Depends(claim_upload_limiter)],
)
def claim_upload_code(
    payload: PhotoClaimUploadRequest,
    db: Session = Depends(get_db),
):
    token, challenge_id, expires_at = PhotoService.claim_upload_code(db, payload.code)
    return PhotoClaimUploadResponse(
        upload_token=token,
        challenge_id=challenge_id,
        expires_at=expires_at,
    )


# 4. Upload binaire de la photo (avec limites de ressources strictes et exécution threadée)
@router.post(
    "/photo-mystery/upload",
    status_code=status.HTTP_201_CREATED,
)
async def upload_photo_file(
    request: Request,
    file: UploadFile = File(...),
    authorization: str = Header(..., alias="Authorization"),
    db: Session = Depends(get_db),
):
    # Contrôle de taille préalable via Content-Length (rejet immédiat avant lecture)
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_UPLOAD_BYTES + 65536:
                raise HTTPException(
                    status_code=413,
                    detail="Fichier trop volumineux (maximum 2 MiB).",
                )
        except ValueError:
            pass

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant ou format invalide.")

    token = authorization.split("Bearer ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload or payload.get("scope") != "photo_upload":
        raise HTTPException(status_code=401, detail="Jeton de capacité d'upload invalide ou expiré.")

    challenge_id_str = payload.get("challenge_id")
    if not challenge_id_str:
        raise HTTPException(status_code=400, detail="Token d'upload incomplet.")

    challenge_id = uuid.UUID(challenge_id_str)

    # Lecture bornée par morceaux pour éviter tout pic mémoire
    chunks = []
    total_bytes = 0
    chunk_size = 64 * 1024
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total_bytes += len(chunk)
        if total_bytes > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Fichier trop volumineux (maximum 2 MiB).",
            )
        chunks.append(chunk)

    raw_bytes = b"".join(chunks)

    # Exécution du traitement Pillow hors de la boucle d'événements asynchrone principale
    media_id, w, h = await run_in_threadpool(
        PhotoService.upload_photo, db, challenge_id, raw_bytes, payload
    )
    return {
        "media_id": str(media_id),
        "width": w,
        "height": h,
        "status": "ready",
    }


# 5. Publication du défi par l'auteur
@router.post(
    "/barathons/{barathon_id}/photo-mystery/challenges/{challenge_id}/publish",
    response_model=PhotoChallengeItemRead,
)
async def publish_challenge(
    barathon_id: int,
    challenge_id: uuid.UUID,
    payload: PhotoPublishPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    barathon: Barathon = Depends(get_barathon_or_404),
):
    return await PhotoService.publish_challenge(db, barathon, challenge_id, current_user, payload)


# 6. Soumission de réponse ou Passer
@router.post(
    "/barathons/{barathon_id}/photo-mystery/challenges/{challenge_id}/answer",
    response_model=PhotoChallengeItemRead,
)
async def submit_answer(
    barathon_id: int,
    challenge_id: uuid.UUID,
    payload: PhotoAnswerPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    barathon: Barathon = Depends(get_barathon_or_404),
):
    return await PhotoService.submit_answer(db, barathon, challenge_id, current_user, payload)


# 7. Lecture de la photo JPEG déchiffrée
@router.get(
    "/barathons/{barathon_id}/photo-mystery/challenges/{challenge_id}/photo",
)
def get_challenge_photo(
    barathon_id: int,
    challenge_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    barathon: Barathon = Depends(get_barathon_or_404),
):
    jpeg_bytes = PhotoService.get_photo_bytes(db, barathon, challenge_id, current_user)
    return Response(
        content=jpeg_bytes,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "private, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
        },
    )


# 8. Annulation ou retrait d'un défi
@router.delete(
    "/barathons/{barathon_id}/photo-mystery/challenges/{challenge_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_challenge(
    barathon_id: int,
    challenge_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    barathon: Barathon = Depends(get_barathon_or_404),
):
    PhotoService.delete_challenge(db, barathon, challenge_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
