import io
import os
import time
import uuid
from fractions import Fraction
import pytest
from PIL import Image
from PIL.ExifTags import Base, IFD

from app.services.photo_processor import (
    process_photo,
    MAX_RAW_SIZE,
    MAX_OUTPUT_SIZE,
    MAX_OUTPUT_DIMENSION,
)
from app.services.photo_storage import (
    encrypt_and_store,
    decrypt_media,
    delete_file,
    get_storage_dir,
    MAGIC_HEADER,
)
from app.services.photo_purge import (
    cleanup_orphaned_files,
    purge_media_file,
)


@pytest.fixture(autouse=True)
def configure_storage_dir(tmp_path, monkeypatch):
    """Isoler PHOTO_STORAGE_DIR dans un dossier temporaire pour chaque test."""
    test_storage = str(tmp_path / "photo-storage-test")
    monkeypatch.setenv("PHOTO_STORAGE_DIR", test_storage)
    return test_storage


# ==============================================================================
# TESTS : PHOTO PROCESSOR (Validation, Hygiène, EXIF/GPS, Redimensionnement)
# ==============================================================================

def test_process_valid_jpeg():
    """Vérifie le traitement réussi d'une image JPEG valide."""
    img = Image.new("RGB", (800, 600), (200, 100, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    raw_bytes = buf.getvalue()

    clean_bytes, width, height = process_photo(raw_bytes)

    assert width == 800
    assert height == 600
    assert len(clean_bytes) <= MAX_OUTPUT_SIZE
    assert clean_bytes.startswith(b"\xff\xd8\xff")  # Format JPEG valide

    reloaded = Image.open(io.BytesIO(clean_bytes))
    assert reloaded.format == "JPEG"
    assert reloaded.mode == "RGB"


def test_process_valid_png_and_rgba_transparency():
    """Vérifie la conversion d'un PNG transparent RGBA vers un JPEG RGB sans métadonnées."""
    img = Image.new("RGBA", (500, 400), (255, 0, 0, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    raw_bytes = buf.getvalue()

    clean_bytes, width, height = process_photo(raw_bytes)

    assert width == 500
    assert height == 400
    assert len(clean_bytes) <= MAX_OUTPUT_SIZE

    reloaded = Image.open(io.BytesIO(clean_bytes))
    assert reloaded.format == "JPEG"
    assert reloaded.mode == "RGB"


def test_reject_unsupported_formats():
    """Refuse catégoriquement les formats non autorisés : GIF, SVG, WebP, binaire arbitraire."""
    # 1. GIF
    gif_buf = io.BytesIO()
    Image.new("RGB", (100, 100)).save(gif_buf, format="GIF")
    with pytest.raises(ValueError, match="Format d'image non supporté"):
        process_photo(gif_buf.getvalue())

    # 2. SVG (texte XML)
    svg_bytes = b"<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='red'/></svg>"
    with pytest.raises(ValueError, match="Format d'image non supporté"):
        process_photo(svg_bytes)

    # 3. WebP
    webp_buf = io.BytesIO()
    Image.new("RGB", (100, 100)).save(webp_buf, format="WEBP")
    with pytest.raises(ValueError, match="Format d'image non supporté"):
        process_photo(webp_buf.getvalue())

    # 4. Fichier aléatoire sans magic bytes valides
    with pytest.raises(ValueError, match="Format d'image non supporté"):
        process_photo(b"\x00\x01\x02\x03\x04\x05\x06\x07")


def test_reject_fake_magic_bytes_corruption():
    """Refuse un fichier qui commence par les octets magiques JPEG mais dont le contenu est corrompu."""
    fake_jpeg = b"\xff\xd8\xff" + b"CORRUPTED_GARBAGE_DATA" * 50
    with pytest.raises(ValueError, match="Format d'image non supporté ou corrompu"):
        process_photo(fake_jpeg)


def test_reject_raw_size_over_2mb():
    """Refuse une image dont la taille brute dépasse 2 MiB."""
    oversized_data = b"\xff\xd8\xff" + b"\x00" * (MAX_RAW_SIZE + 1)
    with pytest.raises(ValueError, match="Taille d'image supérieure à 2 MiB"):
        process_photo(oversized_data)


def test_reject_dimensions_over_4096():
    """Refuse les dimensions d'image > 4096 px avant décodage complet."""
    # Largeur excessive
    img_wide = Image.new("RGB", (4097, 100), (255, 255, 255))
    buf = io.BytesIO()
    img_wide.save(buf, format="JPEG")
    with pytest.raises(ValueError, match="Dimensions d'image supérieures à 4096 px"):
        process_photo(buf.getvalue())

    # Hauteur excessive
    img_tall = Image.new("RGB", (100, 4097), (255, 255, 255))
    buf2 = io.BytesIO()
    img_tall.save(buf2, format="JPEG")
    with pytest.raises(ValueError, match="Dimensions d'image supérieures à 4096 px"):
        process_photo(buf2.getvalue())


def test_reject_animated_multi_frames():
    """Rejette les images multi-frames / animées."""
    # Création d'une image PNG avec n_frames > 1
    frames = [Image.new("RGB", (100, 100), (i * 20, 0, 0)) for i in range(3)]
    buf = io.BytesIO()
    frames[0].save(buf, format="PNG", save_all=True, append_images=frames[1:])
    raw = buf.getvalue()

    # Si Pillow a produit un APNG multi-frame
    img = Image.open(io.BytesIO(raw))
    if getattr(img, "n_frames", 1) > 1 or getattr(img, "is_animated", False):
        with pytest.raises(ValueError, match="Images animées ou multi-frames non autorisées"):
            process_photo(raw)


def test_strip_all_exif_and_gps_metadata():
    """Vérifie l'élimination absolue de 100% des tags EXIF, GPS et métadonnées appareil."""
    img = Image.new("RGB", (400, 300), (100, 150, 200))
    exif = img.getexif()

    # Ajout métadonnées standard
    exif[Base.Make] = "Apple"
    exif[Base.Model] = "iPhone 15 Pro"
    exif[Base.Software] = "iOS 17.5"
    exif[Base.Orientation] = 6  # Rotation 90° CW

    # Ajout coordonnées GPS sensibles
    gps_ifd = exif.get_ifd(IFD.GPSInfo)
    gps_ifd[1] = "N"
    gps_ifd[2] = (Fraction(48, 1), Fraction(51, 1), Fraction(24, 1))  # 48° 51' 24" N
    gps_ifd[3] = "E"
    gps_ifd[4] = (Fraction(2, 1), Fraction(21, 1), Fraction(7, 1))   # 2° 21' 7" E

    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    raw_with_metadata = buf.getvalue()

    # Vérification que l'original contient bien le GPS et EXIF
    orig = Image.open(io.BytesIO(raw_with_metadata))
    assert Base.Make in orig.getexif()
    assert len(orig.getexif().get_ifd(IFD.GPSInfo)) > 0

    # Nettoyage
    clean_bytes, w, h = process_photo(raw_with_metadata)

    # Orientation 6 sur 400x300 => orienté 300x400 après exif_transpose
    assert w == 300
    assert h == 400

    # Vérification de l'image résultante
    clean_img = Image.open(io.BytesIO(clean_bytes))
    clean_exif = clean_img.getexif()

    # Doit être 100% vide
    assert len(clean_exif) == 0
    assert len(clean_exif.get_ifd(IFD.GPSInfo)) == 0
    assert "GPSInfo" not in clean_img.info
    assert "exif" not in clean_img.info


def test_resize_preserves_aspect_ratio_to_1600_limit():
    """Vérifie le redimensionnement proportionnel à max 1600 px."""
    # Image 3200 x 1600 (ratio 2:1)
    img = Image.new("RGB", (3200, 1600), (0, 120, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")

    clean_bytes, w, h = process_photo(buf.getvalue())
    assert w == 1600
    assert h == 800
    assert w <= MAX_OUTPUT_DIMENSION
    assert h <= MAX_OUTPUT_DIMENSION

    # Image 1200 x 2400 (ratio 1:2)
    img_tall = Image.new("RGB", (1200, 2400), (255, 120, 0))
    buf_tall = io.BytesIO()
    img_tall.save(buf_tall, format="JPEG")

    clean_bytes2, w2, h2 = process_photo(buf_tall.getvalue())
    assert w2 == 800
    assert h2 == 1600
    assert w2 <= MAX_OUTPUT_DIMENSION
    assert h2 <= MAX_OUTPUT_DIMENSION


# ==============================================================================
# TESTS : PHOTO STORAGE (AES-256-GCM, Atomic Write, AAD, Tampering)
# ==============================================================================

def test_encrypt_and_decrypt_media_success():
    """Vérifie le cycle complet chiffrement AES-256-GCM -> écriture disque -> lecture -> déchiffrement."""
    media_uuid = uuid.uuid4()
    original_data = b"\xff\xd8\xff" + b"TEST_PAYLOAD_IMAGE_DATA" * 50

    storage_key, payload_len = encrypt_and_store(media_uuid, original_data)
    assert isinstance(storage_key, uuid.UUID)
    assert payload_len > len(original_data)

    decrypted_data = decrypt_media(media_uuid, storage_key)
    assert decrypted_data == original_data


def test_atomic_file_write_and_permissions():
    """Vérifie l'écriture atomique et les permissions 0o600 du fichier chiffré."""
    media_uuid = uuid.uuid4()
    storage_key, _ = encrypt_and_store(media_uuid, b"secret_jpeg_payload")

    storage_dir = get_storage_dir()
    file_path = os.path.join(storage_dir, f"{storage_key}.enc")

    assert os.path.isfile(file_path)

    # Permissions 0o600 (lecture/écriture propriétaire uniquement)
    stat = os.stat(file_path)
    file_mode = stat.st_mode & 0o777
    assert file_mode == 0o600

    # Vérification du header magique PRP1
    with open(file_path, "rb") as f:
        header = f.read(4)
        assert header == MAGIC_HEADER


def test_aad_mismatch_rejected():
    """Vérifie qu'un media_uuid différent (AAD modifié) empêche tout déchiffrement."""
    media_uuid_1 = uuid.uuid4()
    media_uuid_2 = uuid.uuid4()

    storage_key, _ = encrypt_and_store(media_uuid_1, b"sensitive_photo_bytes")

    with pytest.raises(ValueError, match="Échec du déchiffrement"):
        decrypt_media(media_uuid_2, storage_key)


def test_ciphertext_corruption_rejected():
    """Vérifie qu'une altération du ciphertext ou du tag lève une erreur de déchiffrement."""
    media_uuid = uuid.uuid4()
    storage_key, _ = encrypt_and_store(media_uuid, b"another_sensitive_photo")

    storage_dir = get_storage_dir()
    file_path = os.path.join(storage_dir, f"{storage_key}.enc")

    # Altération du dernier octet (tag GCM)
    with open(file_path, "r+b") as f:
        data = bytearray(f.read())
        data[-1] ^= 0x55
        f.seek(0)
        f.write(data)

    with pytest.raises(ValueError, match="Échec du déchiffrement"):
        decrypt_media(media_uuid, storage_key)


def test_invalid_magic_header_rejected():
    """Vérifie le rejet d'un fichier dont le format n'est pas PRP1."""
    media_uuid = uuid.uuid4()
    storage_key, _ = encrypt_and_store(media_uuid, b"payload")

    storage_dir = get_storage_dir()
    file_path = os.path.join(storage_dir, f"{storage_key}.enc")

    with open(file_path, "r+b") as f:
        f.seek(0)
        f.write(b"BAD0")  # Écrase PRP1

    with pytest.raises(ValueError, match="Format de fichier média chiffré invalide"):
        decrypt_media(media_uuid, storage_key)


def test_decrypt_nonexistent_file():
    """Vérifie qu'une clé introuvable lève FileNotFoundError."""
    nonexistent_key = uuid.uuid4()
    with pytest.raises(FileNotFoundError, match="Fichier média introuvable"):
        decrypt_media(uuid.uuid4(), nonexistent_key)


def test_delete_file_idempotency():
    """Vérifie la suppression sécurisée d'un fichier média et son comportement idempotent."""
    media_uuid = uuid.uuid4()
    storage_key, _ = encrypt_and_store(media_uuid, b"to_be_deleted")

    storage_dir = get_storage_dir()
    file_path = os.path.join(storage_dir, f"{storage_key}.enc")
    assert os.path.isfile(file_path)

    # Premier appel : supprimé avec succès
    assert delete_file(storage_key) is True
    assert not os.path.exists(file_path)

    # Second appel : le fichier n'existe plus
    assert delete_file(storage_key) is False


# ==============================================================================
# TESTS : PHOTO PURGE (Orphan cleanup, Expired temp files, Safe retention)
# ==============================================================================

def test_photo_purge_cleanup_orphaned_files():
    """Vérifie que cleanup_orphaned_files supprime les orphelins et vieux temporaires, et garde les actifs."""
    storage_dir = get_storage_dir()

    # 1. Deux médias enregistrés
    media1 = uuid.uuid4()
    media2 = uuid.uuid4()
    k1, _ = encrypt_and_store(media1, b"active_media_1")
    k2, _ = encrypt_and_store(media2, b"orphaned_media_2")

    # 2. Fichier temporaire abandonné (vieux de 20 minutes)
    old_tmp = os.path.join(storage_dir, ".tmp_old_upload")
    with open(old_tmp, "w") as f:
        f.write("old_tmp_content")
    mtime_old = time.time() - 20 * 60
    os.utime(old_tmp, (mtime_old, mtime_old))

    # 3. Fichier temporaire récent (upload en cours)
    recent_tmp = os.path.join(storage_dir, ".tmp_current_upload")
    with open(recent_tmp, "w") as f:
        f.write("recent_tmp_content")

    # 4. Fichier malformé se terminant par .enc
    corrupt_enc = os.path.join(storage_dir, "not-a-uuid.enc")
    with open(corrupt_enc, "w") as f:
        f.write("junk")

    # Exécution : k1 est connu, k2 est orphelin
    deleted_count = cleanup_orphaned_files(known_storage_keys={k1})

    # Doit avoir supprimé : k2.enc, old_tmp, corrupt_enc = 3 fichiers
    assert deleted_count == 3

    # Vérification de l'état restant
    assert os.path.exists(os.path.join(storage_dir, f"{k1}.enc")) is True
    assert os.path.exists(os.path.join(storage_dir, f"{k2}.enc")) is False
    assert os.path.exists(old_tmp) is False
    assert os.path.exists(recent_tmp) is True
    assert os.path.exists(corrupt_enc) is False


def test_purge_media_file():
    """Vérifie la fonction de purge unitaire purge_media_file."""
    media_uuid = uuid.uuid4()
    storage_key, _ = encrypt_and_store(media_uuid, b"media_to_purge")

    assert purge_media_file(storage_key) is True
    assert purge_media_file(storage_key) is False
