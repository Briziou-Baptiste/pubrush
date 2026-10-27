import io
import warnings
from typing import Tuple
from PIL import Image, ImageOps

# Maximum allowed raw size: 2 MiB
MAX_RAW_SIZE: int = 2 * 1024 * 1024  # 2 097 152 bytes

# Maximum allowed compressed output size: 512 KiB
MAX_OUTPUT_SIZE: int = 512 * 1024  # 524 288 bytes

# Maximum allowed pixel count to prevent decompression bombs
Image.MAX_IMAGE_PIXELS = 6_000_000

# Maximum allowed dimensions before processing
MAX_RAW_DIMENSION: int = 4096

# Maximum bounding dimension after resize
MAX_OUTPUT_DIMENSION: int = 1600

# Magic bytes
JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def process_photo(raw_bytes: bytes) -> Tuple[bytes, int, int]:
    """
    Validates, sanitizes, resizes, strips all metadata and compresses an uploaded photo.
    
    Returns:
        tuple[clean_jpeg_bytes, width, height]
    
    Raises:
        ValueError on any format, dimension, size, or processing violation.
    """
    if not isinstance(raw_bytes, (bytes, bytearray)):
        raise ValueError("Données d'image invalides")

    # 1. Vérification stricte de la taille brute
    if len(raw_bytes) > MAX_RAW_SIZE:
        raise ValueError("Taille d'image supérieure à 2 MiB")

    # 2. Vérification stricte des octets magiques (JPEG ou PNG uniquement)
    if not (raw_bytes.startswith(JPEG_MAGIC) or raw_bytes.startswith(PNG_MAGIC)):
        raise ValueError("Format d'image non supporté")

    # 3. Traitement avec Pillow
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            img = Image.open(io.BytesIO(raw_bytes))
            # Forcer la lecture des headers pour valider le format réel
            img.verify()
        except Image.DecompressionBombError as exc:
            raise ValueError("Image suspecte ou trop volumineuse (bombe de décompression)") from exc
        except Exception as exc:
            raise ValueError("Format d'image non supporté ou corrompu") from exc

    # verify() ferme ou altère les pointeurs de certains décodeurs Pillow, rouvrir le stream
    try:
        img = Image.open(io.BytesIO(raw_bytes))
    except Exception as exc:
        raise ValueError("Impossible de décoder l'image") from exc

    # 4. Vérifier les dimensions avant décodage complet
    width, height = img.size
    if width > MAX_RAW_DIMENSION or height > MAX_RAW_DIMENSION:
        raise ValueError("Dimensions d'image supérieures à 4096 px")

    if width <= 0 or height <= 0:
        raise ValueError("Dimensions d'image invalides")

    # 5. Rejeter animations / multi-frames (APNG, animated GIF disguised, etc.)
    if getattr(img, "is_animated", False) or getattr(img, "n_frames", 1) > 1:
        raise ValueError("Images animées ou multi-frames non autorisées")

    # 6. Appliquer ImageOps.exif_transpose pour orienter correctement les pixels
    try:
        transposed = ImageOps.exif_transpose(img)
        if transposed is None:
            transposed = img
    except Exception:
        transposed = img

    if transposed.width > MAX_RAW_DIMENSION or transposed.height > MAX_RAW_DIMENSION:
        raise ValueError("Dimensions d'image supérieures à 4096 px")

    # 7. Créer une nouvelle image RGB vierge et coller les pixels pour éliminer 100% des métadonnées
    clean_img = Image.new("RGB", transposed.size, (255, 255, 255))
    if transposed.mode in ("RGBA", "LA"):
        alpha_mask = transposed.split()[-1]
        clean_img.paste(transposed, mask=alpha_mask)
    elif transposed.mode == "RGB":
        clean_img.paste(transposed, (0, 0))
    else:
        converted = transposed.convert("RGB")
        clean_img.paste(converted, (0, 0))

    # 8. Redimensionner si largeur ou hauteur > 1600 px (garder ratio avec LANCZOS)
    if clean_img.width > MAX_OUTPUT_DIMENSION or clean_img.height > MAX_OUTPUT_DIMENSION:
        ratio = min(MAX_OUTPUT_DIMENSION / clean_img.width, MAX_OUTPUT_DIMENSION / clean_img.height)
        new_width = max(1, int(round(clean_img.width * ratio)))
        new_height = max(1, int(round(clean_img.height * ratio)))
        clean_img = clean_img.resize((new_width, new_height), resample=Image.Resampling.LANCZOS)

    # 9. Encodage JPEG progressif avec échelle de qualité [85, 75, 65]
    quality_scale = [85, 75, 65]
    clean_jpeg_bytes: bytes | None = None

    for q in quality_scale:
        buf = io.BytesIO()
        clean_img.save(
            buf,
            format="JPEG",
            quality=q,
            progressive=True,
            optimize=True,
        )
        data = buf.getvalue()
        if len(data) <= MAX_OUTPUT_SIZE:
            clean_jpeg_bytes = data
            break

    if clean_jpeg_bytes is None:
        raise ValueError("Image trop volumineuse après compression")

    return clean_jpeg_bytes, clean_img.width, clean_img.height


# Alias pour interopérabilité
clean_and_compress_photo = process_photo
