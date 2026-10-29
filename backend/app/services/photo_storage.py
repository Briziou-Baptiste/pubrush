import os
import secrets
import tempfile
import uuid
from typing import Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Magic marker for encrypted PubRush Photo v1
MAGIC_HEADER = b"PRP1"
NONCE_LENGTH = 12  # 96 bits
TAG_LENGTH = 16    # 128 bits
HEADER_LENGTH = len(MAGIC_HEADER) + NONCE_LENGTH

# Clé de chiffrement éphémère par processus (gardée uniquement en mémoire vive)
_EPHEMERAL_PROCESS_KEY = secrets.token_bytes(32)

# Capacité maximale du volume éphémère en RAM (défaut 32 MiB)
def get_max_storage_bytes() -> int:
    return int(os.getenv("PHOTO_STORAGE_MAX_BYTES", str(32 * 1024 * 1024)))


def get_current_storage_usage() -> int:
    """Calcule le volume total consommé par les fichiers dans PHOTO_STORAGE_DIR."""
    storage_dir = os.getenv("PHOTO_STORAGE_DIR", "/tmp/pubrush-photo-media")
    if not os.path.isdir(storage_dir):
        return 0
    total = 0
    try:
        for fname in os.listdir(storage_dir):
            p = os.path.join(storage_dir, fname)
            if os.path.isfile(p):
                total += os.path.getsize(p)
    except OSError:
        pass
    return total


def get_storage_dir() -> str:
    """Retourne et garantit l'existence du dossier de stockage avec permissions 0o700."""
    storage_dir = os.getenv("PHOTO_STORAGE_DIR", "/tmp/pubrush-photo-media")
    os.makedirs(storage_dir, mode=0o700, exist_ok=True)
    try:
        os.chmod(storage_dir, 0o700)
    except OSError:
        pass
    return storage_dir


def get_aes_key() -> bytes:
    """
    Récupère la clé AES-256 (32 octets).
    Utilise la variable d'environnement PHOTO_AES_KEY si définie, sinon la clé éphémère du processus.
    """
    env_key = os.getenv("PHOTO_AES_KEY")
    if env_key:
        if len(env_key) == 64:
            try:
                return bytes.fromhex(env_key)
            except ValueError:
                pass
        raw = env_key.encode("utf-8")
        if len(raw) == 32:
            return raw
        return raw[:32].ljust(32, b"\0")
    return _EPHEMERAL_PROCESS_KEY


def _get_aad(media_uuid: uuid.UUID) -> bytes:
    return f"photo001:v1:{media_uuid}".encode("utf-8")


def encrypt_and_store(media_uuid: uuid.UUID, jpeg_bytes: bytes) -> Tuple[uuid.UUID, int]:
    """
    Chiffre jpeg_bytes avec AES-256-GCM et stocke le résultat atomiquement sur disque.
    
    Payload : PRP1 (4B) + Nonce (12B) + Ciphertext + AuthTag (16B)
    
    Returns:
        (storage_key, payload_length)
    """
    if isinstance(media_uuid, str):
        media_uuid = uuid.UUID(media_uuid)

    if not isinstance(jpeg_bytes, (bytes, bytearray)):
        raise ValueError("jpeg_bytes doit être de type bytes")

    # 1. Génération nonce 96 bits et AAD
    nonce = secrets.token_bytes(NONCE_LENGTH)
    aad = _get_aad(media_uuid)

    # 2. Chiffrement AES-GCM
    aesgcm = AESGCM(get_aes_key())
    ciphertext_and_tag = aesgcm.encrypt(nonce, bytes(jpeg_bytes), aad)

    # 3. Construction payload format PRP1
    payload = MAGIC_HEADER + nonce + ciphertext_and_tag
    storage_key = uuid.uuid4()

    # 4. Contrôle de capacité du stockage RAM (budget 32 MiB)
    current_usage = get_current_storage_usage()
    if current_usage + len(payload) > get_max_storage_bytes():
        raise OSError("Capacité de stockage éphémère saturée (quota RAM 32 MiB dépassé).")

    # 5. Écriture atomique dans PHOTO_STORAGE_DIR
    storage_dir = get_storage_dir()
    target_path = os.path.join(storage_dir, f"{storage_key}.enc")

    temp_fd, temp_path = tempfile.mkstemp(dir=storage_dir, prefix=f".tmp_{storage_key}_")
    try:
        try:
            os.fchmod(temp_fd, 0o600)
            os.write(temp_fd, payload)
            os.fsync(temp_fd)
        finally:
            os.close(temp_fd)

        os.replace(temp_path, target_path)

        # Fsync sur le dossier pour garantir l'entrée répertoire
        try:
            dir_fd = os.open(storage_dir, os.O_RDONLY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
        except OSError:
            pass
    except Exception:
        if os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except OSError:
                pass
        raise

    return storage_key, len(payload)


def decrypt_media(media_uuid: uuid.UUID, storage_key: uuid.UUID) -> bytes:
    """
    Lit le fichier chiffré {storage_key}.enc, valide le format PRP1 et déchiffre le média.
    
    Returns:
        jpeg_bytes décrypté
        
    Raises:
        FileNotFoundError si le fichier n'existe pas.
        ValueError si le format est invalide ou le déchiffrement échoue (altération/clé erronée).
    """
    if isinstance(media_uuid, str):
        media_uuid = uuid.UUID(media_uuid)
    if isinstance(storage_key, str):
        storage_key = uuid.UUID(storage_key)

    storage_dir = get_storage_dir()
    file_path = os.path.join(storage_dir, f"{storage_key}.enc")

    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"Fichier média introuvable: {storage_key}")

    try:
        with open(file_path, "rb") as f:
            payload = f.read()
    except OSError as exc:
        raise ValueError(f"Erreur lors de la lecture du fichier média: {exc}") from exc

    # Vérification taille minimale : 4 (magic) + 12 (nonce) + 16 (tag)
    min_length = HEADER_LENGTH + TAG_LENGTH
    if len(payload) < min_length or not payload.startswith(MAGIC_HEADER):
        raise ValueError("Format de fichier média chiffré invalide ou corrompu")

    nonce = payload[len(MAGIC_HEADER):HEADER_LENGTH]
    ciphertext_and_tag = payload[HEADER_LENGTH:]
    aad = _get_aad(media_uuid)

    aesgcm = AESGCM(get_aes_key())
    try:
        return aesgcm.decrypt(nonce, ciphertext_and_tag, aad)
    except Exception as exc:
        raise ValueError("Échec du déchiffrement: données altérées ou clé invalide") from exc


def delete_file(storage_key: uuid.UUID) -> bool:
    """
    Supprime physiquement le fichier média {storage_key}.enc s'il existe.
    
    Returns:
        True si supprimé, False si le fichier n'existait pas.
    """
    if isinstance(storage_key, str):
        storage_key = uuid.UUID(storage_key)

    storage_dir = get_storage_dir()
    file_path = os.path.join(storage_dir, f"{storage_key}.enc")

    if os.path.isfile(file_path):
        try:
            os.unlink(file_path)
            return True
        except OSError:
            if not os.path.exists(file_path):
                return True
            raise
    return False
