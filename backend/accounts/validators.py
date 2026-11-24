import re

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

PHONE_REGEX = re.compile(r"^\+[1-9]\d{6,14}$")
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}


def normalize_phone_number(value: str) -> str:
    """Strip spaces/dashes and validate international E.164 format (e.g. +255712345678)."""
    cleaned = re.sub(r"[\s\-()]", "", (value or "").strip())
    if not PHONE_REGEX.match(cleaned):
        raise ValidationError(
            "Phone number must include country code in international format (e.g. +255712345678)."
        )
    return cleaned


def validate_image_file(file_obj) -> None:
    """Validate uploaded image size and format using Pillow."""
    if file_obj.size > MAX_IMAGE_SIZE_BYTES:
        raise ValidationError("Image size must not exceed 5 MB.")

    try:
        img = Image.open(file_obj)
        img.verify()
        if img.format not in ALLOWED_IMAGE_FORMATS:
            raise ValidationError("Unsupported image format. Allowed: JPEG, PNG, WEBP.")
    except (UnidentifiedImageError, OSError):
        raise ValidationError("Invalid or corrupted image file.")
    finally:
        file_obj.seek(0)
