import os
import time
import uuid
from typing import Set
from app.services.photo_storage import get_storage_dir, delete_file

# Rétention maximale des fichiers temporaires non finalisés : 15 minutes
DEFAULT_MAX_TEMP_AGE_SECONDS = 15 * 60


def cleanup_orphaned_files(
    known_storage_keys: Set[uuid.UUID],
    max_temp_age_seconds: int = DEFAULT_MAX_TEMP_AGE_SECONDS,
) -> int:
    """
    Parcourt PHOTO_STORAGE_DIR et supprime :
    1. Tout fichier `.enc` dont la clé n'est pas répertoriée dans known_storage_keys.
    2. Tout fichier temporaire (.tmp_* ou tmp_*) plus vieux que max_temp_age_seconds.
    3. Tout fichier malformé ou résiduel non autorisé.

    Returns:
        Nombre total de fichiers supprimés.
    """
    storage_dir = get_storage_dir()
    if not os.path.isdir(storage_dir):
        return 0

    # Normalisation des clés connues au format UUID et str
    known_uuids = set()
    for k in known_storage_keys:
        if isinstance(k, str):
            try:
                known_uuids.add(uuid.UUID(k))
            except ValueError:
                pass
        elif isinstance(k, uuid.UUID):
            known_uuids.add(k)

    deleted_count = 0
    now = time.time()
    cutoff_temp_time = now - max_temp_age_seconds

    for filename in os.listdir(storage_dir):
        file_path = os.path.join(storage_dir, filename)
        if not os.path.isfile(file_path):
            continue

        try:
            mtime = os.path.getmtime(file_path)
        except OSError:
            continue

        # Cas 1 : Fichiers temporaires d'écriture en cours ou abandonnés
        if filename.startswith((".tmp_", "tmp_")):
            if mtime < cutoff_temp_time:
                try:
                    os.unlink(file_path)
                    deleted_count += 1
                except OSError:
                    pass
            continue

        # Cas 2 : Fichiers chiffrés .enc
        if filename.endswith(".enc"):
            key_str = filename[:-4]
            try:
                file_uuid = uuid.UUID(key_str)
                if file_uuid not in known_uuids:
                    os.unlink(file_path)
                    deleted_count += 1
            except ValueError:
                # Nom malformé se terminant par .enc -> suppression orpheline
                try:
                    os.unlink(file_path)
                    deleted_count += 1
                except OSError:
                    pass
            continue

    return deleted_count


def purge_media_file(storage_key: uuid.UUID) -> bool:
    """
    Supprime immédiatement et physiquement le fichier média chiffré correspondant.
    
    Returns:
        True si supprimé, False s'il n'existait pas.
    """
    return delete_file(storage_key)
